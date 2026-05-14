import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { idParamSchema } from "@/lib/validation";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser(request);
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  try {
    const { id } = idParamSchema.parse(await context.params);
    const session = await prisma.chatSession.findFirst({
      where: {
        id,
        userId: user.id
      },
      select: { id: true }
    });

    if (!session) {
      return fail(404, "NOT_FOUND", "会话不存在");
    }

    await prisma.chatSession.delete({
      where: { id: session.id }
    });

    return ok({ deleted: true });
  } catch (error) {
    return validationError(error);
  }
}
