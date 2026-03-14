import { InlineKeyboard } from "grammy";
import type { CallbackQueryContext, Context } from "grammy";
import prisma from "../db.js";
import { bot } from "../bot.js";

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
  ctx: CallbackQueryContext<Context>
): Promise<void> {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("checkin:")) return;

  const parts = data.split(":");
  if (parts.length !== 4) return;

  const [, logType, energyType, valueStr] = parts;
  const value = parseInt(valueStr, 10);

  if (isNaN(value) || value < 1 || value > 10) return;

  const telegramId = ctx.from.id;

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

    await ctx.editMessageText(
      `Записал! Физическая: ${pending.physical}, Ментальная: ${pending.mental}, Эмоциональная: ${pending.emotional}, Духовная: ${pending.spiritual}`
    );
  }
}

export async function sendCheckInMessage(
  chatId: number,
  logType: "morning" | "evening"
): Promise<void> {
  const greeting =
    logType === "morning"
      ? "Доброе утро! Как твои энергии сегодня? Оцени каждую от 1 до 10."
      : "Добрый вечер! Подведём итоги дня. Как твои энергии сейчас?";

  pendingCheckIns.set(chatId, { logType });

  const firstEnergy = ENERGY_ORDER[0];
  const label = ENERGY_LABELS[firstEnergy];

  await bot.api.sendMessage(chatId, `${greeting}\n\n${label} энергия: оцени от 1 до 10`, {
    reply_markup: buildRatingKeyboard(logType, firstEnergy),
  });
}
