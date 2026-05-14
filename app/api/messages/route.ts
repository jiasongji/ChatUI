import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { messagesQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser(request);
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  try {
    const input = messagesQuerySchema.parse({
      sessionId: request.nextUrl.searchParams.get("sessionId")
    });

    const session = await prisma.chatSession.findFirst({
      where: {
        id: input.sessionId,
        userId: user.id
      },
      select: { id: true }
    });

    if (!session) {
      return fail(404, "NOT_FOUND", "会话不存在");
    }

    const messages = await prisma.message.findMany({
      where: {
        userId: user.id,
        sessionId: input.sessionId
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        model: true,
        type: true,
        imageUrl: true,
        createdAt: true
      }
    });

    return ok({ messages });
  } catch (error) {
    return validationError(error);
  }
}
