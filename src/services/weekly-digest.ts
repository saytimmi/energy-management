/**
 * Weekly digest: analyze energy patterns from observations,
 * find recurring triggers, and suggest habits to fix them.
 * Runs every Sunday evening, sends results via Telegram bot.
 */

import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";
import { InlineKeyboard } from "grammy";
import { getHabitEnergyCorrelation } from "./habit-correlation.js";
import Anthropic from "@anthropic-ai/sdk";
import { isOnVacation } from "./awareness.js";

// --- Types ---

interface TriggerPattern {
  trigger: string;
  count: number;
  energyTypes: string[];
  direction: string;
  details: string[]; // specific user-described situations
}

interface HabitInsight {
  name: string;
  icon: string;
  consistency: number;
  stage: string;
  strength: number;
  streak: number;
  delta?: Record<string, number>;
}

interface WeeklyInsight {
  topDropTriggers: TriggerPattern[];
  topRiseTriggers: TriggerPattern[];
  energyTrend: Record<string, { thisWeek: number; lastWeek: number; delta: number }>;
  worstDay: string | null;
  bestDay: string | null;
  totalCheckins: number;
  habitSuggestions: HabitSuggestion[];
  correlations: HabitInsight[];
  habits: Array<{ name: string; icon: string; consistency: number; stage: string; strength: number; streak: number }>;
  goalsProgress: { lifeArea: string; title: string; timeHorizon: string; period: string }[];
  focusAreas: { area: string; score: number | null; identity: string | null }[];
}

interface HabitSuggestion {
  trigger: string;
  habitName: string;
  habitIcon: string;
  habitType: "build" | "break";
  routineSlot: string;
  reason: string;
}

// --- Trigger → Habit mapping ---

const TRIGGER_TO_HABIT: Record<string, Omit<HabitSuggestion, "trigger" | "reason">> = {
  // Physical drop triggers
  "Плохой сон": { habitName: "Сон до 23:00", habitIcon: "🌙", habitType: "build", routineSlot: "evening" },
  "Не спал": { habitName: "Сон минимум 6 часов", habitIcon: "😴", habitType: "build", routineSlot: "evening" },
  "Нет движения": { habitName: "30 мин движения", habitIcon: "🚶", habitType: "build", routineSlot: "morning" },
  "Плохая еда": { habitName: "Здоровый обед", habitIcon: "🥗", habitType: "build", routineSlot: "afternoon" },
  "Устал": { habitName: "Перерыв каждые 90 мин", habitIcon: "⏸️", habitType: "build", routineSlot: "afternoon" },
  "Алкоголь": { habitName: "Без алкоголя", habitIcon: "🚫", habitType: "break", routineSlot: "evening" },
  "Голод": { habitName: "Завтрак в первый час", habitIcon: "🍳", habitType: "build", routineSlot: "morning" },
  "Перетренировка": { habitName: "День восстановления", habitIcon: "🧘", habitType: "build", routineSlot: "morning" },
  // Mental drop triggers
  "Долго за экраном": { habitName: "Перерыв от экрана", habitIcon: "👀", habitType: "build", routineSlot: "afternoon" },
  "Много задач": { habitName: "3 главные задачи на день", habitIcon: "📋", habitType: "build", routineSlot: "morning" },
  "Нет фокуса": { habitName: "25 мин фокус-блок", habitIcon: "🎯", habitType: "build", routineSlot: "morning" },
  "Выгорание": { habitName: "Час без работы", habitIcon: "🌿", habitType: "build", routineSlot: "evening" },
  "Инфо-перегрузка": { habitName: "Без новостей до обеда", habitIcon: "📵", habitType: "break", routineSlot: "morning" },
  // Emotional drop triggers
  "Стресс": { habitName: "5 мин дыхание", habitIcon: "🫁", habitType: "build", routineSlot: "afternoon" },
  "Одиночество": { habitName: "Написать близкому", habitIcon: "💬", habitType: "build", routineSlot: "evening" },
  "Конфликт": { habitName: "Дневник эмоций", habitIcon: "📝", habitType: "build", routineSlot: "evening" },
  "Тревога": { habitName: "5 мин медитация", habitIcon: "🧘", habitType: "build", routineSlot: "morning" },
  // Spiritual drop triggers
  "Рутина": { habitName: "Новое действие в день", habitIcon: "✨", habitType: "build", routineSlot: "afternoon" },
  "Нет прогресса": { habitName: "Дневник благодарности", habitIcon: "🙏", habitType: "build", routineSlot: "evening" },
  "Потеря смысла": { habitName: "10 мин рефлексия", habitIcon: "🪞", habitType: "build", routineSlot: "evening" },
};

const ENERGY_LABELS: Record<string, string> = {
  physical: "физическая",
  mental: "ментальная",
  emotional: "эмоциональная",
  spiritual: "духовная",
};

const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// --- Analysis ---

async function analyzeWeeklyPatterns(userId: number): Promise<WeeklyInsight | null> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get this week's observations
  const observations = await prisma.observation.findMany({
    where: { userId, createdAt: { gte: oneWeekAgo } },
    orderBy: { createdAt: "desc" },
  });

  // Get energy logs for this week and last week
  const thisWeekLogs = await prisma.energyLog.findMany({
    where: { userId, createdAt: { gte: oneWeekAgo } },
    orderBy: { createdAt: "asc" },
  });

  const lastWeekLogs = await prisma.energyLog.findMany({
    where: { userId, createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
  });

  if (thisWeekLogs.length < 2) return null; // Not enough data

  // --- Count trigger frequencies + collect details ---
  const triggerCounts = new Map<string, { count: number; energyTypes: Set<string>; direction: string; details: string[] }>();

  for (const obs of observations) {
    if (!obs.trigger) continue;
    const key = `${obs.trigger}:${obs.direction}`;
    const existing = triggerCounts.get(key);
    if (existing) {
      existing.count++;
      existing.energyTypes.add(obs.energyType);
      if (obs.context) existing.details.push(obs.context);
    } else {
      triggerCounts.set(key, {
        count: 1,
        energyTypes: new Set([obs.energyType]),
        direction: obs.direction,
        details: obs.context ? [obs.context] : [],
      });
    }
  }

  // Split into drop and rise patterns
  const dropPatterns: TriggerPattern[] = [];
  const risePatterns: TriggerPattern[] = [];

  for (const [key, data] of triggerCounts) {
    const trigger = key.split(":")[0];
    const pattern: TriggerPattern = {
      trigger,
      count: data.count,
      energyTypes: [...data.energyTypes],
      direction: data.direction,
      details: data.details,
    };

    if (data.direction === "rise") {
      risePatterns.push(pattern);
    } else {
      dropPatterns.push(pattern);
    }
  }

  // Sort by frequency
  dropPatterns.sort((a, b) => b.count - a.count);
  risePatterns.sort((a, b) => b.count - a.count);

  // --- Energy trend (this week vs last week) ---
  const trend: Record<string, { thisWeek: number; lastWeek: number; delta: number }> = {};
  const types = ["physical", "mental", "emotional", "spiritual"] as const;

  for (const type of types) {
    const thisAvg = thisWeekLogs.length > 0
      ? thisWeekLogs.reduce((s, l) => s + l[type], 0) / thisWeekLogs.length
      : 0;
    const lastAvg = lastWeekLogs.length > 0
      ? lastWeekLogs.reduce((s, l) => s + l[type], 0) / lastWeekLogs.length
      : thisAvg;

    trend[type] = {
      thisWeek: Math.round(thisAvg * 10) / 10,
      lastWeek: Math.round(lastAvg * 10) / 10,
      delta: Math.round((thisAvg - lastAvg) * 10) / 10,
    };
  }

  // --- Best/worst day ---
  const dayScores = new Map<string, number[]>();
  for (const log of thisWeekLogs) {
    const dayName = DAY_NAMES[log.createdAt.getDay()];
    const total = log.physical + log.mental + log.emotional + log.spiritual;
    const existing = dayScores.get(dayName) || [];
    existing.push(total);
    dayScores.set(dayName, existing);
  }

  let worstDay: string | null = null;
  let bestDay: string | null = null;
  let worstScore = Infinity;
  let bestScore = -Infinity;

  for (const [day, scores] of dayScores) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < worstScore) { worstScore = avg; worstDay = day; }
    if (avg > bestScore) { bestScore = avg; bestDay = day; }
  }

  // --- Generate habit suggestions from recurring triggers ---
  const habitSuggestions: HabitSuggestion[] = [];

  // Only suggest for triggers that appeared 2+ times
  const existingHabits = await prisma.habit.findMany({
    where: { userId, isActive: true },
    select: { name: true },
  });
  const existingNames = new Set(existingHabits.map(h => h.name.toLowerCase()));

  for (const pattern of dropPatterns) {
    if (pattern.count < 2) continue;
    const habitTemplate = TRIGGER_TO_HABIT[pattern.trigger];
    if (!habitTemplate) continue;
    if (existingNames.has(habitTemplate.habitName.toLowerCase())) continue;

    const energyLabel = pattern.energyTypes.map(t => ENERGY_LABELS[t] || t).join(", ");
    habitSuggestions.push({
      trigger: pattern.trigger,
      ...habitTemplate,
      reason: `"${pattern.trigger}" появилось ${pattern.count} раз за неделю (${energyLabel})`,
    });
  }

  // --- Habit-energy correlations ---
  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true, pausedAt: null },
    select: { id: true, name: true, icon: true, consistency30d: true, stage: true, strength: true, streakCurrent: true },
  });

  const correlations: Array<{ name: string; icon: string; consistency: number; stage: string; strength: number; streak: number; delta: Record<string, number> }> = [];
  for (const h of habits) {
    const corr = await getHabitEnergyCorrelation(h.id, userId);
    if (corr) {
      correlations.push({
        name: h.name,
        icon: h.icon,
        consistency: h.consistency30d,
        stage: h.stage,
        strength: h.strength,
        streak: h.streakCurrent,
        delta: { physical: corr.physical, mental: corr.mental, emotional: corr.emotional, spiritual: corr.spiritual },
      });
    }
  }

  // --- Goals progress ---
  const activeGoals = await prisma.goal.findMany({
    where: { userId, status: "active" },
    orderBy: [{ timeHorizon: "asc" }, { lifeArea: "asc" }],
  });

  const goalsProgress = activeGoals.map(g => ({
    lifeArea: g.lifeArea,
    title: g.title,
    timeHorizon: g.timeHorizon,
    period: g.period,
  }));

  // --- Focus areas with balance scores ---
  let focusAreas: { area: string; score: number | null; identity: string | null }[] = [];
  try {
    const balanceGoals = await prisma.balanceGoal.findMany({
      where: { userId, isFocus: true },
    });
    focusAreas = await Promise.all(balanceGoals.map(async (bg) => {
      const latest = await prisma.balanceRating.findFirst({
        where: { userId, area: bg.area },
        orderBy: { createdAt: "desc" },
        select: { score: true },
      });
      return { area: bg.area, score: latest?.score ?? null, identity: bg.identity };
    }));
  } catch {}

  return {
    topDropTriggers: dropPatterns.slice(0, 5),
    topRiseTriggers: risePatterns.slice(0, 3),
    energyTrend: trend,
    worstDay,
    bestDay,
    totalCheckins: thisWeekLogs.length,
    habitSuggestions: habitSuggestions.slice(0, 3),
    correlations,
    habits: habits.map(h => ({ name: h.name, icon: h.icon, consistency: h.consistency30d, stage: h.stage, strength: h.strength, streak: h.streakCurrent })),
    goalsProgress,
    focusAreas,
  };
}

// --- AI Insights ---

async function generateAIInsights(insight: WeeklyInsight): Promise<string | null> {
  try {
    const anthropic = new Anthropic();

    const dataContext = JSON.stringify({
      energyTrend: insight.energyTrend,
      bestDay: insight.bestDay,
      worstDay: insight.worstDay,
      topDrops: insight.topDropTriggers.slice(0, 3).map(t => ({ trigger: t.trigger, count: t.count, types: t.energyTypes })),
      topRises: insight.topRiseTriggers.slice(0, 3).map(t => ({ trigger: t.trigger, count: t.count })),
      habits: insight.habits,
      correlations: insight.correlations.map(c => ({
        name: c.name, icon: c.icon, consistency: c.consistency,
        stage: c.stage, strength: c.strength,
        energyDelta: c.delta,
      })),
      goals: insight.goalsProgress,
      focusAreas: insight.focusAreas,
    });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Ты — аналитик энергии. Проанализируй недельные данные и выдай 2-3 коротких инсайта с конкретными числами.

Данные: ${dataContext}

Формат: каждый инсайт на отдельной строке, начинается с эмодзи. Максимум 3 строки. Пиши по-русски, кратко, как друг в Telegram. Без заголовков, без списков. Если есть корреляция привычка↔энергия с дельтой > 0.5 — упомяни обязательно. Если привычка близка к переходу на следующий stage — упомяни.`,
      }],
    });

    const text = response.content[0];
    return text.type === "text" ? text.text : null;
  } catch (err) {
    console.error("[weekly-digest] AI insights generation failed:", err);
    return null;
  }
}

// --- Format & Send ---

async function formatDigestMessage(insight: WeeklyInsight): Promise<string> {
  const lines: string[] = ["📊 *Недельный дайджест энергии*\n"];

  // Energy trend
  lines.push("*Тренды:*");
  for (const [type, data] of Object.entries(insight.energyTrend)) {
    const emoji = { physical: "💪", mental: "🧠", emotional: "❤️", spiritual: "✨" }[type] || "•";
    const arrow = data.delta > 0 ? "↑" : data.delta < 0 ? "↓" : "→";
    const deltaStr = data.delta > 0 ? `+${data.delta}` : `${data.delta}`;
    lines.push(`${emoji} ${data.thisWeek}/10 (${arrow}${deltaStr} vs прошлая)`);
  }

  // Best/worst days
  if (insight.bestDay && insight.worstDay && insight.bestDay !== insight.worstDay) {
    lines.push(`\n📅 Лучший день: ${insight.bestDay} | Худший: ${insight.worstDay}`);
  }

  // Drop patterns with details
  if (insight.topDropTriggers.length > 0) {
    lines.push("\n*🔻 Что роняет энергию:*");
    for (const p of insight.topDropTriggers) {
      const types = p.energyTypes.map(t => ENERGY_LABELS[t] || t).join(", ");
      lines.push(`— *${p.trigger}* — ${p.count}× (${types})`);
      // Show unique details (specific situations)
      if (p.details.length > 0) {
        const unique = [...new Set(p.details)].slice(0, 3);
        for (const d of unique) {
          lines.push(`   ↳ _${d}_`);
        }
      }
    }
  }

  // Rise patterns with details
  if (insight.topRiseTriggers.length > 0) {
    lines.push("\n*🔺 Что поднимает:*");
    for (const p of insight.topRiseTriggers) {
      lines.push(`— *${p.trigger}* — ${p.count}×`);
      if (p.details.length > 0) {
        const unique = [...new Set(p.details)].slice(0, 3);
        for (const d of unique) {
          lines.push(`   ↳ _${d}_`);
        }
      }
    }
  }

  // Habit suggestions
  if (insight.habitSuggestions.length > 0) {
    lines.push("\n*💡 Привычки на основе паттернов:*");
    for (const s of insight.habitSuggestions) {
      lines.push(`${s.habitIcon} ${s.habitName}`);
      lines.push(`   ↳ ${s.reason}`);
    }
  }

  // AI Insights with correlations
  const aiInsights = await generateAIInsights(insight);
  if (aiInsights) {
    lines.push("\n*🤖 AI-анализ:*");
    lines.push(aiInsights);
  }

  // Habit strength summary
  if (insight.habits.length > 0) {
    const growing = insight.habits.filter(h => h.strength >= 50);
    if (growing.length > 0) {
      lines.push("\n*💪 Сила привычек:*");
      for (const h of growing.sort((a, b) => b.strength - a.strength).slice(0, 3)) {
        const bar = strengthBar(h.strength);
        lines.push(`${h.icon} ${h.name} ${bar} ${Math.round(h.strength)}%`);
      }
    }
  }

  // Goals progress
  if (insight.goalsProgress.length > 0) {
    const AREA_LABELS: Record<string, string> = {
      health: "Здоровье", career: "Карьера", relationships: "Отношения",
      finances: "Финансы", family: "Семья", growth: "Развитие",
      recreation: "Отдых", environment: "Среда",
    };
    lines.push("\n*🎯 Цели:*");
    for (const g of insight.goalsProgress.slice(0, 5)) {
      const areaLabel = AREA_LABELS[g.lifeArea] || g.lifeArea;
      const horizonLabel = g.timeHorizon === "year" ? "Год" : "Квартал";
      lines.push(`— ${areaLabel} (${horizonLabel}): ${g.title}`);
    }
  }

  // Focus areas
  if (insight.focusAreas.length > 0) {
    const AREA_LABELS: Record<string, string> = {
      health: "Здоровье", career: "Карьера", relationships: "Отношения",
      finances: "Финансы", family: "Семья", growth: "Развитие",
      recreation: "Отдых", environment: "Среда",
    };
    lines.push("\n*⚖️ Фокус-сферы:*");
    for (const fa of insight.focusAreas) {
      const areaLabel = AREA_LABELS[fa.area] || fa.area;
      const score = fa.score !== null ? `${fa.score}/10` : "?";
      lines.push(`— ${areaLabel}: ${score}${fa.identity ? ` (${fa.identity})` : ""}`);
    }
  }

  lines.push(`\n_${insight.totalCheckins} чекинов за неделю_`);

  return lines.join("\n");
}

function strengthBar(strength: number): string {
  const filled = Math.round(strength / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

// --- Create habit from suggestion ---

export async function createHabitFromSuggestion(
  userId: number,
  suggestion: HabitSuggestion,
): Promise<number> {
  const maxOrder = await prisma.habit.findFirst({
    where: { userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const habit = await prisma.habit.create({
    data: {
      userId,
      name: suggestion.habitName,
      icon: suggestion.habitIcon,
      type: suggestion.habitType,
      routineSlot: suggestion.routineSlot,
      sortOrder: (maxOrder?.sortOrder ?? 0) + 1,
      whyToday: `Паттерн: "${suggestion.trigger}" регулярно снижает энергию`,
    },
  });

  return habit.id;
}

// --- Callback handling ---

// Store suggestions temporarily for callback resolution
const pendingDigestSuggestions = new Map<number, HabitSuggestion[]>();

export async function handleDigestCallback(ctx: any, data: string): Promise<void> {
  // Format: digest_habit:<index> or digest_habit_all
  const from = ctx.from;
  if (!from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(from.id) },
  });
  if (!user) return;

  const suggestions = pendingDigestSuggestions.get(from.id);
  if (!suggestions || suggestions.length === 0) {
    await ctx.answerCallbackQuery({ text: "Предложения устарели" });
    return;
  }

  if (data === "digest_habit_all") {
    // Create all suggested habits
    let created = 0;
    for (const s of suggestions) {
      try {
        await createHabitFromSuggestion(user.id, s);
        created++;
      } catch {}
    }
    await ctx.answerCallbackQuery({ text: `Создал ${created} привычек!` });
    pendingDigestSuggestions.delete(from.id);

    try {
      const names = suggestions.map(s => `${s.habitIcon} ${s.habitName}`).join("\n");
      await ctx.editMessageText(
        ctx.callbackQuery?.message?.text + `\n\n✅ Создано ${created} привычек:\n${names}`,
        { parse_mode: "Markdown" },
      );
    } catch {
      // If Markdown fails, try without
      try {
        const names = suggestions.map(s => `${s.habitIcon} ${s.habitName}`).join("\n");
        await ctx.editMessageText(
          (ctx.callbackQuery?.message?.text || "") + `\n\n✅ Создано ${created} привычек:\n${names}`,
        );
      } catch {}
    }
    return;
  }

  // Single habit: digest_habit:<index>
  const idx = parseInt(data.replace("digest_habit:", ""), 10);
  if (isNaN(idx) || idx >= suggestions.length) {
    await ctx.answerCallbackQuery({ text: "Неверный индекс" });
    return;
  }

  const suggestion = suggestions[idx];
  try {
    await createHabitFromSuggestion(user.id, suggestion);
    await ctx.answerCallbackQuery({ text: `✅ ${suggestion.habitName} создана!` });

    // Remove from pending
    suggestions.splice(idx, 1);
    if (suggestions.length === 0) {
      pendingDigestSuggestions.delete(from.id);
    }
  } catch (err) {
    await ctx.answerCallbackQuery({ text: "Ошибка создания" });
  }
}

// --- Main: send weekly digest to all users ---

export async function sendWeeklyDigest(): Promise<void> {
  const users = await prisma.user.findMany();

  console.log(`Sending weekly digest to ${users.length} user(s)`);

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;
      const insight = await analyzeWeeklyPatterns(user.id);
      if (!insight) continue; // Not enough data

      const text = await formatDigestMessage(insight);
      const chatId = Number(user.telegramId);

      // Save digest to DB
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const wDay = weekStart.getDay();
      const mondayOffset = wDay === 0 ? 6 : wDay - 1;
      weekStart.setDate(weekStart.getDate() - mondayOffset);

      try {
        await prisma.weeklyDigest.upsert({
          where: {
            userId_weekStart: { userId: user.id, weekStart },
          },
          create: {
            userId: user.id,
            weekStart,
            content: insight as any,
            summary: text,
          },
          update: {
            content: insight as any,
            summary: text,
          },
        });
      } catch (err) {
        console.error(`[weekly-digest] Failed to save digest for user ${user.id}:`, err);
      }

      // Build keyboard with habit suggestions
      const keyboard = new InlineKeyboard();

      if (insight.habitSuggestions.length > 0) {
        // Store suggestions for callback
        pendingDigestSuggestions.set(chatId, [...insight.habitSuggestions]);

        for (let i = 0; i < insight.habitSuggestions.length; i++) {
          const s = insight.habitSuggestions[i];
          keyboard.text(`${s.habitIcon} Создать "${s.habitName}"`, `digest_habit:${i}`);
          keyboard.row();
        }

        if (insight.habitSuggestions.length > 1) {
          keyboard.text("✅ Создать все", "digest_habit_all");
          keyboard.row();
        }
      }

      await bot.api.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: insight.habitSuggestions.length > 0 ? keyboard : undefined,
      });

    } catch (err) {
      await trackError("weekly-digest", err, { userId: user.id });
      console.error(`Weekly digest failed for user ${user.id}:`, err);
    }
  }
}
