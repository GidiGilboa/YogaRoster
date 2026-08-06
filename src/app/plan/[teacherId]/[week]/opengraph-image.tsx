import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getWeekRangeFromStartParam } from "@/lib/week";

// Reads the local file directly off disk rather than fetching the /uploads
// route over HTTP - simpler and avoids a self-referential network round trip
// during image generation.
async function loadImageDataUrl(shareImageUrl: string): Promise<string | null> {
  const [pathname] = shareImageUrl.split("?");
  const extension = pathname.split(".").pop() ?? "";
  const mimeByExtension: Record<string, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  const mime = mimeByExtension[extension];
  if (!mime) return null;

  try {
    const filePath = path.join(process.cwd(), "public", pathname);
    const buffer = await readFile(filePath);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// Satori (next/og's renderer) lays out text in strict logical/source
// order and doesn't apply the Unicode bidi algorithm the way a real
// browser does - `direction: "rtl"` has no effect on character order, only
// on block alignment. Reversing a pure-Hebrew string here is what actually
// makes it render correctly; don't use this on strings that mix in Latin
// text or digits (e.g. the date label), since those need to stay in their
// own left-to-right order even inside an RTL layout.
function reverseHebrew(text: string): string {
  return [...text].reverse().join("");
}

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ teacherId: string; week: string }>;
}) {
  const { teacherId, week } = await params;
  const range = getWeekRangeFromStartParam(week);

  let dateLabel = "";
  if (range) {
    const lastDay = new Date(range.end);
    lastDay.setDate(range.end.getDate() - 1);
    dateLabel = `${range.start.getDate()}.${range.start.getMonth() + 1} - ${lastDay.getDate()}.${
      lastDay.getMonth() + 1
    }.${lastDay.getFullYear()}`;
  }

  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  const imageDataUrl = teacher?.shareImageUrl ? await loadImageDataUrl(teacher.shareImageUrl) : null;

  if (teacher && imageDataUrl) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og's renderer, not the browser */}
          <img
            src={imageDataUrl}
            width={size.width}
            height={size.height}
            style={{ position: "absolute", inset: 0, objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 75%)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 56,
              bottom: 48,
              left: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              color: "white",
            }}
          >
            <div style={{ display: "flex", fontSize: 28, fontWeight: 500, opacity: 0.9, marginBottom: 6 }}>
              {reverseHebrew(teacher.appName)}
            </div>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.1, marginBottom: 14 }}>
              {reverseHebrew(`שיעורי יוגה עם ${teacher.name}`)}
            </div>
            <div style={{ display: "flex", fontSize: 32, opacity: 0.92 }}>{dateLabel}</div>
          </div>
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1d4ed8, #1e293b)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 24, opacity: 0.85 }}>Yoga Roster</div>
        <div style={{ fontSize: 96, fontWeight: 700 }}>{dateLabel}</div>
      </div>
    ),
    { ...size }
  );
}
