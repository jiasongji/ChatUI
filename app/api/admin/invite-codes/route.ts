import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { username: true } },
      usedBy: { select: { username: true } }
    }
  });
  return ok({ inviteCodes: codes });
}

const createSchema = z.object({
  code: z.string().trim().min(4, "邀请码至少 4 位").max(32, "邀请码过长"),
  label: z.string().trim().max(80).optional()
});

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error || !user) {
    return fail(error === "not_admin" ? 403 : 401, "FORBIDDEN", "无权限");
  }

  try {
    const input = createSchema.parse(await request.json());
    const existing = await prisma.inviteCode.findUnique({ where: { code: input.code } });
    if (existing) {
      return fail(409, "CONFLICT", "邀请码已存在");
    }

    const code = await prisma.inviteCode.create({
      data: {
        code: input.code,
        label: input.label || null,
        createdById: user.id
      }
    });

    return ok({ inviteCode: code });
  } catch (err) {
    return validationError(err);
  }
}
