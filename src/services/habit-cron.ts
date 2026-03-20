/**
 * Habit cron jobs — daily maintenance and weekly reset.
 */

import prisma from "../db.js";
import {
  calculateStreak,
  calculateConsistency30d,
  determineStage,
  shouldAutoFreeze,
} from "./habit-streaks.js";

/**
 * Daily cron (midnight): recalculate consistency, check stage transitions,
 * apply auto-freeze when applicable.
 */
export async function runDailyHabitCron(): Promise<void> {
  const today = new Date();
  console.log(`[habit-cron] Daily run started at ${today.toISOString()}`);

  const habits = await prisma.habit.findMany({
    where: { isActive: true },
    include: {
      logs: {
        where: {
          date: {
            gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30),
          },
        },
        select: { date: true },
      },
    },
  });

  let updated = 0;
  let frozen = 0;

  for (const habit of habits) {
    const logs = habit.logs;

    // Auto-freeze check — must run before streak calc so the freeze
    // can preserve the streak by inserting a "frozen" log for yesterday.
    let freezeApplied = false;
    if (shouldAutoFreeze(logs, habit.freezesUsedThisWeek, today)) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await prisma.habitLog.create({
        data: {
          habitId: habit.id,
          userId: habit.userId,
          date: yesterday,
          status: "frozen",
        },
      });
      await prisma.habit.update({
        where: { id: habit.id },
        data: { freezesUsedThisWeek: habit.freezesUsedThisWeek + 1 },
      });

      // Add the frozen day to logs for streak calculation
      logs.push({ date: yesterday });
      freezeApplied = true;
      frozen++;
    }

    // Recalculate
    const streak = calculateStreak(logs, today);
    const consistency = calculateConsistency30d(
      logs,
      habit.frequency,
      habit.customDays ?? undefined,
      today,
    );
    const newStage = determineStage(habit.createdAt, habit.stage, consistency, today);

    const data: Record<string, unknown> = {
      streakCurrent: streak,
      streakBest: Math.max(habit.streakBest, streak),
      consistency30d: consistency,
    };

    if (newStage !== habit.stage) {
      data.stage = newStage;
      data.stageUpdatedAt = today;
      console.log(`[habit-cron] Habit ${habit.id} "${habit.name}": ${habit.stage} → ${newStage}`);
    }

    await prisma.habit.update({
      where: { id: habit.id },
      data,
    });

    updated++;

    if (freezeApplied) {
      console.log(`[habit-cron] Habit ${habit.id} "${habit.name}": auto-freeze applied`);
    }
  }

  console.log(
    `[habit-cron] Daily run done: ${updated} habits updated, ${frozen} auto-freezes applied`,
  );
}

/**
 * Weekly cron (Monday 00:00): reset weekly freeze counter.
 */
export async function runWeeklyHabitReset(): Promise<void> {
  console.log(`[habit-cron] Weekly reset started at ${new Date().toISOString()}`);

  const result = await prisma.habit.updateMany({
    where: { isActive: true },
    data: { freezesUsedThisWeek: 0 },
  });

  console.log(`[habit-cron] Weekly reset done: ${result.count} habits reset`);
}
