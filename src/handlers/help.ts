import { type CommandContext, Context } from "grammy";

export async function helpHandler(ctx: CommandContext<Context>) {
  const lines = [
    "Доступные команды:",
    "/start — Начать работу с ботом",
    "/help — Показать эту справку",
    "",
    "Также вы можете использовать кнопку меню для открытия приложения.",
  ];
  await ctx.reply(lines.join("\n"));
}
