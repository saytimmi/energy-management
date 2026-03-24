/**
 * Bot handlers for habit completion via inline buttons and nudge messages.
 * "Meaning mirror" — reflects user's own words back to motivate.
 */

import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import prisma from "../db.js";
import { bot } from "../bot.js";

// Daily message limit per telegramId (max 3 habit messages/day)
const dailyMessageCount = new Map<number, number>();
const MAX_DAILY_MESSAGES = 3;

// Reset daily counters at midnight
let lastResetDate = new Date().toDateString();

function checkAndIncrementLimit(telegramId: number): boolean {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyMessageCount.clear();
    lastResetDate = today;
  }
  const count = dailyMessageCount.get(telegramId) ?? 0;
  if (count >= MAX_DAILY_MESSAGES) return false;
  dailyMessageCount.set(telegramId, count + 1);
  return true;
}

/**
 * Callback handler for habit_complete:, habit_skip:, and habit_later: buttons.
 */
export async function handleHabitCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  if (data.startsWith("habit_complete:")) {
    const habitId = parseInt(data.replace("habit_complete:", ""), 10);
    if (isNaN(habitId)) return;

    const from = ctx.from;
    if (!from) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });
    if (!user) {
      await ctx.answerCallbackQuery({ text: "Профиль не найден" });
      return;
    }

    const habit = await prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit || habit.userId !== user.id) {
      await ctx.answerCallbackQuery({ text: "Привычка не найдена" });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date: today } },
      create: {
        habitId,
        userId: user.id,
        date: today,
        status: "completed",
      },
      update: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    const logs = await prisma.habitLog.findMany({
      where: {
        habitId,
        date: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30) },
      },
      select: { date: true },
      orderBy: { date: "desc" },
    });

    let streak = 0;
    const check = new Date(today);
    for (let i = 0; i < 60; i++) {
      const found = logs.some(
        (l) => l.date.toDateString() === check.toDateString(),
      );
      if (found) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    await prisma.habit.update({
      where: { id: habitId },
      data: {
        streakCurrent: streak,
        streakBest: Math.max(habit.streakBest, streak),
      },
    });

    const streakText = streak > 1 ? ` 🔥${streak}` : "";
    await ctx.answerCallbackQuery({ text: `✅ ${habit.name}${streakText}` });

    try {
      const originalText = ctx.callbackQuery?.message?.text ?? "";
      await ctx.editMessageText(
        originalText + `\n\n✅ ${habit.icon} ${habit.name}${streakText}`,
      );
    } catch {}

  } else if (data.startsWith("habit_skip:")) {
    const habitId = parseInt(data.replace("habit_skip:", ""), 10);
    if (isNaN(habitId)) return;

    // Use a grace day — create a "frozen" log so streak is preserved
    const from = ctx.from;
    if (!from) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });
    if (!user) {
      await ctx.answerCallbackQuery({ text: "Не сегодня ⏭" });
      return;
    }

    const habit = await prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit || habit.userId !== user.id) {
      await ctx.answerCallbackQuery({ text: "⏭" });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Insert a frozen log if grace budget allows
    if (habit.gracesUsed < habit.gracePeriod) {
      await prisma.habitLog.upsert({
        where: { habitId_date: { habitId, date: today } },
        create: { habitId, userId: user.id, date: today, status: "frozen" },
        update: { status: "frozen" },
      });
      await prisma.habit.update({
        where: { id: habitId },
        data: { gracesUsed: habit.gracesUsed + 1 },
      });
      const remaining = habit.gracePeriod - habit.gracesUsed - 1;
      await ctx.answerCallbackQuery({
        text: `⏭ Пропуск (осталось ${remaining} на неделе)`,
      });
    } else {
      await ctx.answerCallbackQuery({ text: "⏭ Пропуск (лимит исчерпан)" });
    }

  } else if (data.startsWith("habit_later:")) {
    const habitId = parseInt(data.replace("habit_later:", ""), 10);
    if (isNaN(habitId)) return;

    const from = ctx.from;
    if (!from) return;

    await ctx.answerCallbackQuery({ text: "⏰ Напомню через час" });

    // Schedule reminder in 1 hour
    const chatId = from.id;
    setTimeout(async () => {
      try {
        const habit = await prisma.habit.findUnique({ where: { id: habitId } });
        if (!habit || !habit.isActive) return;

        // Check if already completed today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existing = await prisma.habitLog.findUnique({
          where: { habitId_date: { habitId, date: today } },
        });
        if (existing?.status === "completed") return;

        const keyboard = new InlineKeyboard()
          .text("✅ Сделал", `habit_complete:${habitId}`)
          .text("⏭ Скип", `habit_skip:${habitId}`);

        await bot.api.sendMessage(
          chatId,
          `⏰ Напоминание: ${habit.icon} ${habit.name}`,
          { reply_markup: keyboard },
        );
      } catch (err) {
        console.error(`[habits] Later reminder failed:`, err);
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

/**
 * Send routine reminder with inline completion buttons.
 */
export async function sendRoutineReminder(
  chatId: number,
  userId: number,
  slot: "morning" | "afternoon" | "evening",
): Promise<void> {
  if (!checkAndIncrementLimit(chatId)) return;

  const habits = await prisma.habit.findMany({
    where: {
      userId,
      isActive: true,
      routineSlot: slot,
    },
    orderBy: { sortOrder: "asc" },
  });

  if (habits.length === 0) return;

  // Check which habits are already completed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayLogs = await prisma.habitLog.findMany({
    where: {
      userId,
      date: today,
      habitId: { in: habits.map((h) => h.id) },
      status: "completed",
    },
    select: { habitId: true },
  });
  const completedIds = new Set(todayLogs.map((l) => l.habitId));

  // Filter out already completed
  const pending = habits.filter((h) => !completedIds.has(h.id));
  if (pending.length === 0) return;

  const slotLabels: Record<string, string> = {
    morning: "🌅 Утренние привычки",
    afternoon: "☀️ Дневные привычки",
    evening: "🌙 Вечерние привычки",
  };
  const greeting = slotLabels[slot] ?? "Привычки";

  const keyboard = new InlineKeyboard();
  for (const habit of pending) {
    keyboard
      .text(`✅ ${habit.icon} ${habit.name}`, `habit_complete:${habit.id}`)
      .text("⏭", `habit_skip:${habit.id}`)
      .text("⏰", `habit_later:${habit.id}`);
    keyboard.row();
  }

  try {
    await bot.api.sendMessage(chatId, greeting, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error(`[habits] Failed to send routine reminder to ${chatId}:`, err);
  }
}

/**
 * Send a missed-day nudge — "meaning mirror" reflecting user's own words.
 */
export async function sendMissedDayNudge(
  chatId: number,
  habit: {
    id: number;
    name: string;
    icon: string;
    type: string;
    whyToday?: string | null;
    whyYear?: string | null;
    isItBeneficial?: string | null;
    breakTrigger?: string | null;
    replacement?: string | null;
  },
): Promise<void> {
  if (!checkAndIncrementLimit(chatId)) return;

  let message: string;

  if (habit.type === "build") {
    // For build habits: reflect user's "why" words
    const lines: string[] = [`${habit.icon} ${habit.name}`];
    if (habit.whyToday) {
      lines.push(`\nТы говорил: "${habit.whyToday}"`);
    }
    if (habit.whyYear) {
      lines.push(`Через год: "${habit.whyYear}"`);
    }
    lines.push("");  // empty line for spacing
    message = lines.join("\n");
  } else {
    // For break habits: show trigger awareness
    const lines: string[] = [`${habit.icon} ${habit.name}`];
    if (habit.isItBeneficial) {
      lines.push(`\nВыгодно ли это? "${habit.isItBeneficial}"`);
    }
    if (habit.breakTrigger) {
      lines.push(`Триггер: ${habit.breakTrigger}`);
    }
    if (habit.replacement) {
      lines.push(`Замена: ${habit.replacement}`);
    }
    message = lines.join("\n");
  }

  const keyboard = new InlineKeyboard()
    .text("✅ Сделал", `habit_complete:${habit.id}`)
    .text("⏭ Скип", `habit_skip:${habit.id}`)
    .text("⏰ Позже", `habit_later:${habit.id}`);

  try {
    await bot.api.sendMessage(chatId, message, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error(`[habits] Failed to send nudge to ${chatId}:`, err);
  }
}
