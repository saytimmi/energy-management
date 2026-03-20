/**
 * Habit-energy correlation: compares energy levels on days
 * when a habit was completed vs days without.
 */

import prisma from "../db.js";

export interface EnergyCorrelation {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
}

/**
 * Calculate how a habit correlates with energy levels.
 * Returns delta (with_habit - without_habit) per energy type,
 * or null if insufficient data (< 14 days).
 */
export async function getHabitEnergyCorrelation(
  habitId: number,
  userId: number,
): Promise<EnergyCorrelation | null> {
  // Get all completed habit log dates
  const habitLogs = await prisma.habitLog.findMany({
    where: { habitId, userId, status: "completed" },
    select: { date: true },
  });

  if (habitLogs.length < 7) return null;

  // Get all energy logs for this user
  const energyLogs = await prisma.energyLog.findMany({
    where: { userId },
    select: {
      physical: true,
      mental: true,
      emotional: true,
      spiritual: true,
      createdAt: true,
    },
  });

  if (energyLogs.length < 14) return null;

  // Build set of dates when habit was completed (YYYY-MM-DD)
  const habitDates = new Set(
    habitLogs.map((l) => formatDateKey(l.date)),
  );

  // Split energy logs into two groups
  const withHabit: { physical: number; mental: number; emotional: number; spiritual: number }[] = [];
  const withoutHabit: typeof withHabit = [];

  for (const log of energyLogs) {
    const key = formatDateKey(log.createdAt);
    if (habitDates.has(key)) {
      withHabit.push(log);
    } else {
      withoutHabit.push(log);
    }
  }

  // Need at least 5 entries in each group for meaningful comparison
  if (withHabit.length < 5 || withoutHabit.length < 5) return null;

  const avgWith = averageEnergy(withHabit);
  const avgWithout = averageEnergy(withoutHabit);

  return {
    physical: round(avgWith.physical - avgWithout.physical),
    mental: round(avgWith.mental - avgWithout.mental),
    emotional: round(avgWith.emotional - avgWithout.emotional),
    spiritual: round(avgWith.spiritual - avgWithout.spiritual),
  };
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function averageEnergy(
  logs: { physical: number; mental: number; emotional: number; spiritual: number }[],
) {
  const sum = { physical: 0, mental: 0, emotional: 0, spiritual: 0 };
  for (const l of logs) {
    sum.physical += l.physical;
    sum.mental += l.mental;
    sum.emotional += l.emotional;
    sum.spiritual += l.spiritual;
  }
  const n = logs.length;
  return {
    physical: sum.physical / n,
    mental: sum.mental / n,
    emotional: sum.emotional / n,
    spiritual: sum.spiritual / n,
  };
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
