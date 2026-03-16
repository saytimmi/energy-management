import { type CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";

const HELP_TEXT = `🔋 *Energy Bot — Справка*

*Команды:*
/start — Начать или вернуться
/energy — Записать уровень энергии
/report — Анализ и рекомендации
/help — Эта справка

*Как общаться:*
💬 Пиши текстом — я пойму
🎤 Отправь голосовое — расшифрую
📱 Открой Energy App — дашборд

*Чекины:*
🌅 Утром в 9:00 — спрошу как проснулся
🌙 Вечером в 21:00 — подведём итоги

*4 типа энергии:*
🏃 Физическая → сон, еда, движение
🧠 Ментальная → фокус, расфокус, медитация
💚 Эмоциональная → люди, смех, природа
🔮 Духовная → миссия, помощь другим

_Каждый тип восстанавливается только своим способом_`;

export async function helpHandler(ctx: CommandContext<Context>) {
  const kb = new InlineKeyboard();
  kb.text("⚡ Записать энергию", "action:checkin");
  kb.text("📊 Мой отчёт", "action:report");

  if (config.webappUrl) {
    kb.row();
    kb.webApp("📱 Energy App", config.webappUrl);
  }

  await ctx.reply(HELP_TEXT, {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}
