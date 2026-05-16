import { ok } from "@/lib/api";
import { getAllowedChatModels, getAllowedImageModels } from "@/lib/config";

export async function GET() {
  return ok({
    chatModels: await getAllowedChatModels(),
    imageModels: await getAllowedImageModels()
  });
}
