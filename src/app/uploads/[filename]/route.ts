import { readFile } from "node:fs/promises";
import path from "node:path";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// In production, `next start` only serves files that existed in `public/` at
// build time - it does not check the filesystem for paths added afterward.
// Teacher background images are written to public/uploads at runtime (see
// saveBackgroundImage in actions/settings.ts), so they need a route handler
// to actually be servable instead of relying on public/ static serving.
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // saveUploadedImage only ever writes "teacher-<id>.<ext>" (background photo)
  // or "share-<id>.<ext>" (WhatsApp-share photo) - reject anything else so a
  // crafted filename segment can't be used for path traversal.
  const match = /^(?:teacher|share)-[a-zA-Z0-9]+\.(jpg|png|webp|gif)$/.exec(filename);
  if (!match) {
    return new Response(null, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", filename);
  try {
    const buffer = await readFile(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_BY_EXTENSION[match[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
