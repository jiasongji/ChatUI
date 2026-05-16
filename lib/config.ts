import { prisma } from "./prisma";

const DEFAULTS: Record<string, { value: string; label: string }> = {
  openai_api_key: {
    value: "",
    label: "API Key"
  },
  openai_base_url: {
    value: "http://cliproxyapi:8317/v1",
    label: "API Base URL"
  },
  allowed_chat_models: {
    value: "gpt-5.4-mini,gpt-5.4,gpt-5.5",
    label: "允许的聊天模型（逗号分隔）"
  },
  allowed_image_models: {
    value: "gpt-image-2",
    label: "允许的图片模型（逗号分隔）"
  },
  default_chat_model: {
    value: "gpt-5.4-mini",
    label: "默认聊天模型"
  },
  default_image_model: {
    value: "gpt-image-2",
    label: "默认图片模型"
  }
};

let cache: Record<string, string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 30_000;

async function loadConfig(): Promise<Record<string, string>> {
  const rows = await prisma.apiConfig.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

async function getFreshConfig(): Promise<Record<string, string>> {
  if (cache && Date.now() < cacheExpiry) return cache;
  const map = await loadConfig();
  cache = map;
  cacheExpiry = Date.now() + CACHE_TTL;
  return map;
}

export function invalidateConfigCache() {
  cache = null;
  cacheExpiry = 0;
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  const map = await getFreshConfig();
  return map[key] || undefined;
}

export async function getOpenaiApiKey(): Promise<string> {
  const db = await getConfigValue("openai_api_key");
  if (db) return db;
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env) return env;
  throw new Error("OPENAI_API_KEY is not configured");
}

export async function getOpenaiBaseUrl(): Promise<string> {
  const db = await getConfigValue("openai_base_url");
  if (db) return db.replace(/\/+$/g, "");
  const env = process.env.OPENAI_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/g, "");
  throw new Error("OPENAI_BASE_URL is not configured");
}

export async function getAllowedChatModels(): Promise<string[]> {
  const db = await getConfigValue("allowed_chat_models");
  const raw = db || process.env.ALLOWED_CHAT_MODELS || "gpt-5.4-mini,gpt-5.4,gpt-5.5";
  const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"];
}

export async function getAllowedImageModels(): Promise<string[]> {
  const db = await getConfigValue("allowed_image_models");
  const raw = db || process.env.ALLOWED_IMAGE_MODELS || "gpt-image-2";
  const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : ["gpt-image-2"];
}

export async function getDefaultChatModel(): Promise<string> {
  const allowed = await getAllowedChatModels();
  const db = await getConfigValue("default_chat_model");
  const configured = db || process.env.DEFAULT_CHAT_MODEL?.trim();
  return configured && allowed.includes(configured) ? configured : allowed[0] || "gpt-5.4-mini";
}

export async function getDefaultImageModel(): Promise<string> {
  const allowed = await getAllowedImageModels();
  const db = await getConfigValue("default_image_model");
  const configured = db || process.env.DEFAULT_IMAGE_MODEL?.trim();
  return configured && allowed.includes(configured) ? configured : allowed[0] || "gpt-image-2";
}

export async function getAllConfigs() {
  const rows = await prisma.apiConfig.findMany({ orderBy: { key: "asc" } });
  const result: { key: string; value: string; label: string }[] = [];
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const row = rows.find((r) => r.key === key);
    result.push({
      key,
      value: row?.value ?? def.value,
      label: def.label
    });
  }
  return result;
}

export async function seedDefaults() {
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const existing = await prisma.apiConfig.findUnique({ where: { key } });
    if (!existing) {
      let value = def.value;
      if (key === "openai_api_key" && process.env.OPENAI_API_KEY) {
        value = process.env.OPENAI_API_KEY.trim();
      }
      if (key === "openai_base_url" && process.env.OPENAI_BASE_URL) {
        value = process.env.OPENAI_BASE_URL.trim();
      }
      if (key === "allowed_chat_models" && process.env.ALLOWED_CHAT_MODELS) {
        value = process.env.ALLOWED_CHAT_MODELS.trim();
      }
      if (key === "allowed_image_models" && process.env.ALLOWED_IMAGE_MODELS) {
        value = process.env.ALLOWED_IMAGE_MODELS.trim();
      }
      if (key === "default_chat_model" && process.env.DEFAULT_CHAT_MODEL) {
        value = process.env.DEFAULT_CHAT_MODEL.trim();
      }
      if (key === "default_image_model" && process.env.DEFAULT_IMAGE_MODEL) {
        value = process.env.DEFAULT_IMAGE_MODEL.trim();
      }
      await prisma.apiConfig.create({
        data: { key, value, label: def.label }
      });
    }
  }
}

export { DEFAULTS };
