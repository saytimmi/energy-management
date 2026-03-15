import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import prisma from "../db.js";
import { bot } from "../bot.js";
import { analyzeEnergyHistory } from "../services/diagnostics.js";
import { getRecommendations, formatRecommendations } from "../services/recommendations.js";

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

    // Build smart follow-up message
    let followUp = `Записал! Физическая: ${pending.physical}, Ментальная: ${pending.mental}, Эмоциональная: ${pending.emotional}, Духовная: ${pending.spiritual}`;

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
      } else if (
        pending.physical! >= 7 &&
        pending.mental! >= 7 &&
        pending.emotional! >= 7 &&
        pending.spiritual! >= 7
      ) {
        followUp += "\n\n🔥 Все энергии на высоте! Отличное состояние!";
      }
    }

    await ctx.editMessageText(followUp);

    // Send follow-up recommendations (non-blocking)
    try {
      if (ctx.chat) {
        await bot.api.sendChatAction(ctx.chat.id, "typing");
      }
      const diagnostic = await analyzeEnergyHistory(user.id);
      const recs = await getRecommendations(diagnostic, user.id);
      const formatted = formatRecommendations(recs);
      if (formatted && ctx.chat) {
        await bot.api.sendMessage(ctx.chat.id, `<b>Рекомендации:</b>\n\n${formatted}`, {
          parse_mode: "HTML",
        });
      }
    } catch (err) {
      console.error("Failed to generate recommendations after check-in:", err);
    }
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
