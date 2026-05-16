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
