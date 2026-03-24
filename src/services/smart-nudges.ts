/**
 * Smart proactive nudges — daily AI-powered micro-insights.
 * Runs once per morning (9:00), picks the highest priority nudge, sends ONE message.
 * Uses Haiku for cheap analysis when needed, template-based when possible.
 */

import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";
import { InlineKeyboard } from "grammy";
import Anthropic from "@anthropic-ai/sdk";
import { isOnVacation } from "./awareness.js";

// --- Nudge types by priority ---

interface Nudge {
  priority: number; // higher = more important
  text: string;
  keyboard?: InlineKeyboard;
}

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

/**
 * Main entry: analyze each user's data and send the most impactful nudge.
 */
export async function sendDailyNudges(): Promise<void> {
  const users = await prisma.user.findMany();
  console.log(`[smart-nudges] Analyzing ${users.length} user(s)`);

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;
      const nudges = await collectNudges(user.id);
      if (nudges.length === 0) continue;

      // Pick highest priority
      nudges.sort((a, b) => b.priority - a.priority);
      const best = nudges[0];

      const chatId = Number(user.telegramId);
      await bot.api.sendMessage(chatId, best.text, {
        parse_mode: "Markdown",
        ...(best.keyboard ? { reply_markup: best.keyboard } : {}),
      });
    } catch (err) {
      await trackError("smart-nudges", err, { userId: user.id });
    }
  }
}

/**
 * Collect all possible nudges for a user, scored by priority.
 */
async function collectNudges(userId: number): Promise<Nudge[]> {
  const nudges: Nudge[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- 1. Goal-Habit Gap (priority 90) ---
  // User has goals in focus areas but habits aren't being done
  try {
    const focusGoals = await prisma.goal.findMany({
      where: { userId, status: "active" },
    });

    const focusAreas = await prisma.balanceGoal.findMany({
      where: { userId, isFocus: true },
    });
    const focusAreaSet = new Set(focusAreas.map(a => a.area));

    for (const goal of focusGoals) {
      if (!focusAreaSet.has(goal.lifeArea)) continue;

      const habits = await prisma.habit.findMany({
        where: { userId, lifeArea: goal.lifeArea, isActive: true },
      });

      if (habits.length === 0) {
        // Goal exists but NO habits for it
        const areaLabel = AREA_LABELS[goal.lifeArea] || goal.lifeArea;
        nudges.push({
          priority: 90,
          text: `🎯 у тебя цель "${goal.title}" в сфере ${areaLabel}, но пока нет ни одной привычки для неё. хочешь создадим?`,
        });
        break; // one goal-habit gap nudge per day
      }

      // Check if habits have low consistency
      const avgConsistency = habits.reduce((s, h) => s + h.consistency30d, 0) / habits.length;
      if (avgConsistency < 30 && habits.length > 0) {
        const areaLabel = AREA_LABELS[goal.lifeArea] || goal.lifeArea;
        const habitNames = habits.slice(0, 2).map(h => `${h.icon} ${h.name}`).join(", ");
        nudges.push({
          priority: 85,
          text: `🎯 цель "${goal.title}" (${areaLabel}) — привычки (${habitNames}) выполняются на ${Math.round(avgConsistency)}%. может упростить или поменять подход?`,
        });
        break;
      }
    }
  } catch {}

  // --- 2. Energy Pattern Alert (priority 80) ---
  // 3+ days of same energy type below 5
  try {
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const recentLogs = await prisma.energyLog.findMany({
      where: { userId, createdAt: { gte: threeDaysAgo } },
      orderBy: { createdAt: "desc" },
    });

    if (recentLogs.length >= 3) {
      const types = ["physical", "mental", "emotional", "spiritual"] as const;
      const typeLabels: Record<string, string> = {
        physical: "физическая", mental: "ментальная",
        emotional: "эмоциональная", spiritual: "духовная",
      };
      const typeEmoji: Record<string, string> = {
        physical: "🦾", mental: "🧬", emotional: "🫀", spiritual: "🔮",
      };

      for (const t of types) {
        const values = recentLogs.map(l => l[t]);
        const allLow = values.every(v => v <= 4);
        if (allLow && values.length >= 3) {
          const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length * 10) / 10;
          nudges.push({
            priority: 80,
            text: `${typeEmoji[t]} ${typeLabels[t]} энергия ${avg}/10 уже ${values.length} замеров подряд. это паттерн, не случайность — стоит разобраться что забирает силы`,
          });
          break;
        }
      }
    }
  } catch {}

  // --- 3. Streak at Risk (priority 75) ---
  // Important habit (high strength or long streak) about to lose streak
  try {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const habits = await prisma.habit.findMany({
      where: { userId, isActive: true, strength: { gte: 30 } },
      orderBy: { strength: "desc" },
      take: 5,
    });

    for (const habit of habits) {
      // Check if completed yesterday
      const yesterdayLog = await prisma.habitLog.findFirst({
        where: { habitId: habit.id, date: yesterday, status: "completed" },
      });

      if (!yesterdayLog && habit.gracesUsed >= habit.gracePeriod) {
        // Streak will break today if not done
        nudges.push({
          priority: 75,
          text: `🔥 ${habit.icon} ${habit.name} — стрик ${habit.streakCurrent} дней на грани. grace days кончились, сегодня последний шанс`,
        });
        break;
      }
    }
  } catch {}

  // --- 4. Milestone Celebration (priority 70) ---
  // Streak hit 7/21/30/60/90/100
  try {
    const milestones = [7, 21, 30, 60, 90, 100];
    const habits = await prisma.habit.findMany({
      where: { userId, isActive: true },
    });

    for (const habit of habits) {
      if (milestones.includes(habit.streakCurrent)) {
        const emoji = habit.streakCurrent >= 60 ? "🏆" : habit.streakCurrent >= 21 ? "⭐" : "🎉";
        nudges.push({
          priority: 70,
          text: `${emoji} ${habit.icon} ${habit.name} — ${habit.streakCurrent} дней подряд! сила привычки: ${Math.round(habit.strength)}%`,
        });
        break;
      }
    }
  } catch {}

  // --- 5. Weekly Goal Check-in (priority 65, only on Mondays) ---
  try {
    if (today.getDay() === 1) { // Monday
      const activeGoals = await prisma.goal.findMany({
        where: { userId, status: "active", timeHorizon: "quarter" },
        take: 3,
      });

      if (activeGoals.length > 0) {
        const goalList = activeGoals.map(g => {
          const label = AREA_LABELS[g.lifeArea] || g.lifeArea;
          return `${label}: ${g.title}`;
        }).join("\n");

        const kb = new InlineKeyboard();
        for (const g of activeGoals) {
          kb.text(`✅ ${g.title.slice(0, 20)}`, `goal_done:${g.id}`).row();
        }

        nudges.push({
          priority: 65,
          text: `📋 понедельник — как дела с квартальными целями?\n\n${goalList}\n\nесли какая-то выполнена — жми`,
          keyboard: kb,
        });
      }
    }
  } catch {}

  // --- 6. Balance Drift (priority 60) ---
  // Focus area score dropped compared to previous assessment
  try {
    const focusAreas = await prisma.balanceGoal.findMany({
      where: { userId, isFocus: true },
    });

    for (const fa of focusAreas) {
      const ratings = await prisma.balanceRating.findMany({
        where: { userId, area: fa.area },
        orderBy: { createdAt: "desc" },
        take: 2,
      });

      if (ratings.length >= 2) {
        const current = ratings[0].score;
        const previous = ratings[1].score;
        if (current < previous && current <= 5) {
          const label = AREA_LABELS[fa.area] || fa.area;
          nudges.push({
            priority: 60,
            text: `⚖️ ${label} (фокус-сфера) упала с ${previous} до ${current}/10. может стоит обсудить что изменить?`,
          });
          break;
        }
      }
    }
  } catch {}

  // --- 7. AI Insight (priority 50, fallback) ---
  // If no template nudges fired, use Haiku for a creative insight
  if (nudges.length === 0) {
    try {
      const aiNudge = await generateAINudge(userId);
      if (aiNudge) {
        nudges.push({ priority: 50, text: aiNudge });
      }
    } catch {}
  }

  return nudges;
}

/**
 * AI-generated nudge as fallback — uses Haiku for minimal cost.
 */
async function generateAINudge(userId: number): Promise<string | null> {
  try {
    // Gather minimal context
    const latestLog = await prisma.energyLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const habits = await prisma.habit.findMany({
      where: { userId, isActive: true },
      select: { name: true, icon: true, streakCurrent: true, consistency30d: true, stage: true },
      take: 5,
    });

    const mission = await prisma.mission.findUnique({
      where: { userId },
      select: { statement: true },
    });

    if (!latestLog && habits.length === 0) return null;

    const context = JSON.stringify({
      energy: latestLog ? { physical: latestLog.physical, mental: latestLog.mental, emotional: latestLog.emotional, spiritual: latestLog.spiritual } : null,
      habits: habits.map(h => ({ name: h.name, streak: h.streakCurrent, consistency: h.consistency30d, stage: h.stage })),
      mission: mission?.statement || null,
      dayOfWeek: new Date().toLocaleDateString("ru", { weekday: "long" }),
    });

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Ты — тёплый друг-коуч. На основе данных пользователя напиши ОДНО короткое утреннее сообщение (1-2 предложения, как в телеграме, строчными). Не списки, не формальности. Одна конкретная мысль или подбадривание.

Данные: ${context}`,
      }],
    });

    const text = response.content[0];
    return text.type === "text" ? `💡 ${text.text}` : null;
  } catch {
    return null;
  }
}

/**
 * Handle goal completion from inline buttons.
 */
export async function handleGoalCallback(chatId: number, userId: number, data: string): Promise<void> {
  const match = data.match(/^goal_(done|drop):(\d+)$/);
  if (!match) return;

  const [, action, goalIdStr] = match;
  const goalId = parseInt(goalIdStr, 10);

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
  });
  if (!goal) return;

  const newStatus = action === "done" ? "completed" : "dropped";
  await prisma.goal.update({
    where: { id: goalId },
    data: { status: newStatus },
  });

  const areaLabel = AREA_LABELS[goal.lifeArea] || goal.lifeArea;
  const emoji = action === "done" ? "✅" : "❌";
  const statusText = action === "done" ? "выполнена" : "отменена";

  await bot.api.sendMessage(chatId,
    `${emoji} Цель "${goal.title}" (${areaLabel}) — ${statusText}!`,
  );
}
