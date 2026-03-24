/**
 * Pure functions for streak, consistency, stage, and auto-freeze calculations.
 */

/** Strip time portion — return YYYY-MM-DD date string */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Subtract N days from a date (date-only, midnight) */
function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - n);
  return r;
}

/** Day of week 1=Mon … 7=Sun (ISO) */
function isoDow(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

// ─── Streak ──────────────────────────────────────────────────────────

/**
 * Calculate consecutive-day streak counting backward from today.
 * Expects `logs` to contain one entry per completed day.
 */
export function calculateStreak(logs: { date: Date }[], today: Date = new Date()): number {
  if (logs.length === 0) return 0;

  const completed = new Set(logs.map((l) => toDateKey(new Date(l.date))));
  let streak = 0;
  let cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  // If today is not completed, start checking from yesterday
  if (!completed.has(toDateKey(cursor))) {
    cursor = subDays(cursor, 1);
  }

  while (completed.has(toDateKey(cursor))) {
    streak++;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

// ─── Consistency ─────────────────────────────────────────────────────

/**
 * 30-day rolling consistency: completedDays / expectedDays * 100.
 * `frequency`: "daily" | "weekly" | "custom"
 * `customDays`: JSON string like "[1,3,5]" (ISO day-of-week numbers)
 */
export function calculateConsistency30d(
  logs: { date: Date }[],
  frequency: string,
  customDays?: string,
  today: Date = new Date(),
): number {
  const completed = new Set(logs.map((l) => toDateKey(new Date(l.date))));

  let expectedDays = 0;
  let completedDays = 0;

  const parsedCustom: number[] = customDays ? JSON.parse(customDays) : [];

  for (let i = 0; i < 30; i++) {
    const day = subDays(today, i);
    const key = toDateKey(day);
    const dow = isoDow(day);

    let isExpected = false;
    if (frequency === "daily") {
      isExpected = true;
    } else if (frequency === "weekly") {
      // Weekly = once per week, expected on Monday (1)
      isExpected = dow === 1;
    } else if (frequency === "custom") {
      isExpected = parsedCustom.includes(dow);
    }

    if (isExpected) {
      expectedDays++;
      if (completed.has(key)) {
        completedDays++;
      }
    }
  }

  if (expectedDays === 0) return 0;
  return Math.round((completedDays / expectedDays) * 100);
}

/**
 * Weekly target consistency: completions this week / targetPerWeek * 100.
 */
export function calculateWeeklyTargetConsistency(
  logs: { date: Date }[],
  targetPerWeek: number,
  today: Date = new Date(),
): number {
  if (targetPerWeek <= 0) return 0;

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  const dow = todayMidnight.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(todayMidnight);
  weekStart.setDate(weekStart.getDate() - mondayOffset);

  const completedThisWeek = logs.filter(l => {
    const d = new Date(l.date);
    d.setHours(0, 0, 0, 0);
    return d >= weekStart && d <= todayMidnight;
  }).length;

  return Math.min(100, Math.round((completedThisWeek / targetPerWeek) * 100));
}

// ─── Stage transitions ──────────────────────────────────────────────

export type HabitStage = "seed" | "growth" | "autopilot";

const STAGE_ORDER: HabitStage[] = ["seed", "growth", "autopilot"];

/**
 * Determine the lifecycle stage based on age + consistency.
 *
 * Promotion rules:
 *  - seed → growth:    daysSinceCreation >= 21  AND consistency >= 70
 *  - growth → autopilot: daysSinceCreation >= 60  AND consistency >= 80
 *
 * Regression: consistency < 50 → go back one level.
 */
export function determineStage(
  createdAt: Date,
  currentStage: string,
  consistency: number,
  today: Date = new Date(),
): HabitStage {
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const createdMidnight = new Date(createdAt);
  createdMidnight.setHours(0, 0, 0, 0);
  const daysSinceCreation = Math.round(
    (todayMidnight.getTime() - createdMidnight.getTime()) / (1000 * 60 * 60 * 24),
  );

  const idx = STAGE_ORDER.indexOf(currentStage as HabitStage);
  let stage = (idx >= 0 ? currentStage : "seed") as HabitStage;

  // Regression first
  if (consistency < 50 && idx > 0) {
    return STAGE_ORDER[idx - 1];
  }

  // Promotion
  if (stage === "seed" && daysSinceCreation >= 21 && consistency >= 70) {
    stage = "growth";
  }
  if (stage === "growth" && daysSinceCreation >= 60 && consistency >= 80) {
    stage = "autopilot";
  }

  return stage;
}

// ─── Auto-freeze (grace period) ─────────────────────────────────────

/**
 * Should we auto-freeze? True when:
 *  - yesterday was NOT completed
 *  - fewer than gracePeriod freezes used this week
 */
export function shouldAutoFreeze(
  logs: { date: Date }[],
  freezesUsedThisWeek: number,
  today: Date = new Date(),
  gracePeriod: number = 2,
): boolean {
  if (freezesUsedThisWeek >= gracePeriod) return false;

  const yesterday = subDays(today, 1);
  const yesterdayKey = toDateKey(yesterday);
  const completed = new Set(logs.map((l) => toDateKey(new Date(l.date))));

  return !completed.has(yesterdayKey);
}

// ─── Habit Strength ─────────────────────────────────────────────────

/**
 * Calculate "habit strength" (0-100) — a forgiving metric that grows
 * slowly with consistency and decays gently on misses.
 *
 * Rules:
 *  - Completed day: +3 (seed), +2 (growth), +1.5 (autopilot)
 *  - Missed day: -5 (seed), -3 (growth), -2 (autopilot)
 *  - Frozen/skipped day: no change
 *  - Clamped to 0-100
 */
export function calculateStrength(
  currentStrength: number,
  completedToday: boolean,
  wasFrozen: boolean,
  stage: string,
): number {
  if (wasFrozen) return currentStrength; // grace day — no change

  const gains: Record<string, number> = { seed: 3, growth: 2, autopilot: 1.5 };
  const losses: Record<string, number> = { seed: -5, growth: -3, autopilot: -2 };

  const delta = completedToday
    ? (gains[stage] ?? 2)
    : (losses[stage] ?? -3);

  return Math.max(0, Math.min(100, currentStrength + delta));
}
