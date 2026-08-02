import { describe, expect, it } from "vitest";
import { israeliWallTimeToUtc } from "./timezone";

const jerusalemTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

describe("israeliWallTimeToUtc", () => {
  it("converts summer (IDT, UTC+3) wall-clock time to the correct UTC instant", () => {
    const result = israeliWallTimeToUtc("2026-08-01T16:00");
    expect(result?.toISOString()).toBe("2026-08-01T13:00:00.000Z");
  });

  it("converts winter (IST, UTC+2) wall-clock time to the correct UTC instant", () => {
    const result = israeliWallTimeToUtc("2026-01-15T16:00");
    expect(result?.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("round-trips back to the original wall-clock time when re-rendered in Asia/Jerusalem", () => {
    const summer = israeliWallTimeToUtc("2026-08-01T16:00")!;
    const winter = israeliWallTimeToUtc("2026-01-15T16:00")!;
    expect(jerusalemTimeFormatter.format(summer)).toBe("16:00");
    expect(jerusalemTimeFormatter.format(winter)).toBe("16:00");
  });

  it("returns null for a malformed string", () => {
    expect(israeliWallTimeToUtc("not-a-date")).toBeNull();
    expect(israeliWallTimeToUtc("2026-08-01")).toBeNull();
  });
});
