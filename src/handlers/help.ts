import { type CommandContext, Context } from "grammy";

export async function helpHandler(ctx: CommandContext<Context>) {
  const lines = [
    "Доступные команды:",
    "/start — Начать работу с ботом",
    "/energy — Записать уровень энергии",
    "/report — Анализ энергии и рекомендации",
    "/kaizen — Диагностика бота и запуск улучшений",
    "/help — Показать эту справку",
    "",
    "Также можно просто написать сообщение — я отвечу как собеседник.",
    "Или отправь голосовое 🎤",
    "Кнопка меню → Energy App с дашбордом и дневником.",
  ];
  await ctx.reply(lines.join("\n"));
}
