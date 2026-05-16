import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { registerSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const input = registerSchema.parse(await request.json());

    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code: input.inviteCode }
    });

    if (!inviteCode) {
      return fail(400, "BAD_REQUEST", "邀请码无效");
    }

    if (inviteCode.usedById) {
      return fail(400, "BAD_REQUEST", "邀请码已被使用");
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return fail(409, "CONFLICT", "该邮箱已注册");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        role: "user",
        status: "pending"
      }
    });

    await prisma.inviteCode.update({
      where: { id: inviteCode.id },
      data: {
        usedById: user.id,
        usedAt: new Date()
      }
    });

    return ok({
      message: "账号已提交审核，请等待管理员批准"
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail(400, "BAD_REQUEST", "请求体不是有效 JSON");
    }
    return validationError(error);
  }
}
