import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok, validationError } from "@/lib/api";
import { requireApprovedUser } from "@/lib/auth";
import { imageSchema } from "@/lib/validation";
import { assertAllowedImageModel, defaultImageModel } from "@/lib/models";
import { createImage, editImage } from "@/lib/openai";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

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
    const prompt = (formData.get("prompt") as string) || "";
    const sizeValue = (formData.get("size") as string) || "";
    const imageFile = formData.get("image") as File | null;

    const input = imageSchema.parse({
      sessionId,
      model: modelValue || undefined,
      prompt,
      size: sizeValue || undefined,
    });

    const model = input.model || (await defaultImageModel());
    await assertAllowedImageModel(model);

    const session = await prisma.chatSession.findFirst({
      where: { id: input.sessionId, userId: user.id },
      select: { id: true, title: true },
    });

    if (!session) return fail(404, "NOT_FOUND", "会话不存在");

    let savedAttachment: string | null = null;
    let imageBuffer: Buffer | null = null;

    if (imageFile && imageFile.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        return fail(400, "BAD_REQUEST", "仅支持 JPG、PNG、WebP 格式的图片");
      }
      if (imageFile.size > MAX_IMAGE_SIZE) {
        return fail(400, "BAD_REQUEST", "图片大小不能超过 20MB");
      }

      imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      const ext = imageFile.name.split(".").pop() || "png";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      await mkdir(UPLOADS_DIR, { recursive: true });
      await writeFile(path.join(UPLOADS_DIR, uniqueName), imageBuffer);

      savedAttachment = JSON.stringify([
        {
          name: imageFile.name,
          path: uniqueName,
          type: imageFile.type,
          size: imageFile.size,
        },
      ]);
    }

    const userMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "user",
        content: input.prompt,
        model,
        type: "text",
        ...(savedAttachment ? { attachments: savedAttachment } : {}),
      },
    });

    if (session.title === "新会话") {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { title: input.prompt.slice(0, 40) },
      });
    }

    let imageUrl: string;
    if (imageBuffer) {
      imageUrl = await editImage(
        model,
        input.prompt,
        imageBuffer,
        imageFile!.type,
        imageFile!.name,
        input.size
      );
    } else {
      imageUrl = await createImage(model, input.prompt, input.size);
    }

    const imageMessage = await prisma.message.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        role: "assistant",
        content: input.prompt,
        model,
        type: "image",
        imageUrl,
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
      imageMessage: {
        id: imageMessage.id,
        role: imageMessage.role,
        content: imageMessage.content,
        model: imageMessage.model,
        type: imageMessage.type,
        imageUrl: imageMessage.imageUrl,
        createdAt: imageMessage.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "不支持的图片模型") {
      return fail(400, "BAD_REQUEST", error.message);
    }
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Image upstream timeout (300s)");
      return fail(
        504,
        "UPSTREAM_ERROR",
        "图片生成超时（超过 5 分钟），可能是描述过于复杂或内容受限，请简化描述后重试"
      );
    }
    if (
      error instanceof Error &&
      error.message.includes("内容安全策略")
    ) {
      return fail(422, "CONTENT_POLICY", error.message);
    }
    if (
      error instanceof Error &&
      (error.message.includes("图片") ||
        error.message.includes("上游") ||
        error.message.includes("OPENAI_"))
    ) {
      return fail(502, "UPSTREAM_ERROR", error.message);
    }
    if (error instanceof Error) {
      console.error("Image generation unexpected error:", error.message);
      return fail(500, "INTERNAL_ERROR", "图片生成失败，请稍后重试");
    }
    return validationError(error);
  }
}
