import { Bot } from "grammy";
import { config } from "./config.js";
import { startHandler } from "./handlers/start.js";
import { handleCheckinCallback } from "./handlers/checkin.js";
import { reportHandler } from "./handlers/report.js";
import { chat } from "./services/ai.js";
import { transcribeVoice } from "./services/voice.js";
import { findOrCreateUser } from "./db.js";

export const bot = new Bot(config.telegramBotToken);

// Commands
bot.command("start", startHandler);
bot.command("report", reportHandler);

// Inline keyboard callbacks
bot.on("callback_query:data", handleCheckinCallback);

// Voice messages — transcribe with Gemini, then chat with Claude
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
    // Download voice file
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Transcribe with Gemini
    const text = await transcribeVoice(buffer);

    if (!text) {
      await ctx.reply("Не расслышал 😔 Попробуй ещё раз или напиши текстом.");
      return;
    }

    // Send transcribed text to Claude
    const reply = await chat(BigInt(from.id), text, from.first_name, "voice");
    await ctx.reply(reply);
  } catch (error) {
    console.error("Voice handler error:", error);
    await ctx.reply("Не смог обработать голосовое 😔 Попробуй текстом.");
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
