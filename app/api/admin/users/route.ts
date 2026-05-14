import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  if (error === "not_admin") return fail(403, "FORBIDDEN", "权限不足");
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          sessions: true,
          messages: true
        }
      }
    }
  });

  return ok({ users });
}
