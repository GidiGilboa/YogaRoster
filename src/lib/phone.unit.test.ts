import { describe, expect, it } from "vitest";
import { formatIsraeliPhone, isValidIsraeliMobile, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("strips non-digit characters", () => {
    expect(normalizePhone("050-123-4567")).toBe("0501234567");
  });

  it("strips spaces and plus signs", () => {
    expect(normalizePhone("+972 50 123 4567")).toBe("972501234567");
  });

  it("returns an empty string when given no digits", () => {
    expect(normalizePhone("abc-def")).toBe("");
  });

  it("leaves an already-clean digit string unchanged", () => {
    expect(normalizePhone("0501234567")).toBe("0501234567");
  });
});

describe("isValidIsraeliMobile", () => {
  it("accepts a 10-digit number starting with 05", () => {
    expect(isValidIsraeliMobile("0501234567")).toBe(true);
  });

  it("rejects a number not starting with 05", () => {
    expect(isValidIsraeliMobile("0221234567")).toBe(false);
  });

  it("rejects a number shorter than 10 digits", () => {
    expect(isValidIsraeliMobile("050123456")).toBe(false);
  });

  it("rejects a number longer than 10 digits", () => {
    expect(isValidIsraeliMobile("05012345678")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidIsraeliMobile("")).toBe(false);
  });
});

describe("formatIsraeliPhone", () => {
  it("formats a 10-digit number as XXX-XXX-XXXX", () => {
    expect(formatIsraeliPhone("0501234567")).toBe("050-123-4567");
  });

  it("returns the input unchanged when not exactly 10 digits", () => {
    expect(formatIsraeliPhone("12345")).toBe("12345");
  });
});
