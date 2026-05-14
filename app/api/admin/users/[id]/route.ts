import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { idParamSchema, updateUserSchema } from "@/lib/validation";

export async function PATCH(
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
    const input = updateUserSchema.parse(await request.json());
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail(404, "NOT_FOUND", "用户不存在");

    if (id === user.id && input.status === "disabled") {
      return fail(400, "BAD_REQUEST", "不能禁用当前管理员自己");
    }

    if (input.email && input.email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) return fail(409, "CONFLICT", "邮箱已存在");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        username: input.username,
        email: input.email,
        role: input.role,
        status: input.status,
        passwordHash: input.password
          ? await bcrypt.hash(input.password, 12)
          : undefined
      },
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
    if (error instanceof SyntaxError) {
      return fail(400, "BAD_REQUEST", "请求体不是有效 JSON");
    }
    return validationError(error);
  }
}

export async function DELETE(
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
    if (id === user.id) {
      return fail(400, "BAD_REQUEST", "不能删除当前管理员自己");
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) return fail(404, "NOT_FOUND", "用户不存在");

    await prisma.user.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return validationError(error);
  }
}
