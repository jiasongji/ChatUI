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
    return;
  }

  if (existing.role !== "admin" || existing.status !== "approved") {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "admin",
        status: "approved"
      }
    });
    console.log("Admin user role/status repaired");
    return;
  }

  console.log("Admin user already exists");
}

main()
  .catch((error) => {
    console.error("Admin initialization failed:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
