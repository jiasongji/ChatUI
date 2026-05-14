import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireApprovedUser } from "@/lib/auth";
import { imageSchema } from "@/lib/validation";
import { assertAllowedImageModel, defaultImageModel } from "@/lib/models";
import { createImage } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { user, error } = await requireApprovedUser(request);
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  if (error === "not_approved") return fail(403, "FORBIDDEN", "账号待审核，暂不能调用模型");
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  try {
    const input = imageSchema.parse(await request.json());
    const model = input.model || defaultImageModel();
    assertAllowedImageModel(model);

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

    const userMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "user",
        content: input.prompt,
        model,
        type: "text"
      }
    });

    if (session.title === "新会话") {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { title: input.prompt.slice(0, 40) }
      });
    }

    const imageUrl = await createImage(model, input.prompt, input.size || "1024x1024");
    const imageMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "assistant",
        content: input.prompt,
        model,
        type: "image",
        imageUrl
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
      imageMessage: {
        id: imageMessage.id,
        role: imageMessage.role,
        content: imageMessage.content,
        model: imageMessage.model,
        type: imageMessage.type,
        imageUrl: imageMessage.imageUrl,
        createdAt: imageMessage.createdAt
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "不支持的图片模型") {
      return fail(400, "BAD_REQUEST", error.message);
    }
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Image upstream timeout");
      return fail(504, "UPSTREAM_ERROR", "图片生成超时，请稍后重试");
    }
    if (
      error instanceof Error &&
      (error.message.includes("图片") ||
        error.message.includes("上游") ||
        error.message.includes("OPENAI_"))
    ) {
      return fail(502, "UPSTREAM_ERROR", error.message);
    }
    if (error instanceof Error) {
      console.error("Image generation unexpected error:", error.message);
      return fail(500, "INTERNAL_ERROR", "图片生成失败，请稍后重试");
    }
    return validationError(error);
  }
}
