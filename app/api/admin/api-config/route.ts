import { NextRequest } from "next/server";
import { fail, ok, validationError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getAllConfigs, seedDefaults, invalidateConfigCache } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  await seedDefaults();
  const configs = await getAllConfigs();
  return ok({ configs });
}

const saveSchema = z.object({
  configs: z.array(z.object({
    key: z.string().min(1),
    value: z.string()
  }))
});

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return fail(error === "not_admin" ? 403 : 401, "FORBIDDEN", "无权限");

  try {
    const input = saveSchema.parse(await request.json());

    for (const item of input.configs) {
      await prisma.apiConfig.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value }
      });
    }

    invalidateConfigCache();
    return ok({ saved: true });
  } catch (err) {
    return validationError(err);
  }
}

const testSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return fail(error === "not_admin" ? 403 : 401, "FORBIDDEN", "无权限");

  try {
    const { apiKey, baseUrl } = testSchema.parse(await request.json());
    const url = baseUrl.replace(/\/+$/g, "");

    const start = Date.now();
    const res = await fetch(`${url}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return ok({ success: false, status: res.status, elapsed, error: `HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}` });
    }

    const json = await res.json().catch(() => null);
    const models: string[] = (json?.data || []).map((m: { id: string }) => m.id);
    return ok({ success: true, status: 200, elapsed, models });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "测试失败";
    return ok({ success: false, error: msg });
  }
}
