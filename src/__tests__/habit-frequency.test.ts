import { describe, it, expect } from "vitest";
import { calculateConsistency30d } from "../services/habit-streaks.js";

describe("frequency-aware consistency", () => {
  const today = new Date("2026-03-24");

  it("daily: completions / 30", () => {
    const logs = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(today.getTime() - i * 86400000),
    }));
    const result = calculateConsistency30d(logs, "daily", undefined, today);
    expect(result).toBe(67); // 20/30
  });

  it("custom days [1,3,5] (Mon,Wed,Fri): completions / scheduled days", () => {
    const logs = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(today.getTime() - i * 2 * 86400000),
    }));
    const result = calculateConsistency30d(logs, "custom", "[1,3,5]", today);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it("weekly: completions / mondays", () => {
    // March 23 and 16 are Mondays — use noon to avoid timezone issues
    const logs = [
      { date: new Date("2026-03-23T12:00:00") },
      { date: new Date("2026-03-16T12:00:00") },
    ];
    const result = calculateConsistency30d(logs, "weekly", undefined, today);
    expect(result).toBeGreaterThan(0);
  });

  it("returns 0 for empty logs", () => {
    expect(calculateConsistency30d([], "daily", undefined, today)).toBe(0);
  });
});
