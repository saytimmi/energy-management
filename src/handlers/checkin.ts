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

const ENERGY_EMOJIS: Record<string, string> = {
  physical: "💪",
  mental: "🧠",
  emotional: "❤️",
  spiritual: "✨",
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

// --- Severity System ---

type Severity = "critical" | "moderate" | "mild" | "stable" | "improved";

function getSeverity(current: number, previous: number): Severity {
  const drop = previous - current;
  if (current <= 3 && drop >= 3) return "critical";
  if (drop >= 4) return "critical";
  if (current <= 3 && drop >= 1) return "moderate";
  if (drop >= 2) return "moderate";
  if (drop === 1) return "mild";
  if (drop <= -2) return "improved";
  return "stable";
}

// --- Trigger buttons by severity ---

const CRITICAL_TRIGGERS: Record<string, string[]> = {
  physical: ["Не спал", "Болезнь", "Перетренировка", "Голод", "Алкоголь"],
  mental: ["Выгорание", "Дедлайн", "Инфо-перегрузка", "Конфликт на работе"],
  emotional: ["Ссора", "Потеря", "Одиночество", "Тревога", "Подавленность"],
  spiritual: ["Всё бесполезно", "Кризис смысла", "Выгорание", "Пустота"],
};

const MODERATE_TRIGGERS: Record<string, string[]> = {
  physical: ["Плохой сон", "Нет движения", "Плохая еда", "Устал"],
  mental: ["Долго за экраном", "Много задач", "Нет фокуса"],
  emotional: ["Конфликт", "Одиночество", "Стресс"],
  spiritual: ["Потеря смысла", "Рутина", "Нет прогресса"],
};

const IMPROVED_TRIGGERS: Record<string, string[]> = {
  physical: ["Хороший сон", "Тренировка", "Здоровая еда", "Прогулка"],
  mental: ["Отдых от экранов", "Медитация", "Интересная задача"],
  emotional: ["Хорошее общение", "Смех", "Природа"],
  spiritual: ["Помог кому-то", "Осмысленная работа", "Благодарность"],
};

// --- Keyboards ---

function buildRatingKeyboard(logType: string, energyType: string): InlineKeyboard {
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

function getNextEnergy(pending: PendingCheckIn): (typeof ENERGY_ORDER)[number] | null {
  for (const energy of ENERGY_ORDER) {
    if (pending[energy] === undefined) return energy;
  }
  return null;
}

// --- Callback Handler ---

export async function handleCheckinCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // Handle "why" trigger buttons (drop or rise)
  if (data.startsWith("why:")) {
    await handleWhyCallback(ctx, data);
    return;
  }

  // Handle undo button
  if (data.startsWith("checkin_undo:")) {
    await handleUndoCallback(ctx, data);
    return;
  }

  // Handle checkin flow
  if (!data.startsWith("checkin:")) return;

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

  if (energyType === "physical" || energyType === "mental" || energyType === "emotional" || energyType === "spiritual") {
    pending[energyType] = value;
  }

  await ctx.answerCallbackQuery();

  const nextEnergy = getNextEnergy(pending);

  if (nextEnergy) {
    const label = ENERGY_LABELS[nextEnergy];
    await ctx.editMessageText(`${label} энергия: оцени от 1 до 10`, {
      reply_markup: buildRatingKeyboard(logType, nextEnergy),
    });
    return;
  }

  // All 4 energies rated — process and save
  await processCompletedCheckin(ctx, telegramId, pending);
}

// --- Process Completed Checkin ---

async function processCompletedCheckin(
  ctx: Context,
  telegramId: number,
  pending: PendingCheckIn,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!user) {
    await ctx.editMessageText("Не удалось найти профиль. Отправь /start чтобы зарегистрироваться.");
    pendingCheckIns.delete(telegramId);
    return;
  }

  // --- Slot-to-slot comparison ---
  // Find the previous checkin of the SAME type (morning vs morning, evening vs evening)
  const sameSlotLog = await prisma.energyLog.findFirst({
    where: {
      userId: user.id,
      logType: pending.logType,
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }, // exclude dedup window
    },
    orderBy: { createdAt: "desc" },
  });

  // For evening: also find today's morning for intraday comparison
  let intradayLog: typeof sameSlotLog = null;
  if (pending.logType === "evening") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    intradayLog = await prisma.energyLog.findFirst({
      where: {
        userId: user.id,
        logType: "morning",
        createdAt: { gte: todayStart },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- Dedup: update if <5min ---
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentLog = await prisma.energyLog.findFirst({
    where: { userId: user.id, createdAt: { gte: fiveMinAgo } },
    orderBy: { createdAt: "desc" },
  });

  let logId: number;
  if (recentLog) {
    await prisma.energyLog.update({
      where: { id: recentLog.id },
      data: {
        physical: pending.physical!,
        mental: pending.mental!,
        emotional: pending.emotional!,
        spiritual: pending.spiritual!,
        logType: pending.logType,
      },
    });
    logId = recentLog.id;
  } else {
    const newLog = await prisma.energyLog.create({
      data: {
        userId: user.id,
        physical: pending.physical!,
        mental: pending.mental!,
        emotional: pending.emotional!,
        spiritual: pending.spiritual!,
        logType: pending.logType,
      },
    });
    logId = newLog.id;
  }

  pendingCheckIns.delete(telegramId);

  // --- Build response ---
  let followUp = `✅ Записал!\n\n${ENERGY_EMOJIS.physical} Физическая: ${pending.physical}\n${ENERGY_EMOJIS.mental} Ментальная: ${pending.mental}\n${ENERGY_EMOJIS.emotional} Эмоциональная: ${pending.emotional}\n${ENERGY_EMOJIS.spiritual} Духовная: ${pending.spiritual}`;

  // --- Severity analysis per energy type ---
  const compareLog = sameSlotLog; // slot-to-slot comparison
  const changes: Array<{ type: string; severity: Severity; current: number; prev: number; drop: number }> = [];

  if (compareLog) {
    const pairs = [
      { type: "physical", current: pending.physical!, prev: compareLog.physical },
      { type: "mental", current: pending.mental!, prev: compareLog.mental },
      { type: "emotional", current: pending.emotional!, prev: compareLog.emotional },
      { type: "spiritual", current: pending.spiritual!, prev: compareLog.spiritual },
    ];

    for (const p of pairs) {
      const severity = getSeverity(p.current, p.prev);
      if (severity !== "stable" && severity !== "mild") {
        changes.push({ ...p, severity, drop: p.prev - p.current });
      }
    }
  }

  // Critical drops
  const criticals = changes.filter(c => c.severity === "critical");
  const moderates = changes.filter(c => c.severity === "moderate");
  const improved = changes.filter(c => c.severity === "improved");

  if (criticals.length > 0) {
    followUp += "\n\n🚨 Сильное падение:";
    for (const c of criticals) {
      followUp += `\n${ENERGY_EMOJIS[c.type]} ${ENERGY_LABELS[c.type]}: ${c.prev} → ${c.current} (−${c.drop})`;
    }
  }

  if (moderates.length > 0) {
    followUp += "\n\n📉 Просело:";
    for (const c of moderates) {
      followUp += `\n${ENERGY_EMOJIS[c.type]} ${ENERGY_LABELS[c.type]}: ${c.prev} → ${c.current} (−${c.drop})`;
    }
  }

  if (improved.length > 0) {
    followUp += "\n\n📈 Выросло:";
    for (const c of improved) {
      followUp += `\n${ENERGY_EMOJIS[c.type]} ${ENERGY_LABELS[c.type]}: ${c.prev} → ${c.current} (+${-c.drop})`;
    }
  }

  // Intraday comparison for evening
  if (intradayLog && pending.logType === "evening") {
    const dayChanges: string[] = [];
    const iPairs = [
      { type: "physical", current: pending.physical!, morning: intradayLog.physical },
      { type: "mental", current: pending.mental!, morning: intradayLog.mental },
      { type: "emotional", current: pending.emotional!, morning: intradayLog.emotional },
      { type: "spiritual", current: pending.spiritual!, morning: intradayLog.spiritual },
    ];
    for (const p of iPairs) {
      const diff = p.current - p.morning;
      if (Math.abs(diff) >= 2) {
        const arrow = diff > 0 ? "↑" : "↓";
        dayChanges.push(`${ENERGY_EMOJIS[p.type]} ${arrow}${Math.abs(diff)}`);
      }
    }
    if (dayChanges.length > 0) {
      followUp += `\n\nЗа день: ${dayChanges.join("  ")}`;
    }
  }

  // Stable/all good
  if (changes.length === 0 && compareLog) {
    followUp += "\n\n👍 Стабильно";
  }

  // --- Recommendations (only for drops) ---
  const hasDrops = criticals.length > 0 || moderates.length > 0;

  if (hasDrops) {
    const result = getInstantRecommendations(
      { physical: pending.physical!, mental: pending.mental!, emotional: pending.emotional!, spiritual: pending.spiritual! },
      undefined,
      telegramId,
    );

    if (!result.allGood) {
      const grouped = new Map<string, typeof result.recommendations>();
      for (const rec of result.recommendations) {
        if (!grouped.has(rec.energyType)) grouped.set(rec.energyType, []);
        grouped.get(rec.energyType)!.push(rec);
      }

      // For critical: show more recommendations
      const maxRecs = criticals.length > 0 ? 3 : 2;
      followUp += "\n\nЧто поможет:";
      for (const [type, actions] of grouped) {
        const limited = actions.slice(0, maxRecs);
        for (const action of limited) {
          followUp += `\n  • ${action.name} (${action.duration} мин)`;
        }
      }
    }

    if (result.fact) {
      followUp += `\n\n🧬 ${result.fact.text}`;
    }
  }

  // --- Build keyboard ---
  const keyboard = new InlineKeyboard();

  // Trigger buttons based on severity
  if (criticals.length > 0) {
    // Critical: show triggers for the worst drop
    const worst = criticals.sort((a, b) => b.drop - a.drop)[0];
    const triggers = CRITICAL_TRIGGERS[worst.type] || [];
    followUp += `\n\nЧто произошло с ${ENERGY_LABELS[worst.type]?.toLowerCase()}?`;
    for (let i = 0; i < triggers.length; i++) {
      keyboard.text(triggers[i], `why:${worst.type}:${logId}:c:${i}`);
      if (i % 2 === 1) keyboard.row();
    }
    if (triggers.length % 2 === 1) keyboard.row();
  } else if (moderates.length > 0) {
    // Moderate: show triggers for the biggest drop
    const worst = moderates.sort((a, b) => b.drop - a.drop)[0];
    const triggers = MODERATE_TRIGGERS[worst.type] || [];
    followUp += `\n\nПочему ${ENERGY_LABELS[worst.type]?.toLowerCase()} просела?`;
    for (let i = 0; i < triggers.length; i++) {
      keyboard.text(triggers[i], `why:${worst.type}:${logId}:m:${i}`);
      if (i % 2 === 1) keyboard.row();
    }
    if (triggers.length % 2 === 1) keyboard.row();
  } else if (improved.length > 0) {
    // Improved: show positive triggers
    const best = improved.sort((a, b) => a.drop - b.drop)[0];
    const triggers = IMPROVED_TRIGGERS[best.type] || [];
    followUp += `\n\nЧто помогло ${ENERGY_LABELS[best.type]?.toLowerCase()}?`;
    for (let i = 0; i < triggers.length; i++) {
      keyboard.text(triggers[i], `why:${best.type}:${logId}:i:${i}`);
      if (i % 2 === 1) keyboard.row();
    }
    if (triggers.length % 2 === 1) keyboard.row();
  } else {
    // No comparison or mild — check absolute lows
    const lowEnergies = [
      { type: "physical", value: pending.physical! },
      { type: "mental", value: pending.mental! },
      { type: "emotional", value: pending.emotional! },
      { type: "spiritual", value: pending.spiritual! },
    ].filter(e => e.value <= 3);

    if (lowEnergies.length > 0) {
      const lowest = lowEnergies.sort((a, b) => a.value - b.value)[0];
      const triggers = MODERATE_TRIGGERS[lowest.type] || [];
      followUp += `\n\nПочему ${ENERGY_LABELS[lowest.type]?.toLowerCase()} низкая?`;
      for (let i = 0; i < triggers.length; i++) {
        keyboard.text(triggers[i], `why:${lowest.type}:${logId}:m:${i}`);
        if (i % 2 === 1) keyboard.row();
      }
      if (triggers.length % 2 === 1) keyboard.row();
    }
  }

  // Pattern-based habit suggestion
  if (config.webappUrl && user) {
    const result = getInstantRecommendations(
      { physical: pending.physical!, mental: pending.mental!, emotional: pending.emotional!, spiritual: pending.spiritual! },
      undefined,
      telegramId,
    );
    if (result.suggestIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentLogs = await prisma.energyLog.findMany({
        where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      const lowCounts: Record<string, number> = {};
      for (const log of recentLogs) {
        if (log.physical <= 4) lowCounts["physical"] = (lowCounts["physical"] || 0) + 1;
        if (log.mental <= 4) lowCounts["mental"] = (lowCounts["mental"] || 0) + 1;
        if (log.emotional <= 4) lowCounts["emotional"] = (lowCounts["emotional"] || 0) + 1;
        if (log.spiritual <= 4) lowCounts["spiritual"] = (lowCounts["spiritual"] || 0) + 1;
      }
      if (Object.values(lowCounts).some(c => c >= 3)) {
        keyboard.webApp("📱 Добавить в привычки", `${config.webappUrl}#habits/suggest?ids=${result.suggestIds.join(",")}`);
        keyboard.row();
      }
    }
  }

  // Undo button
  keyboard.text("↩️ Отменить", `checkin_undo:${logId}`);

  await ctx.editMessageText(followUp, { reply_markup: keyboard });
}

// --- Why Callback ---

async function handleWhyCallback(ctx: Context, data: string): Promise<void> {
  // Format: why:<energyType>:<logId>:<severity>:<index>
  const parts = data.split(":");
  if (parts.length !== 5) return;
  const [, energyType, logIdStr, severityCode, indexStr] = parts;
  const idx = parseInt(indexStr, 10);

  const triggerMap: Record<string, Record<string, string[]>> = {
    c: CRITICAL_TRIGGERS,
    m: MODERATE_TRIGGERS,
    i: IMPROVED_TRIGGERS,
  };

  const triggers = triggerMap[severityCode]?.[energyType];
  if (!triggers || isNaN(idx) || idx >= triggers.length) return;

  const trigger = triggers[idx];
  const direction = severityCode === "i" ? "rise" : "drop";

  const from = ctx.from;
  if (!from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(from.id) },
  });
  if (!user) return;

  await prisma.observation.create({
    data: {
      userId: user.id,
      energyType,
      direction,
      trigger,
      context: direction === "rise"
        ? `Причина роста ${ENERGY_LABELS[energyType] || energyType} энергии`
        : `Причина падения ${ENERGY_LABELS[energyType] || energyType} энергии`,
    },
  });

  await ctx.answerCallbackQuery({ text: `Записал: ${trigger}` });

  try {
    const originalText = ctx.callbackQuery?.message?.text ?? "";
    const emoji = direction === "rise" ? "📈" : "📝";
    await ctx.editMessageText(originalText + `\n\n${emoji} ${direction === "rise" ? "Помогло" : "Причина"}: ${trigger}`);
  } catch {}
}

// --- Undo Callback ---

async function handleUndoCallback(ctx: Context, data: string): Promise<void> {
  const logId = parseInt(data.replace("checkin_undo:", ""), 10);
  if (isNaN(logId)) return;

  const from = ctx.from;
  if (!from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(from.id) },
  });
  if (!user) return;

  const log = await prisma.energyLog.findFirst({
    where: { id: logId, userId: user.id },
  });

  if (log) {
    await prisma.energyLog.delete({ where: { id: logId } });
    await ctx.answerCallbackQuery({ text: "Запись отменена" });
    try {
      await ctx.editMessageText("↩️ Последняя запись энергии отменена.");
    } catch {}
  } else {
    await ctx.answerCallbackQuery({ text: "Запись не найдена" });
  }
}

// --- Send Checkin Message ---

export async function sendCheckInMessage(
  chatId: number,
  logType: "morning" | "evening" | "manual",
): Promise<void> {
  const greetings: Record<string, string> = {
    morning: "Доброе утро! Как твои энергии сегодня? Оцени каждую от 1 до 10.",
    evening: "Добрый вечер! Подведём итоги дня. Как твои энергии сейчас?",
    manual: "Записываем энергию! Оцени каждую от 1 до 10.",
  };

  pendingCheckIns.set(chatId, { logType });

  const firstEnergy = ENERGY_ORDER[0];
  const label = ENERGY_LABELS[firstEnergy];

  await bot.api.sendMessage(chatId, `${greetings[logType]}\n\n${label} энергия: оцени от 1 до 10`, {
    reply_markup: buildRatingKeyboard(logType, firstEnergy),
  });
}
