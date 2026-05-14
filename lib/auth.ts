import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "chatui_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  userId: string;
  exp: number;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return value;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sign(payload: string) {
  return base64url(
    crypto.createHmac("sha256", secret()).update(payload).digest()
  );
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createSessionValue(userId: string) {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function parseSessionValue(value?: string) {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  if (!timingSafeEqual(sign(encoded), signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8"
      )
    ) as SessionPayload;

    if (!payload.userId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isSecureRequest(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto");
  return proto === "https" || request.nextUrl.protocol === "https:";
}

export function setSessionCookie(
  response: NextResponse,
  request: NextRequest,
  userId: string
) {
  response.cookies.set(SESSION_COOKIE, createSessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = parseSessionValue(value);
  if (!payload) return null;

  return prisma.user.findUnique({ where: { id: payload.userId } });
}

export async function getCurrentUserFromRequest(request: NextRequest) {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = parseSessionValue(value);
  if (!payload) return null;

  return prisma.user.findUnique({ where: { id: payload.userId } });
}

export async function requireUser(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return { user: null, error: "unauthorized" as const };
  }
  if (user.status === "disabled") {
    return { user: null, error: "disabled" as const };
  }
  return { user, error: null };
}

export async function requireApprovedUser(request: NextRequest) {
  const result = await requireUser(request);
  if (result.error || !result.user) return result;
  if (result.user.status !== "approved") {
    return { user: null, error: "not_approved" as const };
  }
  return { user: result.user, error: null };
}

export async function requireAdmin(request: NextRequest) {
  const result = await requireUser(request);
  if (result.error || !result.user) return result;
  if (result.user.role !== "admin") {
    return { user: null, error: "not_admin" as const };
  }
  return { user: result.user, error: null };
}
