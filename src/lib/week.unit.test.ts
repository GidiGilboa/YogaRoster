import { describe, expect, it } from "vitest";
import {
  formatWeekRangeLabel,
  formatWeekStartParam,
  getWeekRange,
  getWeekRangeFromStartParam,
  shiftWeekStart,
} from "./week";

// A fixed, known Wednesday — chosen arbitrarily, only its weekday matters here.
const WEDNESDAY = new Date(2026, 7, 12); // 2026-08-12

describe("getWeekRange", () => {
  it("returns a range starting on Sunday and spanning exactly 7 calendar days", () => {
    const { start, end } = getWeekRange(0, WEDNESDAY);
    expect(start.getDay()).toBe(0);
    expect(formatWeekStartParam(shiftWeekStart(start, 1))).toBe(formatWeekStartParam(end));
  });

  it("contains the reference date within [start, end)", () => {
    const { start, end } = getWeekRange(0, WEDNESDAY);
    expect(start.getTime()).toBeLessThanOrEqual(WEDNESDAY.getTime());
    expect(end.getTime()).toBeGreaterThan(WEDNESDAY.getTime());
  });

  it("shifts a full week forward per positive offset", () => {
    const thisWeek = getWeekRange(0, WEDNESDAY);
    const nextWeek = getWeekRange(1, WEDNESDAY);
    expect(formatWeekStartParam(nextWeek.start)).toBe(formatWeekStartParam(shiftWeekStart(thisWeek.start, 1)));
  });

  it("shifts a full week backward per negative offset", () => {
    const thisWeek = getWeekRange(0, WEDNESDAY);
    const lastWeek = getWeekRange(-1, WEDNESDAY);
    expect(formatWeekStartParam(lastWeek.start)).toBe(formatWeekStartParam(shiftWeekStart(thisWeek.start, -1)));
  });

  it("returns the same Sunday when the reference date is already Sunday", () => {
    const { start } = getWeekRange(0, WEDNESDAY);
    const sameWeekAgain = getWeekRange(0, start);
    expect(formatWeekStartParam(sameWeekAgain.start)).toBe(formatWeekStartParam(start));
  });
});

describe("formatWeekStartParam", () => {
  it("formats as zero-padded YYYY-MM-DD", () => {
    expect(formatWeekStartParam(new Date(2026, 0, 4))).toBe("2026-01-04");
  });
});

describe("getWeekRangeFromStartParam", () => {
  it("parses a valid Sunday date param back into a range", () => {
    const { start } = getWeekRange(0, WEDNESDAY);
    const param = formatWeekStartParam(start);
    const range = getWeekRangeFromStartParam(param);
    expect(range).not.toBeNull();
    expect(formatWeekStartParam(range!.start)).toBe(param);
  });

  it("rejects a date that is not a Sunday", () => {
    const { start } = getWeekRange(0, WEDNESDAY);
    const monday = new Date(start);
    monday.setDate(start.getDate() + 1);
    expect(getWeekRangeFromStartParam(formatWeekStartParam(monday))).toBeNull();
  });

  it("rejects a malformed param", () => {
    expect(getWeekRangeFromStartParam("not-a-date")).toBeNull();
    expect(getWeekRangeFromStartParam("2026/01/04")).toBeNull();
    expect(getWeekRangeFromStartParam("")).toBeNull();
  });
});

describe("shiftWeekStart", () => {
  it("moves forward by the given number of weeks", () => {
    const start = new Date(2026, 0, 4);
    expect(formatWeekStartParam(shiftWeekStart(start, 2))).toBe("2026-01-18");
  });

  it("moves backward for a negative count", () => {
    const start = new Date(2026, 0, 18);
    expect(formatWeekStartParam(shiftWeekStart(start, -2))).toBe("2026-01-04");
  });

  it("does not mutate the input date", () => {
    const start = new Date(2026, 0, 4);
    const original = start.getTime();
    shiftWeekStart(start, 3);
    expect(start.getTime()).toBe(original);
  });
});

describe("formatWeekRangeLabel", () => {
  it("formats a range within a single month", () => {
    const start = new Date(2026, 7, 9); // Aug 9
    const end = new Date(2026, 7, 16); // Aug 16 (exclusive)
    expect(formatWeekRangeLabel(start, end)).toBe("מ-9 עד 15 באוגוסט 2026");
  });

  it("formats a range spanning two months", () => {
    const start = new Date(2026, 6, 28); // Jul 28
    const end = new Date(2026, 7, 4); // Aug 4 (exclusive)
    expect(formatWeekRangeLabel(start, end)).toBe("מ-28 ביולי עד 3 באוגוסט 2026");
  });
});
