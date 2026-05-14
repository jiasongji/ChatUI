import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createSessionSchema } from "@/lib/validation";

function authError(error: "unauthorized" | "disabled" | null) {
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  return null;
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser(request);
  const auth = authError(error);
  if (auth) return auth;
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  const sessions = await prisma.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return ok({ sessions });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser(request);
  const auth = authError(error);
  if (auth) return auth;
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  try {
    const input = createSessionSchema.parse(await request.json().catch(() => ({})));
    const session = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: input.title || "新会话"
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return ok({ session }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
