import { Bot } from "grammy";
import { config } from "./config.js";
import { startHandler } from "./handlers/start.js";
import { helpHandler } from "./handlers/help.js";
import { handleCheckinCallback } from "./handlers/checkin.js";
import { energyHandler } from "./handlers/energy.js";

export const bot = new Bot(config.telegramBotToken);

bot.command("start", startHandler);
bot.command("help", helpHandler);
bot.command("energy", energyHandler);

bot.on("callback_query:data", handleCheckinCallback);

bot.on("message:text", async (ctx) => {
  await ctx.reply(
    "Используй /energy чтобы записать уровень энергии, или /help для списка команд."
  );
});

export async function setupBot() {
  await bot.api.setMyCommands([
    { command: "start", description: "Начать" },
    { command: "help", description: "Помощь" },
    { command: "energy", description: "Записать энергию прямо сейчас" },
    { command: "checkin", description: "Записать уровень энергии" },
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
