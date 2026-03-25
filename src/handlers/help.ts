import { type CommandContext, Context } from "grammy";
import { getReplyKeyboard } from "./start.js";

const HELP_TEXT = `⚡ Energy — твоя ОС для жизни

Команды:
/energy — записать энергию
/habits — мои привычки
/kaizen — рефлексия дня
/report — анализ и отчёт

Как общаться:
→ пиши текстом — я пойму
→ отправь голосовое — расшифрую
→ открой Energy App — дашборд и аналитика

Что умею:
⚡ энергия — 4 типа, паттерны, триггеры
🔋 привычки — streaks, рутины, сила привычки
⚖️ баланс — 8 сфер жизни, radar-chart
🧭 стратегия — миссия, цели с прогрессом
🧠 кайдзен — рефлексия, алгоритмы, дайджесты

Чекины: утром в 9:00 и вечером в 21:00`;

export async function helpHandler(ctx: CommandContext<Context>) {
  await ctx.reply(HELP_TEXT, {
    reply_markup: getReplyKeyboard(),
  });
}
