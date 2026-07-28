import { ImageResponse } from "next/og";
import { getWeekRangeFromStartParam } from "@/lib/week";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const range = getWeekRangeFromStartParam(week);

  let dateLabel = "";
  if (range) {
    const lastDay = new Date(range.end);
    lastDay.setDate(range.end.getDate() - 1);
    dateLabel = `${range.start.getDate()}.${range.start.getMonth() + 1} - ${lastDay.getDate()}.${
      lastDay.getMonth() + 1
    }.${lastDay.getFullYear()}`;
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
