import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

const LOGIN_ERROR = "邮箱或密码错误，或账号不可用";

export async function POST(request: NextRequest) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user || user.status === "disabled") {
      return fail(401, "UNAUTHORIZED", LOGIN_ERROR);
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      return fail(401, "UNAUTHORIZED", LOGIN_ERROR);
    }

    const response = NextResponse.json({
      ok: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status
        }
      }
    });

    setSessionCookie(response, request, user.id);
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail(400, "BAD_REQUEST", "请求体不是有效 JSON");
    }
    return validationError(error);
  }
}
