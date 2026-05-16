import { sanitizeLogMessage } from "./api";
import { getOpenaiApiKey, getOpenaiBaseUrl } from "./config";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`上游返回了非 JSON 响应，HTTP ${response.status}`);
  }
}

export async function createChatCompletion(
  model: string,
  messages: ChatMessage[]
) {
  const response = await fetch(
    `${await getOpenaiBaseUrl()}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getOpenaiApiKey()}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
      cache: "no-store",
    }
  );

  const json = await parseJson(response);

  if (!response.ok) {
    const detail =
      json?.error?.message ||
      json?.message ||
      `上游聊天接口返回 HTTP ${response.status}`;
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

export async function createImage(
  model: string,
  prompt: string,
  size?: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(
      `${await getOpenaiBaseUrl()}/images/generations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getOpenaiApiKey()}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          ...(size ? { size } : {}),
        }),
        cache: "no-store",
        signal: controller.signal,
      }
    );

    const json = await parseJson(response);

    if (!response.ok) {
      const errCode = json?.error?.code || json?.code || "";
      const errMsg =
        json?.error?.message || json?.message || "";

      if (
        errCode === "content_policy_violation" ||
        /content.?policy|safety|inappropriate|refused/i.test(errMsg)
      ) {
        console.error("Image content policy:", sanitizeLogMessage(errMsg));
        throw new Error(
          "图片生成被内容安全策略拦截，请修改描述后重试"
        );
      }

      console.error(
        "Image upstream failed:",
        sanitizeLogMessage(errMsg || `HTTP ${response.status}`)
      );
      throw new Error(
        errMsg
          ? `图片生成失败：${sanitizeLogMessage(errMsg)}`
          : `图片生成服务暂时不可用（HTTP ${response.status}）`
      );
    }

    const item = json?.data?.[0] ?? json?.image ?? json;
    const url = item?.url;
    const b64Json = item?.b64_json ?? item?.b64;

    if (typeof url === "string" && url) return url;
    if (typeof b64Json === "string" && b64Json) {
      return b64Json.startsWith("data:image/")
        ? b64Json
        : `data:image/png;base64,${b64Json}`;
    }

    console.error("Image upstream returned unsupported payload shape:", JSON.stringify(Object.keys(json ?? {})));
    throw new Error("图片服务返回格式异常");
  } finally {
    clearTimeout(timeout);
  }
}

export async function editImage(
  model: string,
  prompt: string,
  imageBuffer: Buffer,
  mimeType: string,
  filename: string,
  size?: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append(
      "image",
      new Blob([imageBuffer], { type: mimeType }),
      filename
    );
    if (size) form.append("size", size);

    const response = await fetch(
      `${await getOpenaiBaseUrl()}/images/edits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getOpenaiApiKey()}`,
        },
        body: form,
        cache: "no-store",
        signal: controller.signal,
      }
    );

    const json = await parseJson(response);

    if (!response.ok) {
      const errCode = json?.error?.code || json?.code || "";
      const errMsg =
        json?.error?.message || json?.message || "";

      if (
        errCode === "content_policy_violation" ||
        /content.?policy|safety|inappropriate|refused/i.test(errMsg)
      ) {
        console.error("Image edit content policy:", sanitizeLogMessage(errMsg));
        throw new Error(
          "图片编辑被内容安全策略拦截，请修改描述后重试"
        );
      }

      console.error(
        "Image edit upstream failed:",
        sanitizeLogMessage(errMsg || `HTTP ${response.status}`)
      );
      throw new Error(
        errMsg
          ? `图片编辑失败：${sanitizeLogMessage(errMsg)}`
          : `图片编辑服务暂时不可用（HTTP ${response.status}）`
      );
    }

    const item = json?.data?.[0] ?? json?.image ?? json;
    const url = item?.url;
    const b64Json = item?.b64_json ?? item?.b64;

    if (typeof url === "string" && url) return url;
    if (typeof b64Json === "string" && b64Json) {
      return b64Json.startsWith("data:image/")
        ? b64Json
        : `data:image/png;base64,${b64Json}`;
    }

    console.error("Image edit upstream returned unsupported payload shape:", JSON.stringify(Object.keys(json ?? {})));
    throw new Error("图片编辑服务返回格式异常");
  } finally {
    clearTimeout(timeout);
  }
}
