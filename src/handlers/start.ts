import { type CommandContext, Context, InlineKeyboard } from "grammy";
import { findOrCreateUser } from "../db.js";
import prisma from "../db.js";
import { chat } from "../services/ai.js";
import { config } from "../config.js";

const WELCOME_NEW = `✨ *Привет\\!*

Я *Энерджи* — твой персональный помощник по управлению энергией\\.

Я отслеживаю 4 типа энергии:
🏃 *Физическая* — тело, сон, еда
🧠 *Ментальная* — фокус, концентрация
💚 *Эмоциональная* — отношения, настроение
🔮 *Духовная* — смысл, миссия

*Как это работает:*
→ Просто пиши мне как другу
→ Отправляй голосовые 🎤
→ Я сам пойму что с энергией
→ Данные видны в Energy App

Расскажи, как ты себя сейчас чувствуешь? 👇`;

export async function startHandler(ctx: CommandContext<Context>) {
  const from = ctx.from;
  if (!from) return;

  const user = await findOrCreateUser(
    BigInt(from.id),
    from.first_name,
    from.last_name ?? undefined,
    from.username ?? undefined,
  );

  // Check if we already greeted today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayMessages = await prisma.message.findFirst({
    where: {
      userId: user.id,
      createdAt: { gte: today },
    },
  });

  if (todayMessages) {
    const reply = await chat(
      BigInt(from.id),
      "Привет, я снова тут",
      from.first_name,
    );
    await ctx.reply(reply, {
      reply_markup: getMainKeyboard(),
    });
    return;
  }

  // Check if new user or returning
  const totalMessages = await prisma.message.count({
    where: { userId: user.id },
  });

  if (totalMessages === 0) {
    // Brand new user — show welcome
    await ctx.reply(WELCOME_NEW, {
      parse_mode: "MarkdownV2",
      reply_markup: getMainKeyboard(),
    });
  } else {
    // Returning user — warm AI greeting
    const greeting = await chat(
      BigInt(from.id),
      "Привет! Я только что нажал /start. Я возвращаюсь — посмотри в историю. Поприветствуй коротко и тепло.",
      from.first_name,
    );
    await ctx.reply(greeting, {
      reply_markup: getMainKeyboard(),
    });
  }
}

function getMainKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text("⚡ Записать энергию", "action:checkin");
  kb.row();
  kb.text("📊 Мой отчёт", "action:report");

  if (config.webappUrl) {
    kb.row();
    kb.webApp("📱 Energy App", config.webappUrl);
  }

  return kb;
}

// Re-export for use in other handlers
export { getMainKeyboard };
