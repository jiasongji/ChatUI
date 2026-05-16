import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UPSTREAM_ERROR"
  | "CONTENT_POLICY"
  | "INTERNAL_ERROR";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message
      }
    },
    { status }
  );
}

export function validationError(error: unknown) {
  if (error instanceof ZodError) {
    return fail(400, "BAD_REQUEST", error.issues[0]?.message ?? "参数错误");
  }

  return fail(400, "BAD_REQUEST", "参数错误");
}

export function sanitizeLogMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/sk-[A-Za-z0-9_.-]{8,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, "Bearer [REDACTED]");
}
