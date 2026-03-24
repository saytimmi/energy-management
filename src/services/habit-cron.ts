/**
 * Habit cron jobs — daily maintenance and weekly reset.
 */

import prisma from "../db.js";
import { isOnVacation } from "./awareness.js";
import {
  calculateStreak,
  calculateConsistency30d,
  determineStage,
  shouldAutoFreeze,
  calculateStrength,
} from "./habit-streaks.js";
import { sendMissedDayNudge, sendRoutineReminder } from "../handlers/habits.js";

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

  // Auto-resume vacation for users whose vacationUntil has passed
  try {
    const expiredVacations = await prisma.user.findMany({
      where: { vacationUntil: { lte: today, not: null } },
    });
    for (const user of expiredVacations) {
      await prisma.user.update({
        where: { id: user.id },
        data: { vacationUntil: null, vacationReason: null },
      });
      // Resume their habits
      await prisma.habit.updateMany({
        where: { userId: user.id, isActive: true, pausedAt: { not: null } },
        data: { pausedAt: null, pausedUntil: null },
      });
      console.log(`[habit-cron] Auto-resumed vacation for user ${user.id}`);
    }
  } catch (err) {
    console.error("[habit-cron] Vacation auto-resume failed:", err);
  }

  // Auto-resume paused habits whose pausedUntil has passed
  await prisma.habit.updateMany({
    where: {
      isActive: true,
      pausedUntil: { lte: today },
      pausedAt: { not: null },
    },
    data: { pausedAt: null, pausedUntil: null },
  });

  const habits = await prisma.habit.findMany({
    where: { isActive: true, pausedAt: null },
    include: {
      logs: {
        where: {
          date: {
            gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30),
          },
        },
        select: { date: true, status: true },
      },
    },
  });

  let updated = 0;
  let frozen = 0;

  for (const habit of habits) {
    const logs = habit.logs;
    const completedLogs = logs.filter(l => l.status === "completed" || l.status === "frozen");

    // Auto-freeze check with grace period
    let freezeApplied = false;
    if (shouldAutoFreeze(completedLogs, habit.gracesUsed, today, habit.gracePeriod)) {
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
        data: { gracesUsed: habit.gracesUsed + 1 },
      });

      completedLogs.push({ date: yesterday, status: "frozen" });
      freezeApplied = true;
      frozen++;
    }

    // Check if yesterday was completed
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const yesterdayLog = logs.find(l => {
      const d = new Date(l.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === yKey;
    });
    const completedYesterday = yesterdayLog?.status === "completed";

    // Calculate strength
    const newStrength = calculateStrength(
      habit.strength,
      completedYesterday,
      freezeApplied,
      habit.stage,
    );

    // Recalculate streak & consistency
    const streak = calculateStreak(completedLogs, today);
    const consistency = calculateConsistency30d(
      completedLogs,
      habit.frequency,
      habit.customDays ?? undefined,
      today,
    );
    const newStage = determineStage(habit.createdAt, habit.stage, consistency, today);

    const data: Record<string, unknown> = {
      streakCurrent: streak,
      streakBest: Math.max(habit.streakBest, streak),
      consistency30d: consistency,
      strength: Math.round(newStrength * 10) / 10,
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
      console.log(`[habit-cron] Habit ${habit.id} "${habit.name}": grace freeze applied (${habit.gracesUsed + 1}/${habit.gracePeriod})`);
    }
  }

  // --- Missed-day nudges ---
  let nudgesSent = 0;

  // Re-fetch habits with user relation for telegramId (skip paused)
  const habitsForNudge = await prisma.habit.findMany({
    where: { isActive: true, pausedAt: null },
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
    data: { freezesUsedThisWeek: 0, gracesUsed: 0 },
  });

  console.log(`[habit-cron] Weekly reset done: ${result.count} habits reset`);
}

/**
 * Send routine reminders for a given slot to all users with pending habits.
 */
export async function sendRoutineReminders(slot: "morning" | "afternoon" | "evening"): Promise<void> {
  console.log(`[habit-cron] Sending ${slot} routine reminders`);

  const today = new Date();
  const dow = today.getDay() === 0 ? 7 : today.getDay(); // ISO day-of-week

  const users = await prisma.user.findMany({
    where: {
      habits: {
        some: { isActive: true, routineSlot: slot, pausedAt: null },
      },
    },
    select: {
      id: true,
      telegramId: true,
      habits: {
        where: { isActive: true, routineSlot: slot, pausedAt: null },
        select: { id: true, frequency: true, customDays: true },
      },
    },
  });

  for (const user of users) {
    if (isOnVacation(user as any)) continue;

    // Filter habits scheduled for today
    const scheduledHabits = user.habits.filter(h => {
      if (h.frequency === "daily") return true;
      if (h.frequency === "custom" && h.customDays) {
        try {
          const days: number[] = JSON.parse(h.customDays);
          return days.includes(dow);
        } catch { return true; }
      }
      return true; // "weekly" with targetPerWeek — always show
    });

    if (scheduledHabits.length === 0) continue;

    try {
      await sendRoutineReminder(Number(user.telegramId), user.id, slot);
    } catch (err) {
      console.error(`[habit-cron] Failed to send ${slot} reminder to user ${user.id}:`, err);
    }
  }

  console.log(`[habit-cron] ${slot} reminders sent to ${users.length} user(s)`);
}
