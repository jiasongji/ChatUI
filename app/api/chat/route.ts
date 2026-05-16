import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireApprovedUser } from "@/lib/auth";
import { chatSchema } from "@/lib/validation";
import { assertAllowedChatModel, defaultChatModel } from "@/lib/models";
import { createChatCompletion } from "@/lib/openai";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".txt", ".md", ".csv", ".json",
  ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".xml",
  ".yaml", ".yml", ".sh", ".sql", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".rb", ".php", ".swift", ".kt",
  ".toml", ".ini", ".cfg", ".conf", ".log",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_TOTAL_TEXT = 500_000;

export async function POST(request: NextRequest) {
  const { user, error } = await requireApprovedUser(request);
  if (error === "unauthorized") return fail(401, "UNAUTHORIZED", "未登录");
  if (error === "disabled") return fail(403, "FORBIDDEN", "账号已被禁用");
  if (error === "not_approved")
    return fail(403, "FORBIDDEN", "账号待审核，暂不能调用模型");
  if (!user) return fail(401, "UNAUTHORIZED", "未登录");

  try {
    const formData = await request.formData();
    const sessionId = (formData.get("sessionId") as string) || "";
    const modelValue = (formData.get("model") as string) || "";
    const content = (formData.get("content") as string) || "";
    const files = formData.getAll("files") as File[];

    const input = chatSchema.parse({ sessionId, model: modelValue || undefined, content });
    const model = input.model || (await defaultChatModel());
    await assertAllowedChatModel(model);

    if (files.length > MAX_FILES) {
      return fail(400, "BAD_REQUEST", `最多上传 ${MAX_FILES} 个文件`);
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return fail(400, "BAD_REQUEST", `文件 ${file.name} 超过 10MB 限制`);
      }
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return fail(400, "BAD_REQUEST", `不支持的文件类型: ${ext}`);
      }
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: input.sessionId, userId: user.id },
      select: { id: true, title: true },
    });

    if (!session) return fail(404, "NOT_FOUND", "会话不存在");

    await mkdir(UPLOADS_DIR, { recursive: true });

    const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
    const textFileParts: string[] = [];
    const savedAttachments: { name: string; path: string; type: string; size: number }[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "bin";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await writeFile(path.join(UPLOADS_DIR, uniqueName), buffer);

      savedAttachments.push({
        name: file.name,
        path: uniqueName,
        type: file.type,
        size: file.size,
      });

      if (file.type.startsWith("image/")) {
        const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
        imageParts.push({ type: "image_url", image_url: { url: base64 } });
      } else {
        const text = buffer.toString("utf-8");
        textFileParts.push(`--- ${file.name} ---\n${text}\n---`);
      }
    }

    let enhancedContent = input.content;
    if (textFileParts.length > 0) {
      enhancedContent = `${input.content}\n\n附件内容:\n${textFileParts.join("\n\n")}`;
    }

    if (enhancedContent.length > MAX_TOTAL_TEXT) {
      return fail(400, "BAD_REQUEST", "附件内容过长，请减少文件数量或大小");
    }

    const userMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "user",
        content: input.content,
        model,
        type: "text",
        ...(savedAttachments.length > 0
          ? { attachments: JSON.stringify(savedAttachments) }
          : {}),
      },
    });

    if (session.title === "新会话") {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { title: input.content.slice(0, 40) },
      });
    }

    const recentMessages = await prisma.message.findMany({
      where: {
        userId: user.id,
        sessionId: session.id,
        type: "text",
        role: { in: ["user", "assistant", "system"] },
      },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { role: true, content: true },
    });

    const completionMessages = [
      ...recentMessages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content:
          imageParts.length > 0
            ? [{ type: "text" as const, text: enhancedContent }, ...imageParts]
            : enhancedContent,
      },
    ];

    const assistantContent = await createChatCompletion(
      model,
      completionMessages
    );
    const assistantMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "assistant",
        content: assistantContent,
        model,
        type: "text",
      },
    });

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    return ok({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        model: userMessage.model,
        type: userMessage.type,
        imageUrl: userMessage.imageUrl,
        attachments: userMessage.attachments,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        model: assistantMessage.model,
        type: assistantMessage.type,
        imageUrl: assistantMessage.imageUrl,
        createdAt: assistantMessage.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "不支持的文本模型") {
      return fail(400, "BAD_REQUEST", error.message);
    }
    if (
      error instanceof Error &&
      (error.message.includes("模型服务") || error.message.includes("上游"))
    ) {
      return fail(502, "UPSTREAM_ERROR", error.message);
    }
    return validationError(error);
  }
}
