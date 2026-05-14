import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser(request);

  if (error === "unauthorized") {
    return fail(401, "UNAUTHORIZED", "未登录");
  }
  if (error === "disabled") {
    return fail(403, "FORBIDDEN", "账号已被禁用");
  }
  if (!user) {
    return fail(401, "UNAUTHORIZED", "未登录");
  }

  return ok({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status
    }
  });
}
