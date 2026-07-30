import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  it("allows attempts up to the limit, then blocks", () => {
    resetRateLimitsForTests();
    const results = Array.from({ length: 7 }, () => checkRateLimit("key-a", 5, 60_000));
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it("tracks separate keys independently", () => {
    resetRateLimitsForTests();
    for (let i = 0; i < 5; i++) checkRateLimit("key-b", 5, 60_000);
    expect(checkRateLimit("key-b", 5, 60_000)).toBe(false);
    expect(checkRateLimit("key-c", 5, 60_000)).toBe(true);
  });

  it("resets the window after it expires", async () => {
    resetRateLimitsForTests();
    expect(checkRateLimit("key-d", 1, 20)).toBe(true);
    expect(checkRateLimit("key-d", 1, 20)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(checkRateLimit("key-d", 1, 20)).toBe(true);
  });
});
