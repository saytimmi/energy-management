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

// --- Multi-select why state ---
interface PendingWhySelection {
  energyType: string;
  logId: number;
  severityCode: string;
  selected: Set<number>; // indices of selected preset triggers
  customReasons: string[]; // free-text reasons
  direction: string;
  messageText: string; // original message text (before trigger info)
  chatId: number;
  messageId: number;
}

const pendingWhySelections = new Map<number, PendingWhySelection>(); // telegramId -> selection

// Users awaiting custom reason text input
const awaitingCustomReason = new Set<number>(); // telegramId

// Users awaiting detail text after selecting triggers
interface PendingDetail {
  userId: number;
  observationIds: number[]; // saved observation IDs to update with detail
  triggers: string[]; // what was selected (for prompt)
  chatId: number;
}
const awaitingDetail = new Map<number, PendingDetail>(); // telegramId -> detail

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

  // Handle "why done" — finalize multi-select
  if (data.startsWith("why_done:")) {
    await handleWhyDoneCallback(ctx);
    return;
  }

  // Handle "why custom" — prompt for free text
  if (data.startsWith("why_custom:")) {
    await handleWhyCustomCallback(ctx);
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
      // Split into quick (≤15 min) and day-long recommendations
      const quick = result.recommendations.filter(r => r.duration <= 15);
      const dayLong = result.recommendations.filter(r => r.duration > 15);

      if (quick.length > 0) {
        followUp += "\n\n⚡ Прямо сейчас (до 15 мин):";
        for (const action of quick.slice(0, 3)) {
          followUp += `\n  → ${action.name}, ${action.duration} мин`;
        }
      }

      if (dayLong.length > 0) {
        followUp += "\n\n📅 На сегодня:";
        for (const action of dayLong.slice(0, 2)) {
          followUp += `\n  → ${action.name}, ${action.duration} мин`;
        }
      }

      // If all recs are same duration, just show generic
      if (quick.length === 0 && dayLong.length === 0) {
        followUp += "\n\nЧто поможет:";
        for (const action of result.recommendations.slice(0, 3)) {
          followUp += `\n  → ${action.name}, ${action.duration} мин`;
        }
      }
    }

    if (result.fact) {
      followUp += `\n\n🧬 ${result.fact.text}`;
    }
  }

  // --- Build keyboard with multi-select why triggers ---
  const keyboard = new InlineKeyboard();
  let whyTarget: { type: string; severityCode: string; question: string } | null = null;

  if (criticals.length > 0) {
    const worst = criticals.sort((a, b) => b.drop - a.drop)[0];
    whyTarget = { type: worst.type, severityCode: "c", question: `Что произошло с ${ENERGY_LABELS[worst.type]?.toLowerCase()}?` };
  } else if (moderates.length > 0) {
    const worst = moderates.sort((a, b) => b.drop - a.drop)[0];
    whyTarget = { type: worst.type, severityCode: "m", question: `Почему ${ENERGY_LABELS[worst.type]?.toLowerCase()} просела?` };
  } else if (improved.length > 0) {
    const best = improved.sort((a, b) => a.drop - b.drop)[0];
    whyTarget = { type: best.type, severityCode: "i", question: `Что помогло ${ENERGY_LABELS[best.type]?.toLowerCase()}?` };
  } else {
    const lowEnergies = [
      { type: "physical", value: pending.physical! },
      { type: "mental", value: pending.mental! },
      { type: "emotional", value: pending.emotional! },
      { type: "spiritual", value: pending.spiritual! },
    ].filter(e => e.value <= 3);

    if (lowEnergies.length > 0) {
      const lowest = lowEnergies.sort((a, b) => a.value - b.value)[0];
      whyTarget = { type: lowest.type, severityCode: "m", question: `Почему ${ENERGY_LABELS[lowest.type]?.toLowerCase()} низкая?` };
    }
  }

  if (whyTarget) {
    followUp += `\n\n${whyTarget.question} (можно выбрать несколько)`;

    // Pre-create pending selection for this user
    const selection: PendingWhySelection = {
      energyType: whyTarget.type,
      logId,
      severityCode: whyTarget.severityCode,
      selected: new Set(),
      customReasons: [],
      direction: whyTarget.severityCode === "i" ? "rise" : "drop",
      messageText: followUp, // will be updated after message is sent
      chatId: 0, // will be set after edit
      messageId: 0, // will be set after edit
    };
    pendingWhySelections.set(telegramId, selection);

    // Build trigger buttons on main keyboard
    const triggerMap: Record<string, Record<string, string[]>> = {
      c: CRITICAL_TRIGGERS, m: MODERATE_TRIGGERS, i: IMPROVED_TRIGGERS,
    };
    const triggers = triggerMap[whyTarget.severityCode]?.[whyTarget.type] || [];
    for (let i = 0; i < triggers.length; i++) {
      keyboard.text(triggers[i], `why:${whyTarget.type}:${logId}:${whyTarget.severityCode}:${i}`);
      if (i % 2 === 1) keyboard.row();
    }
    if (triggers.length % 2 === 1) keyboard.row();
    keyboard.text("✍️ Свой вариант", `why_custom:${logId}`);
    keyboard.row();
    keyboard.text("✅ Готово", `why_done:${logId}`);
    keyboard.row();
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

  const sentMsg = await ctx.editMessageText(followUp, { reply_markup: keyboard });

  // Update pending selection with message info for keyboard updates
  const pendingSel = pendingWhySelections.get(telegramId);
  if (pendingSel && sentMsg && typeof sentMsg === "object" && "message_id" in sentMsg) {
    pendingSel.chatId = (sentMsg as any).chat?.id ?? ctx.chat?.id ?? telegramId;
    pendingSel.messageId = (sentMsg as any).message_id;
    pendingSel.messageText = followUp;
  }
}

// --- Why Callback (multi-select toggle) ---

function buildWhyKeyboard(selection: PendingWhySelection): InlineKeyboard {
  const triggerMap: Record<string, Record<string, string[]>> = {
    c: CRITICAL_TRIGGERS,
    m: MODERATE_TRIGGERS,
    i: IMPROVED_TRIGGERS,
  };

  const triggers = triggerMap[selection.severityCode]?.[selection.energyType] || [];
  const keyboard = new InlineKeyboard();

  for (let i = 0; i < triggers.length; i++) {
    const isSelected = selection.selected.has(i);
    const label = isSelected ? `✅ ${triggers[i]}` : triggers[i];
    keyboard.text(label, `why:${selection.energyType}:${selection.logId}:${selection.severityCode}:${i}`);
    if (i % 2 === 1) keyboard.row();
  }
  if (triggers.length % 2 === 1) keyboard.row();

  // Custom text button
  keyboard.text("✍️ Свой вариант", `why_custom:${selection.logId}`);
  keyboard.row();

  // Done button (show count if any selected)
  const totalSelected = selection.selected.size + selection.customReasons.length;
  const doneLabel = totalSelected > 0 ? `✅ Готово (${totalSelected})` : "✅ Готово";
  keyboard.text(doneLabel, `why_done:${selection.logId}`);

  return keyboard;
}

async function handleWhyCallback(ctx: Context, data: string): Promise<void> {
  // Format: why:<energyType>:<logId>:<severity>:<index>
  const parts = data.split(":");
  if (parts.length !== 5) return;
  const [, energyType, logIdStr, severityCode, indexStr] = parts;
  const logId = parseInt(logIdStr, 10);
  const idx = parseInt(indexStr, 10);

  const triggerMap: Record<string, Record<string, string[]>> = {
    c: CRITICAL_TRIGGERS,
    m: MODERATE_TRIGGERS,
    i: IMPROVED_TRIGGERS,
  };

  const triggers = triggerMap[severityCode]?.[energyType];
  if (!triggers || isNaN(idx) || idx >= triggers.length) return;

  const from = ctx.from;
  if (!from) return;

  const direction = severityCode === "i" ? "rise" : "drop";

  // Get or create pending selection
  let selection = pendingWhySelections.get(from.id);
  if (!selection) {
    selection = {
      energyType,
      logId,
      severityCode,
      selected: new Set(),
      customReasons: [],
      direction,
      messageText: ctx.callbackQuery?.message?.text ?? "",
      chatId: ctx.chat?.id ?? from.id,
      messageId: ctx.callbackQuery?.message?.message_id ?? 0,
    };
    pendingWhySelections.set(from.id, selection);
  }

  // Toggle selection
  if (selection.selected.has(idx)) {
    selection.selected.delete(idx);
  } else {
    selection.selected.add(idx);
  }

  await ctx.answerCallbackQuery({
    text: selection.selected.has(idx) ? `✅ ${triggers[idx]}` : `Убрал: ${triggers[idx]}`,
  });

  // Update keyboard
  try {
    await ctx.editMessageReplyMarkup({
      reply_markup: buildWhyKeyboard(selection),
    });
  } catch {}
}

// --- Why Done Callback (save all selected) ---

async function handleWhyDoneCallback(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const selection = pendingWhySelections.get(from.id);
  if (!selection) {
    await ctx.answerCallbackQuery({ text: "Нет активного выбора" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(from.id) },
  });
  if (!user) return;

  const triggerMap: Record<string, Record<string, string[]>> = {
    c: CRITICAL_TRIGGERS,
    m: MODERATE_TRIGGERS,
    i: IMPROVED_TRIGGERS,
  };

  const triggers = triggerMap[selection.severityCode]?.[selection.energyType] || [];
  const allReasons: string[] = [];

  // Collect preset triggers
  for (const idx of selection.selected) {
    if (triggers[idx]) allReasons.push(triggers[idx]);
  }

  // Collect custom reasons
  allReasons.push(...selection.customReasons);

  if (allReasons.length === 0) {
    await ctx.answerCallbackQuery({ text: "Выбери хотя бы одну причину или нажми ✍️" });
    return;
  }

  // Save each reason as separate observation (context will be filled after detail)
  const savedIds: number[] = [];

  for (const reason of allReasons) {
    const obs = await prisma.observation.create({
      data: {
        userId: user.id,
        energyType: selection.energyType,
        direction: selection.direction,
        trigger: reason,
        context: null, // will be filled with user's detail
        energyLogId: selection.logId,
      },
    });
    savedIds.push(obs.id);
  }

  await ctx.answerCallbackQuery({ text: `Записал ${allReasons.length} причин` });

  // Update message with selected reasons
  const emoji = selection.direction === "rise" ? "📈" : "📝";
  const label = selection.direction === "rise" ? "Помогло" : "Причины";
  const reasonsList = allReasons.map(r => `— ${r}`).join("\n");
  try {
    await ctx.editMessageText(
      selection.messageText + `\n\n${emoji} ${label}:\n${reasonsList}`,
    );
  } catch {}

  const chatId = selection.chatId || ctx.chat?.id || from.id;

  // Cleanup selection state
  pendingWhySelections.delete(from.id);
  awaitingCustomReason.delete(from.id);

  // Ask for details — what exactly happened
  awaitingDetail.set(from.id, {
    userId: user.id,
    observationIds: savedIds,
    triggers: allReasons,
    chatId,
  });

  const detailPrompt = selection.direction === "rise"
    ? `Что конкретно помогло? Опиши ситуацию коротко — это поможет найти паттерны.\n\nНапример: "пробежка в парке 30 мин утром" или "позвонил другу, поговорили час"\n\nИли отправь /skip чтобы пропустить.`
    : `Что конкретно произошло? Опиши ситуацию — это поможет найти паттерны.\n\nНапример: "созвон с клиентом, давил по срокам" или "не мог уснуть, листал телефон до 2 ночи"\n\nИли отправь /skip чтобы пропустить.`;

  await bot.api.sendMessage(chatId, detailPrompt, {
    reply_markup: { force_reply: true, selective: true },
  });
}

// --- Why Custom Callback (prompt for text) ---

async function handleWhyCustomCallback(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const selection = pendingWhySelections.get(from.id);
  if (!selection) {
    // Create selection from callback data if needed
    await ctx.answerCallbackQuery({ text: "Нет активного выбора" });
    return;
  }

  awaitingCustomReason.add(from.id);

  await ctx.answerCallbackQuery({ text: "Напиши причину текстом" });

  const prompt = selection.direction === "rise"
    ? "Напиши что помогло (одним сообщением):"
    : "Напиши причину (одним сообщением):";

  await bot.api.sendMessage(selection.chatId, prompt, {
    reply_markup: { force_reply: true, selective: true },
  });
}

// --- Handle text input (custom reason or detail) ---

export function isAwaitingTextInput(telegramId: number): boolean {
  return awaitingCustomReason.has(telegramId) || awaitingDetail.has(telegramId);
}

export async function handleTextInput(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const text = ctx.message?.text?.trim();
  if (!text) return;

  // Check if awaiting detail (post-trigger description)
  if (awaitingDetail.has(from.id)) {
    await handleDetailText(ctx, from.id, text);
    return;
  }

  // Check if awaiting custom reason (during multi-select)
  if (awaitingCustomReason.has(from.id)) {
    await handleCustomReasonText(ctx, from.id, text);
    return;
  }
}

async function handleCustomReasonText(ctx: Context, telegramId: number, text: string): Promise<void> {
  const selection = pendingWhySelections.get(telegramId);
  if (!selection) {
    awaitingCustomReason.delete(telegramId);
    return;
  }

  // Add custom reason
  selection.customReasons.push(text);
  awaitingCustomReason.delete(telegramId);

  await ctx.reply(`✅ Добавил: "${text}"\nМожешь выбрать ещё причины или нажать Готово.`);

  // Update the original message keyboard to reflect new count
  try {
    await bot.api.editMessageReplyMarkup(selection.chatId, selection.messageId, {
      reply_markup: buildWhyKeyboard(selection),
    });
  } catch {}
}

async function handleDetailText(ctx: Context, telegramId: number, text: string): Promise<void> {
  const detail = awaitingDetail.get(telegramId);
  if (!detail) return;

  awaitingDetail.delete(telegramId);

  // /skip — leave context empty
  if (text === "/skip") {
    await ctx.reply("👍 Пропущено.");
    return;
  }

  // Update all observations with the detail context
  for (const obsId of detail.observationIds) {
    await prisma.observation.update({
      where: { id: obsId },
      data: { context: text },
    });
  }

  await ctx.reply(`📝 Записал: "${text}"\n\nБуду анализировать паттерны в недельном дайджесте.`);
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
  // Prevent duplicate checkins — if already in progress, ignore
  if (pendingCheckIns.has(chatId)) {
    return;
  }

  const greetings: Record<string, string> = {
    morning: "Доброе утро! Как твои энергии сегодня? Оцени каждую от 1 до 10.",
    evening: "Добрый вечер! Подведём итоги дня. Как твои энергии сейчас?",
    manual: "Записываем энергию! Оцени каждую от 1 до 10.",
  };

  pendingCheckIns.set(chatId, { logType });

  // Smart time logic — warn at night (use user's timezone)
  const now = new Date();
  const user = await prisma.user.findFirst({ where: { telegramId: BigInt(chatId) } });
  const tz = user?.timezone || "Asia/Shanghai";
  const hour = parseInt(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }), 10);

  let timeNote = "";
  if (hour >= 0 && hour < 6) {
    timeNote = "\n\n⏰ Сейчас ночь — оценка может быть занижена из-за усталости. Может, лучше утром?";
  } else if (hour >= 23) {
    timeNote = "\n\n🌙 Поздновато — учитывай что вечерняя усталость влияет на оценку.";
  }

  const firstEnergy = ENERGY_ORDER[0];
  const label = ENERGY_LABELS[firstEnergy];

  await bot.api.sendMessage(chatId, `${greetings[logType]}\n\n${label} энергия: оцени от 1 до 10${timeNote}`, {
    reply_markup: buildRatingKeyboard(logType, firstEnergy),
  });
}
