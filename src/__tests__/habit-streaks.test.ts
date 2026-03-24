import { describe, it, expect } from "vitest";
import {
  calculateStreak,
  calculateConsistency30d,
  determineStage,
  shouldAutoFreeze,
} from "../services/habit-streaks";

/** Helper: create a Date for N days ago from a fixed reference */
function daysAgo(n: number, ref: Date = new Date(2026, 2, 19)): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const TODAY = new Date(2026, 2, 19); // 2026-03-19

// ─── calculateStreak ─────────────────────────────────────────────────

describe("calculateStreak", () => {
  it("returns 0 for empty logs", () => {
    expect(calculateStreak([], TODAY)).toBe(0);
  });

  it("returns 1 when only today is completed", () => {
    expect(calculateStreak([{ date: daysAgo(0) }], TODAY)).toBe(1);
  });

  it("returns streak starting from yesterday when today not completed", () => {
    const logs = [{ date: daysAgo(1) }, { date: daysAgo(2) }, { date: daysAgo(3) }];
    expect(calculateStreak(logs, TODAY)).toBe(3);
  });

  it("counts consecutive days including today", () => {
    const logs = [
      { date: daysAgo(0) },
      { date: daysAgo(1) },
      { date: daysAgo(2) },
    ];
    expect(calculateStreak(logs, TODAY)).toBe(3);
  });

  it("stops at a gap", () => {
    const logs = [
      { date: daysAgo(0) },
      { date: daysAgo(1) },
      // gap at daysAgo(2)
      { date: daysAgo(3) },
      { date: daysAgo(4) },
    ];
    expect(calculateStreak(logs, TODAY)).toBe(2);
  });

  it("returns 0 when no recent days are completed", () => {
    const logs = [{ date: daysAgo(5) }];
    expect(calculateStreak(logs, TODAY)).toBe(0);
  });
});

// ─── calculateConsistency30d ─────────────────────────────────────────

describe("calculateConsistency30d", () => {
  it("returns 100 for daily with all 30 days completed", () => {
    const logs = Array.from({ length: 30 }, (_, i) => ({ date: daysAgo(i) }));
    expect(calculateConsistency30d(logs, "daily", undefined, TODAY)).toBe(100);
  });

  it("returns ~50% when half the days are completed", () => {
    // Complete every other day (0, 2, 4, ...)
    const logs = Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i * 2) }));
    expect(calculateConsistency30d(logs, "daily", undefined, TODAY)).toBe(50);
  });

  it("returns 0 for no logs", () => {
    expect(calculateConsistency30d([], "daily", undefined, TODAY)).toBe(0);
  });

  it("handles custom frequency", () => {
    // Custom: Mon(1), Wed(3), Fri(5)
    // Count how many of those days fall in 30-day window
    const customDays = "[1,3,5]";
    // Complete all expected days
    const logs: { date: Date }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = daysAgo(i);
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      if ([1, 3, 5].includes(dow)) {
        logs.push({ date: d });
      }
    }
    expect(calculateConsistency30d(logs, "custom", customDays, TODAY)).toBe(100);
  });

  it("handles weekly frequency", () => {
    // Weekly = Mondays only. Find all Mondays in last 30 days and complete them.
    const logs: { date: Date }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = daysAgo(i);
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      if (dow === 1) logs.push({ date: d });
    }
    expect(calculateConsistency30d(logs, "weekly", undefined, TODAY)).toBe(100);
  });

  it("returns 0 for custom with no matching days", () => {
    expect(calculateConsistency30d([], "custom", "[]", TODAY)).toBe(0);
  });
});

// ─── determineStage ──────────────────────────────────────────────────

describe("determineStage", () => {
  it("stays seed when young", () => {
    expect(determineStage(daysAgo(5), "seed", 90, TODAY)).toBe("seed");
  });

  it("seed → growth at 21 days with 70% consistency", () => {
    expect(determineStage(daysAgo(21), "seed", 70, TODAY)).toBe("growth");
  });

  it("stays seed at 21 days with only 60% consistency", () => {
    expect(determineStage(daysAgo(21), "seed", 60, TODAY)).toBe("seed");
  });

  it("growth → autopilot at 60 days with 80% consistency", () => {
    expect(determineStage(daysAgo(60), "growth", 80, TODAY)).toBe("autopilot");
  });

  it("stays growth at 60 days with 75% consistency", () => {
    expect(determineStage(daysAgo(60), "growth", 75, TODAY)).toBe("growth");
  });

  it("regresses growth → seed when consistency < 50", () => {
    expect(determineStage(daysAgo(30), "growth", 40, TODAY)).toBe("seed");
  });

  it("regresses autopilot → growth when consistency < 50", () => {
    expect(determineStage(daysAgo(90), "autopilot", 30, TODAY)).toBe("growth");
  });

  it("does not regress seed", () => {
    expect(determineStage(daysAgo(5), "seed", 20, TODAY)).toBe("seed");
  });

  it("can promote from seed directly (exact boundary)", () => {
    expect(determineStage(daysAgo(21), "seed", 70, TODAY)).toBe("growth");
  });
});

// ─── shouldAutoFreeze ────────────────────────────────────────────────

describe("shouldAutoFreeze", () => {
  it("returns true when yesterday missed and no freezes used", () => {
    // Only today completed, yesterday missed
    const logs = [{ date: daysAgo(0) }];
    expect(shouldAutoFreeze(logs, 0, TODAY)).toBe(true);
  });

  it("returns false when yesterday was completed", () => {
    const logs = [{ date: daysAgo(0) }, { date: daysAgo(1) }];
    expect(shouldAutoFreeze(logs, 0, TODAY)).toBe(false);
  });

  it("returns false when grace period exhausted", () => {
    const logs = [{ date: daysAgo(0) }]; // yesterday missed
    // With default gracePeriod=2, 1 used still allows freeze
    expect(shouldAutoFreeze(logs, 1, TODAY, 2)).toBe(true);
    // But 2 used exhausts the budget
    expect(shouldAutoFreeze(logs, 2, TODAY, 2)).toBe(false);
    // Legacy: gracePeriod=1 with 1 used = exhausted
    expect(shouldAutoFreeze(logs, 1, TODAY, 1)).toBe(false);
  });

  it("returns true with empty logs and no freezes used", () => {
    expect(shouldAutoFreeze([], 0, TODAY)).toBe(true);
  });
});
