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
import { sendMissedDayNudge } from "../handlers/habits.js";

/**
 * Phase D intelligence: compute median completion hour for a user's habits
 * in a given routine slot. Ready to be activated when per-user scheduling is built.
 *
 * Returns the median hour (0-23), or null if fewer than 14 logs exist.
 */
export async function getMedianCompletionHour(
  userId: number,
  routineSlot: string,
): Promise<number | null> {
  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true, routineSlot },
    select: { id: true },
  });

  if (habits.length === 0) return null;

  const habitIds = habits.map((h) => h.id);

  const logs = await prisma.habitLog.findMany({
    where: {
      habitId: { in: habitIds },
      status: "completed",
    },
    select: { completedAt: true },
    orderBy: { completedAt: "asc" },
  });

  if (logs.length < 14) return null;

  const hours = logs.map((l) => l.completedAt.getHours()).sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);

  return hours.length % 2 === 0
    ? Math.round((hours[mid - 1] + hours[mid]) / 2)
    : hours[mid];
}

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

  // --- Missed-day nudges ---
  let nudgesSent = 0;

  // Re-fetch habits with user relation for telegramId
  const habitsForNudge = await prisma.habit.findMany({
    where: { isActive: true },
    include: {
      user: { select: { telegramId: true } },
      logs: {
        where: {
          date: {
            gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5),
          },
        },
        select: { date: true },
        orderBy: { date: "desc" },
      },
    },
  });

  for (const habit of habitsForNudge) {
    // Determine missed-day threshold based on stage:
    // seed=1 (fragile, nudge quickly), growth=2, autopilot=5
    const missedThreshold = habit.stage === "seed" ? 1 : habit.stage === "autopilot" ? 5 : 2;

    // Count consecutive missed days from yesterday backwards
    let missedDays = 0;
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1); // start from yesterday

    for (let i = 0; i < missedThreshold; i++) {
      const found = habit.logs.some(
        (l) => l.date.toDateString() === checkDate.toDateString(),
      );
      if (!found) {
        missedDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    if (missedDays >= missedThreshold) {
      const chatId = Number(habit.user.telegramId);
      try {
        await sendMissedDayNudge(chatId, {
          id: habit.id,
          name: habit.name,
          icon: habit.icon,
          type: habit.type,
          whyToday: habit.whyToday,
          whyYear: habit.whyYear,
          isItBeneficial: habit.isItBeneficial,
          breakTrigger: habit.breakTrigger,
          replacement: habit.replacement,
        });
        nudgesSent++;
      } catch (err) {
        console.error(`[habit-cron] Failed to nudge habit ${habit.id}:`, err);
      }
    }
  }

  console.log(
    `[habit-cron] Daily run done: ${updated} habits updated, ${frozen} auto-freezes applied, ${nudgesSent} nudges sent`,
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
