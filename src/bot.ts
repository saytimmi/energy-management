import { Bot } from "grammy";
import { config } from "./config.js";
import { startHandler } from "./handlers/start.js";
import { helpHandler } from "./handlers/help.js";
import { handleCheckinCallback, sendCheckInMessage } from "./handlers/checkin.js";
import { reportHandler } from "./handlers/report.js";
import { kaizenHandler } from "./handlers/kaizen.js";
import { energyHandler } from "./handlers/energy.js";
import { chat } from "./services/ai.js";
import { transcribeVoice } from "./services/voice.js";
import { findOrCreateUser } from "./db.js";
import { trackError } from "./services/monitor.js";

export const bot = new Bot(config.telegramBotToken);

// Buffer messages per user — collect for 10 seconds, then respond once
const messageBuffers = new Map<number, { messages: string[]; timer: NodeJS.Timeout; firstName: string; lastName?: string; username?: string }>();

const BUFFER_DELAY = 10_000; // 10 seconds

function bufferMessage(userId: number, text: string, firstName: string, lastName?: string, username?: string) {
  const existing = messageBuffers.get(userId);

  if (existing) {
    existing.messages.push(text);
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushBuffer(userId), BUFFER_DELAY);
  } else {
    const timer = setTimeout(() => flushBuffer(userId), BUFFER_DELAY);
    messageBuffers.set(userId, { messages: [text], timer, firstName, lastName, username });
  }
}

async function flushBuffer(userId: number) {
  const buf = messageBuffers.get(userId);
  if (!buf) return;
  messageBuffers.delete(userId);

  const combined = buf.messages.join("\n");
  const telegramId = BigInt(userId);

  await findOrCreateUser(telegramId, buf.firstName, buf.lastName, buf.username);

  // Show "typing..." indicator
  try {
    await bot.api.sendChatAction(userId, "typing");
  } catch {}

  const reply = await chat(telegramId, combined, buf.firstName);

  // Small delay to make typing feel natural
  await new Promise(r => setTimeout(r, 1500));

  try {
    await bot.api.sendChatAction(userId, "typing");
  } catch {}

  await new Promise(r => setTimeout(r, 1000));

  try {
    await bot.api.sendMessage(userId, reply);
  } catch (err) {
    console.error("Failed to send buffered reply:", err);
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

// Inline keyboard callbacks (checkin flow)
bot.on("callback_query:data", handleCheckinCallback);

// Voice messages — transcribe, then buffer as text
bot.on("message:voice", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  try {
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const text = await transcribeVoice(buffer);

    if (!text) {
      await ctx.reply("Не расслышал 😔 Попробуй ещё раз или напиши текстом.");
      return;
    }

    bufferMessage(from.id, text, from.first_name, from.last_name ?? undefined, from.username ?? undefined);
  } catch (error) {
    await trackError("bot", error, { handler: "voice", userId: from.id });
    console.error("Voice handler error:", error);
    await ctx.reply("Не смог обработать голосовое 😔 Попробуй текстом.");
  }
});

// Text messages — buffer and respond after 10s pause
bot.on("message:text", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

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
