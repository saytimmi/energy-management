import { Bot } from "grammy";
import { config } from "./config.js";
import { startHandler } from "./handlers/start.js";
import { handleCheckinCallback } from "./handlers/checkin.js";
import { reportHandler } from "./handlers/report.js";
import { chat } from "./services/ai.js";
import { findOrCreateUser } from "./db.js";

export const bot = new Bot(config.telegramBotToken);

// Commands
bot.command("start", startHandler);
bot.command("report", reportHandler);

// Inline keyboard callbacks (for energy rating buttons)
bot.on("callback_query:data", handleCheckinCallback);

// Every text message goes to AI — the bot is a conversational partner
bot.on("message:text", async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  await findOrCreateUser(
    BigInt(from.id),
    from.first_name,
    from.last_name ?? undefined,
    from.username ?? undefined,
  );

  const reply = await chat(
    BigInt(from.id),
    ctx.message.text,
    from.first_name,
  );

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
