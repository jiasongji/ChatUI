import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true, data: { message: "已退出登录" } });
  clearSessionCookie(response, request);
  return response;
}
