import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for admin initialization");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        username: "Administrator",
        passwordHash,
        role: "admin",
        status: "approved"
      }
    });
    console.log("Admin user initialized");
  } else {
    if (existing.role !== "admin" || existing.status !== "approved") {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "admin",
          status: "approved"
        }
      });
      console.log("Admin user role/status repaired");
    } else {
      console.log("Admin user already exists");
    }
  }

  // Seed ApiConfig defaults from env vars
  const defaults: Record<string, { value: string; label: string }> = {
    openai_api_key: {
      value: process.env.OPENAI_API_KEY?.trim() || "",
      label: "API Key"
    },
    openai_base_url: {
      value: process.env.OPENAI_BASE_URL?.trim() || "http://cliproxyapi:8317/v1",
      label: "API Base URL"
    },
    allowed_chat_models: {
      value: process.env.ALLOWED_CHAT_MODELS?.trim() || "gpt-5.4-mini,gpt-5.4,gpt-5.5",
      label: "允许的聊天模型（逗号分隔）"
    },
    allowed_image_models: {
      value: process.env.ALLOWED_IMAGE_MODELS?.trim() || "gpt-image-2",
      label: "允许的图片模型（逗号分隔）"
    },
    default_chat_model: {
      value: process.env.DEFAULT_CHAT_MODEL?.trim() || "gpt-5.4-mini",
      label: "默认聊天模型"
    },
    default_image_model: {
      value: process.env.DEFAULT_IMAGE_MODEL?.trim() || "gpt-image-2",
      label: "默认图片模型"
    }
  };

  for (const [key, def] of Object.entries(defaults)) {
    const existing = await prisma.apiConfig.findUnique({ where: { key } });
    if (!existing) {
      await prisma.apiConfig.create({
        data: { key, value: def.value, label: def.label }
      });
      console.log(`ApiConfig seeded: ${key}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("Admin initialization failed:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
