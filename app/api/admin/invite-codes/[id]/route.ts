import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(_request);
  if (error) return fail(error === "not_admin" ? 403 : 401, "FORBIDDEN", "无权限");

  const { id } = await params;
  const existing = await prisma.inviteCode.findUnique({ where: { id } });
  if (!existing) return fail(404, "NOT_FOUND", "邀请码不存在");

  await prisma.inviteCode.delete({ where: { id } });
  return ok({ deleted: true });
}

const updateSchema = z.object({
  code: z.string().trim().min(4, "邀请码至少 4 位").max(32, "邀请码过长").optional(),
  label: z.string().trim().max(80).optional()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return fail(error === "not_admin" ? 403 : 401, "FORBIDDEN", "无权限");

  const { id } = await params;
  const existing = await prisma.inviteCode.findUnique({ where: { id } });
  if (!existing) return fail(404, "NOT_FOUND", "邀请码不存在");

  try {
    const input = updateSchema.parse(await request.json());

    if (input.code && input.code !== existing.code) {
      const conflict = await prisma.inviteCode.findUnique({ where: { code: input.code } });
      if (conflict) return fail(409, "CONFLICT", "邀请码已存在");
    }

    const updated = await prisma.inviteCode.update({
      where: { id },
      data: {
        ...(input.code ? { code: input.code } : {}),
        ...(input.label !== undefined ? { label: input.label || null } : {})
      }
    });

    return ok({ inviteCode: updated });
  } catch (err) {
    return validationError(err);
  }
}
