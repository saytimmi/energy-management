import { Bot } from "grammy";
import { config } from "./config.js";
import { startHandler } from "./handlers/start.js";
import { handleCheckinCallback } from "./handlers/checkin.js";
import { reportHandler } from "./handlers/report.js";
import { chat, chatVoice } from "./services/ai.js";
import { findOrCreateUser } from "./db.js";

export const bot = new Bot(config.telegramBotToken);

// Commands
bot.command("start", startHandler);
bot.command("report", reportHandler);

// Inline keyboard callbacks
bot.on("callback_query:data", handleCheckinCallback);

// Voice messages — download and send to Claude
bot.on("message:voice", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  await findOrCreateUser(
    BigInt(from.id),
    from.first_name,
    from.last_name ?? undefined,
    from.username ?? undefined,
  );

  try {
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const reply = await chatVoice(BigInt(from.id), buffer, from.first_name);
    await ctx.reply(reply);
  } catch (error) {
    console.error("Voice handler error:", error);
    await ctx.reply("Не смог обработать голосовое 😔 Попробуй текстом.");
  }
});

// Audio messages (same handling)
bot.on("message:audio", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  await findOrCreateUser(
    BigInt(from.id),
    from.first_name,
    from.last_name ?? undefined,
    from.username ?? undefined,
  );

  try {
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const reply = await chatVoice(BigInt(from.id), buffer, from.first_name);
    await ctx.reply(reply);
  } catch (error) {
    console.error("Audio handler error:", error);
    await ctx.reply("Не смог обработать аудио 😔 Попробуй текстом.");
  }
});

// Text messages — AI conversation
bot.on("message:text", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  await findOrCreateUser(
    BigInt(from.id),
    from.first_name,
    from.last_name ?? undefined,
    from.username ?? undefined,
  );

  const reply = await chat(BigInt(from.id), ctx.message.text, from.first_name);
  await ctx.reply(reply);
});

export async function setupBot() {
  await bot.api.setMyCommands([
    { command: "start", description: "Начать заново" },
    { command: "report", description: "Анализ моей энергии" },
  ]);

  if (config.webappUrl) {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Energy App",
        web_app: { url: config.webappUrl },
      },
    });
  }
}
