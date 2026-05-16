import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("邮箱格式不正确")
  .max(254, "邮箱过长")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(128, "密码过长");

export const registerSchema = z.object({
  username: z.string().trim().min(2, "用户名至少 2 位").max(40, "用户名过长"),
  email: emailSchema,
  password: passwordSchema,
  inviteCode: z.string().trim().min(1, "邀请码不能为空")
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "请输入密码").max(128, "密码过长")
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(80).optional()
});

export const idParamSchema = z.object({
  id: z.string().min(1)
});

export const messagesQuerySchema = z.object({
  sessionId: z.string().min(1, "sessionId 必填")
});

export const chatSchema = z.object({
  sessionId: z.string().min(1, "sessionId 必填"),
  model: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1, "消息不能为空").max(12000, "消息过长")
});

const VALID_IMAGE_SIZES = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "1792x1024",
  "1024x1792"
] as const;

export const imageSchema = z.object({
  sessionId: z.string().min(1, "sessionId 必填"),
  model: z.string().trim().min(1).optional(),
  prompt: z
    .string()
    .trim()
    .min(1, "图片描述不能为空")
    .max(4000, "图片描述过长"),
  size: z.enum(VALID_IMAGE_SIZES).optional()
});

export const updateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "用户名至少 2 位")
    .max(40, "用户名过长")
    .optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: z.enum(["admin", "user"]).optional(),
  status: z.enum(["pending", "approved", "disabled"]).optional()
});
