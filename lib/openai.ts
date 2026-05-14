import { sanitizeLogMessage } from "./api";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function baseUrl() {
  const value = process.env.OPENAI_BASE_URL?.trim();
  if (!value) {
    throw new Error("OPENAI_BASE_URL is not configured");
  }
  return value.replace(/\/+$/g, "");
}

function apiKey() {
  const value = process.env.OPENAI_API_KEY?.trim();
  if (!value) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return value;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`上游返回了非 JSON 响应，HTTP ${response.status}`);
  }
}

export async function createChatCompletion(model: string, messages: ChatMessage[]) {
  const response = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    }),
    cache: "no-store"
  });

  const json = await parseJson(response);

  if (!response.ok) {
    const detail =
      json?.error?.message || json?.message || `上游聊天接口返回 HTTP ${response.status}`;
    console.error("Chat upstream failed:", sanitizeLogMessage(detail));
    throw new Error("模型服务暂时不可用，请稍后重试");
  }

  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    json?.output_text ??
    json?.content;

  if (typeof content !== "string" || !content.trim()) {
    console.error("Chat upstream returned unsupported payload shape");
    throw new Error("模型服务返回格式异常");
  }

  return content.trim();
}

export async function createImage(model: string, prompt: string, size = "1024x1024") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${baseUrl()}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`
      },
      body: JSON.stringify({
        model,
        prompt,
        size
      }),
      cache: "no-store",
      signal: controller.signal
    });

    const json = await parseJson(response);

    if (!response.ok) {
      const detail =
        json?.error?.message || json?.message || `上游图片接口返回 HTTP ${response.status}`;
      console.error("Image upstream failed:", sanitizeLogMessage(detail));
      throw new Error("图片生成服务暂时不可用，请稍后重试");
    }

    const item = json?.data?.[0] ?? json?.image ?? json;
    const url = item?.url;
    const b64Json = item?.b64_json ?? item?.b64;

    if (typeof url === "string" && url) {
      return url;
    }

    if (typeof b64Json === "string" && b64Json) {
      return b64Json.startsWith("data:image/")
        ? b64Json
        : `data:image/png;base64,${b64Json}`;
    }

    console.error("Image upstream returned unsupported payload shape");
    throw new Error("图片服务返回格式异常");
  } finally {
    clearTimeout(timeout);
  }
}
