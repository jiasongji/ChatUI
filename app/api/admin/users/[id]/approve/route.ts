import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { idParamSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAdmin(request);
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  if (error === "not_admin") return fail(403, "FORBIDDEN", "权限不足");
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  try {
    const { id } = idParamSchema.parse(await context.params);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail(404, "NOT_FOUND", "用户不存在");

    const updated = await prisma.user.update({
      where: { id },
      data: { status: "approved" },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return ok({ user: updated });
  } catch (error) {
    return validationError(error);
  }
}
