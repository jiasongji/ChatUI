export const FALLBACK_CHAT_MODELS = ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"];
export const FALLBACK_IMAGE_MODELS = ["gpt-image-2"];

function parseCsv(value: string | undefined, fallback: string[]) {
  const parsed = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed && parsed.length > 0 ? parsed : fallback;
}

export function allowedChatModels() {
  return parseCsv(process.env.ALLOWED_CHAT_MODELS, FALLBACK_CHAT_MODELS);
}

export function allowedImageModels() {
  return parseCsv(process.env.ALLOWED_IMAGE_MODELS, FALLBACK_IMAGE_MODELS);
}

export function defaultChatModel() {
  const allowed = allowedChatModels();
  const configured = process.env.DEFAULT_CHAT_MODEL?.trim();
  return configured && allowed.includes(configured) ? configured : "gpt-5.4-mini";
}

export function defaultImageModel() {
  const allowed = allowedImageModels();
  const configured = process.env.DEFAULT_IMAGE_MODEL?.trim();
  return configured && allowed.includes(configured) ? configured : "gpt-image-2";
}

export function assertAllowedChatModel(model: string) {
  if (!allowedChatModels().includes(model)) {
    throw new Error("不支持的文本模型");
  }
}

export function assertAllowedImageModel(model: string) {
  if (!allowedImageModels().includes(model)) {
    throw new Error("不支持的图片模型");
  }
}
