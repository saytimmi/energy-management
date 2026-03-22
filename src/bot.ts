import { Bot } from "grammy";
import { config } from "./config.js";
import { startHandler } from "./handlers/start.js";
import { helpHandler } from "./handlers/help.js";
import { handleCheckinCallback, sendCheckInMessage, isAwaitingCustomReason, handleCustomReasonText } from "./handlers/checkin.js";
import { handleDigestCallback } from "./services/weekly-digest.js";
import { reportHandler } from "./handlers/report.js";
import { kaizenHandler } from "./handlers/kaizen.js";
import { energyHandler } from "./handlers/energy.js";
import { chat } from "./services/ai.js";
import type { ChatAction } from "./services/ai.js";
import { transcribeVoice } from "./services/voice.js";
import { findOrCreateUser } from "./db.js";
import { trackError } from "./services/monitor.js";
import { handleHabitCallback } from "./handlers/habits.js";

export const bot = new Bot(config.telegramBotToken);

// Adaptive buffer: short delay for first message, longer for bursts
const messageBuffers = new Map<number, { messages: string[]; timer: NodeJS.Timeout; firstName: string; lastName?: string; username?: string }>();

const FIRST_MSG_DELAY = 3_000;  // 3 sec — single message, respond fast
const BURST_MSG_DELAY = 8_000;  // 8 sec — user is typing a series, wait

function bufferMessage(userId: number, text: string, firstName: string, lastName?: string, username?: string) {
  const existing = messageBuffers.get(userId);

  if (existing) {
    // Additional message in burst — extend buffer
    existing.messages.push(text);
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushBuffer(userId), BURST_MSG_DELAY);
  } else {
    // First message — respond quickly
    const timer = setTimeout(() => flushBuffer(userId), FIRST_MSG_DELAY);
    messageBuffers.set(userId, { messages: [text], timer, firstName, lastName, username });
  }
}

async function flushBuffer(userId: number) {
  const buf = messageBuffers.get(userId);
  if (!buf) return;
  messageBuffers.delete(userId);

  try {
    const combined = buf.messages.join("\n");
    const telegramId = BigInt(userId);

    await findOrCreateUser(telegramId, buf.firstName, buf.lastName, buf.username);

    // Show "typing..." indicator
    try {
      await bot.api.sendChatAction(userId, "typing");
    } catch {}

    const result = await chat(telegramId, combined, buf.firstName);

    // Small delay to make typing feel natural
    await new Promise(r => setTimeout(r, 1500));

    try {
      await bot.api.sendChatAction(userId, "typing");
    } catch {}

    await new Promise(r => setTimeout(r, 1000));

    // Send text reply
    try {
      await bot.api.sendMessage(userId, result.text);
    } catch (err) {
      console.error("Failed to send buffered reply:", err);
    }

    // Handle actions (e.g., start checkin with InlineKeyboard)
    await handleChatActions(userId, result.actions);
  } catch (err) {
    // Catch-all: always respond to user, never leave them hanging
    await trackError("bot", err, { handler: "flushBuffer", userId });
    console.error("flushBuffer error:", err);
    try {
      await bot.api.sendMessage(userId, "Прости, произошла ошибка 😔 Попробуй ещё раз через минутку.");
    } catch {}
  }
}

/**
 * Handle actions returned by AI chat (e.g., start checkin flow)
 */
async function handleChatActions(userId: number, actions: ChatAction[]) {
  for (const action of actions) {
    try {
      if (action.type === "start_checkin") {
        await sendCheckInMessage(userId, "manual");
      }
    } catch (err) {
      console.error("Failed to handle chat action:", action.type, err);
    }
  }
}

// Commands
bot.command("start", startHandler);
bot.command("help", helpHandler);
bot.command("energy", energyHandler);
bot.command("report", reportHandler);
bot.command("kaizen", kaizenHandler);

// Inline button actions (from start/help keyboards)
bot.callbackQuery("action:checkin", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.chat) await sendCheckInMessage(ctx.chat.id, "manual");
});

bot.callbackQuery("action:report", async (ctx) => {
  await ctx.answerCallbackQuery();
  await reportHandler(ctx);
});

// Inline keyboard callbacks (habit completion/skip)
bot.callbackQuery(/^habit_(complete|skip):/, handleHabitCallback);

// Inline keyboard callbacks (weekly digest habit suggestions)
bot.callbackQuery(/^digest_habit/, async (ctx) => {
  await handleDigestCallback(ctx, ctx.callbackQuery.data);
});

// Inline keyboard callbacks (checkin flow)
bot.on("callback_query:data", handleCheckinCallback);

// Photo messages — bot can't see images, inform user
bot.on("message:photo", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  await ctx.reply("Пока не умею смотреть фото 📷 Опиши текстом или отправь голосовое — я пойму!");
});

// Voice messages — transcribe, then buffer as text
bot.on("message:voice", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  // Show typing while transcribing (can take up to 20s with retries)
  try { await ctx.api.sendChatAction(ctx.chat.id, "typing"); } catch {}

  try {
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const text = await transcribeVoice(buffer);

    if (!text) {
      await ctx.reply("Не удалось расшифровать голосовое 😔\nНапиши текстом — я на связи!");
      return;
    }

    bufferMessage(from.id, text, from.first_name, from.last_name ?? undefined, from.username ?? undefined);
  } catch (error) {
    await trackError("bot", error, { handler: "voice", userId: from.id });
    console.error("Voice handler error:", error);
    await ctx.reply("Не смог обработать голосовое 😔 Попробуй текстом.");
  }
});

// Text messages — check for custom reason input first, then buffer for AI
bot.on("message:text", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  // Handle custom reason text for multi-select why flow
  if (isAwaitingCustomReason(from.id)) {
    await handleCustomReasonText(ctx);
    return;
  }

  bufferMessage(from.id, ctx.message.text, from.first_name, from.last_name ?? undefined, from.username ?? undefined);
});

export async function setupBot() {
  // Set commands menu
  await bot.api.setMyCommands([
    { command: "start", description: "🏠 Главное меню" },
    { command: "energy", description: "⚡ Записать энергию" },
    { command: "report", description: "📊 Анализ и рекомендации" },
    { command: "help", description: "❓ Справка" },
  ]);

  // Set bot description (shown before user starts the bot)
  try {
    await (bot.api as any).callApi("setMyDescription", {
      description: "🔋 Персональный помощник по управлению энергией.\n\nОтслеживаю 4 типа энергии: физическую, ментальную, эмоциональную и духовную.\n\nПиши текстом или голосом — я пойму.",
    });
    await (bot.api as any).callApi("setMyShortDescription", {
      short_description: "🔋 Управление 4 типами энергии",
    });
  } catch (err) {
    console.warn("Could not set bot description:", err);
  }

  // Set menu button to open Mini App
  if (config.webappUrl) {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "📱 Energy App",
        web_app: { url: config.webappUrl },
      },
    });
  }
}
