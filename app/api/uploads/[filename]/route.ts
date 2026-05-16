import { NextRequest } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeName || safeName.startsWith(".")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const filePath = path.join(UPLOADS_DIR, safeName);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return new Response("Not found", { status: 404 });

    const buffer = await readFile(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
