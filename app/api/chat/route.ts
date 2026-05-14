import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireApprovedUser } from "@/lib/auth";
import { chatSchema } from "@/lib/validation";
import { assertAllowedChatModel, defaultChatModel } from "@/lib/models";
import { createChatCompletion } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { user, error } = await requireApprovedUser(request);
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  if (error === "not_approved") return fail(403, "FORBIDDEN", "账号待审核，暂不能调用模型");
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  try {
    const input = chatSchema.parse(await request.json());
    const model = input.model || defaultChatModel();
    assertAllowedChatModel(model);

    const session = await prisma.chatSession.findFirst({
      where: {
        id: input.sessionId,
        userId: user.id
      },
      select: { id: true, title: true }
    });

    if (!session) {
      return fail(404, "NOT_FOUND", "会话不存在");
    }

    const recentMessages = await prisma.message.findMany({
      where: {
        userId: user.id,
        sessionId: session.id,
        type: "text",
        role: {
          in: ["user", "assistant", "system"]
        }
      },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: {
        role: true,
        content: true
      }
    });

    const userMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "user",
        content: input.content,
        model,
        type: "text"
      }
    });

    if (session.title === "新会话") {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { title: input.content.slice(0, 40) }
      });
    }

    const completionMessages = [
      ...recentMessages.map((message) => ({
        role: message.role as "system" | "user" | "assistant",
        content: message.content
      })),
      {
        role: "user" as const,
        content: input.content
      }
    ];

    const assistantContent = await createChatCompletion(model, completionMessages);
    const assistantMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "assistant",
        content: assistantContent,
        model,
        type: "text"
      }
    });

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() }
    });

    return ok({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        model: userMessage.model,
        type: userMessage.type,
        imageUrl: userMessage.imageUrl,
        createdAt: userMessage.createdAt
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        model: assistantMessage.model,
        type: assistantMessage.type,
        imageUrl: assistantMessage.imageUrl,
        createdAt: assistantMessage.createdAt
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "不支持的文本模型") {
      return fail(400, "BAD_REQUEST", error.message);
    }
    if (
      error instanceof Error &&
      (error.message.includes("模型服务") || error.message.includes("上游"))
    ) {
      return fail(502, "UPSTREAM_ERROR", error.message);
    }
    return validationError(error);
  }
}
