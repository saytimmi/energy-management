import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import prisma from "../db.js";
import { bot } from "../bot.js";
import { getInstantRecommendations } from "../services/instant-recommendations.js";
import { config } from "../config.js";

const ENERGY_LABELS: Record<string, string> = {
  physical: "Физическая",
  mental: "Ментальная",
  emotional: "Эмоциональная",
  spiritual: "Духовная",
};

const ENERGY_ORDER = ["physical", "mental", "emotional", "spiritual"] as const;

interface PendingCheckIn {
  logType: string;
  physical?: number;
  mental?: number;
  emotional?: number;
  spiritual?: number;
}

const pendingCheckIns = new Map<number, PendingCheckIn>();

function buildRatingKeyboard(
  logType: string,
  energyType: string
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 1; i <= 5; i++) {
    kb.text(`${i}`, `checkin:${logType}:${energyType}:${i}`);
  }
  kb.row();
  for (let i = 6; i <= 10; i++) {
    kb.text(`${i}`, `checkin:${logType}:${energyType}:${i}`);
  }
  return kb;
}

function getNextEnergy(
  pending: PendingCheckIn
): (typeof ENERGY_ORDER)[number] | null {
  for (const energy of ENERGY_ORDER) {
    if (pending[energy] === undefined) {
      return energy;
    }
  }
  return null;
}

export async function handleCheckinCallback(
  ctx: Context
): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("checkin:")) return;

  const parts = data.split(":");
  if (parts.length !== 4) return;

  const [, logType, energyType, valueStr] = parts;
  const value = parseInt(valueStr, 10);

  if (isNaN(value) || value < 1 || value > 10) return;

  const from = ctx.from;
  if (!from) return;
  const telegramId = from.id;

  let pending = pendingCheckIns.get(telegramId);
  if (!pending) {
    pending = { logType };
    pendingCheckIns.set(telegramId, pending);
  }

  if (
    energyType === "physical" ||
    energyType === "mental" ||
    energyType === "emotional" ||
    energyType === "spiritual"
  ) {
    pending[energyType] = value;
  }

  await ctx.answerCallbackQuery();

  const nextEnergy = getNextEnergy(pending);

  if (nextEnergy) {
    const label = ENERGY_LABELS[nextEnergy];
    await ctx.editMessageText(`${label} энергия: оцени от 1 до 10`, {
      reply_markup: buildRatingKeyboard(logType, nextEnergy),
    });
  } else {
    // All 4 energies rated — save to DB
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      await ctx.editMessageText(
        "Не удалось найти профиль. Отправь /start чтобы зарегистрироваться."
      );
      pendingCheckIns.delete(telegramId);
      return;
    }

    // Fetch previous log before saving
    const previousLog = await prisma.energyLog.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    await prisma.energyLog.create({
      data: {
        userId: user.id,
        physical: pending.physical!,
        mental: pending.mental!,
        emotional: pending.emotional!,
        spiritual: pending.spiritual!,
        logType: pending.logType,
      },
    });

    pendingCheckIns.delete(telegramId);

    // Format energy values with emojis
    const ENERGY_EMOJIS: Record<string, string> = {
      physical: "💪",
      mental: "🧠",
      emotional: "❤️",
      spiritual: "✨",
    };

    const ENERGY_TYPE_LABELS: Record<string, string> = {
      physical: "Физическая",
      mental: "Ментальная",
      emotional: "Эмоциональная",
      spiritual: "Духовная",
    };

    let followUp = `✅ Записал!\n\n${ENERGY_EMOJIS.physical} Физическая: ${pending.physical}\n${ENERGY_EMOJIS.mental} Ментальная: ${pending.mental}\n${ENERGY_EMOJIS.emotional} Эмоциональная: ${pending.emotional}\n${ENERGY_EMOJIS.spiritual} Духовная: ${pending.spiritual}`;

    // Drop detection (preserved from original)
    if (previousLog) {
      const drops: string[] = [];
      const energyPairs: Array<{ label: string; current: number; prev: number }> = [
        { label: "Физическая", current: pending.physical!, prev: previousLog.physical },
        { label: "Ментальная", current: pending.mental!, prev: previousLog.mental },
        { label: "Эмоциональная", current: pending.emotional!, prev: previousLog.emotional },
        { label: "Духовная", current: pending.spiritual!, prev: previousLog.spiritual },
      ];

      for (const e of energyPairs) {
        const diff = e.prev - e.current;
        if (diff >= 2) {
          drops.push(`${e.label} упала на ${diff} (было ${e.prev}, стало ${e.current})`);
        }
      }

      if (drops.length > 0) {
        followUp += `\n\n⚠️ Заметил снижение:\n${drops.join("\n")}`;
      }
    }

    // Instant recommendations from knowledge base (sync, no AI call)
    const result = getInstantRecommendations(
      {
        physical: pending.physical!,
        mental: pending.mental!,
        emotional: pending.emotional!,
        spiritual: pending.spiritual!,
      },
      undefined,
      telegramId,
    );

    if (result.allGood) {
      followUp += "\n\n🔥 Все энергии в норме!";
    } else {
      // Group recommendations by energy type
      const grouped = new Map<string, typeof result.recommendations>();
      for (const rec of result.recommendations) {
        const key = rec.energyType;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(rec);
      }

      followUp += "\n";
      for (const [type, actions] of grouped) {
        const emoji = ENERGY_EMOJIS[type] || "•";
        const label = ENERGY_TYPE_LABELS[type] || type;
        followUp += `\n${emoji} ${label} просела — вот что поможет:`;
        for (const action of actions) {
          followUp += `\n  • ${action.name} (${action.duration} мин)`;
        }
      }
    }

    // Append science fact
    if (result.fact) {
      followUp += `\n\n🧬 ${result.fact.text}`;
    }

    // Only suggest habits when there's a pattern (3+ low readings for same energy type)
    const keyboard = new InlineKeyboard();
    if (config.webappUrl && result.suggestIds.length > 0 && user) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentLogs = await prisma.energyLog.findMany({
        where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      // Check if same energy type was low 3+ times recently
      const lowCounts: Record<string, number> = {};
      for (const log of recentLogs) {
        if (log.physical <= 4) lowCounts["physical"] = (lowCounts["physical"] || 0) + 1;
        if (log.mental <= 4) lowCounts["mental"] = (lowCounts["mental"] || 0) + 1;
        if (log.emotional <= 4) lowCounts["emotional"] = (lowCounts["emotional"] || 0) + 1;
        if (log.spiritual <= 4) lowCounts["spiritual"] = (lowCounts["spiritual"] || 0) + 1;
      }

      const hasPattern = Object.values(lowCounts).some(count => count >= 3);
      if (hasPattern) {
        keyboard.webApp("📱 Добавить в привычки", `${config.webappUrl}#habits/suggest?ids=${result.suggestIds.join(",")}`);
      }
    }

    await ctx.editMessageText(followUp, {
      reply_markup: keyboard,
    });
  }
}

export async function sendCheckInMessage(
  chatId: number,
  logType: "morning" | "evening" | "manual"
): Promise<void> {
  const greetings: Record<string, string> = {
    morning: "Доброе утро! Как твои энергии сегодня? Оцени каждую от 1 до 10.",
    evening: "Добрый вечер! Подведём итоги дня. Как твои энергии сейчас?",
    manual: "Записываем энергию! Оцени каждую от 1 до 10.",
  };
  const greeting = greetings[logType];

  pendingCheckIns.set(chatId, { logType });

  const firstEnergy = ENERGY_ORDER[0];
  const label = ENERGY_LABELS[firstEnergy];

  await bot.api.sendMessage(chatId, `${greeting}\n\n${label} энергия: оцени от 1 до 10`, {
    reply_markup: buildRatingKeyboard(logType, firstEnergy),
  });
}
