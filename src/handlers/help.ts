import { type CommandContext, Context } from "grammy";

export async function helpHandler(ctx: CommandContext<Context>) {
  const lines = [
    "Доступные команды:",
    "/start — Начать работу с ботом",
    "/help — Показать эту справку",
    "/energy — Записать уровень энергии прямо сейчас",
    "/checkin — Начать check-in (как утренний/вечерний)",
    "",
    "Также вы можете использовать кнопку меню для открытия приложения.",
  ];
  await ctx.reply(lines.join("\n"));
}
