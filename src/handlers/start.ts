import { type CommandContext, Context, Keyboard } from "grammy";
import { findOrCreateUser } from "../db.js";
import prisma from "../db.js";
import { chat } from "../services/ai.js";
import { config } from "../config.js";

const WELCOME_NEW = (name: string) =>
  `Привет, ${name}! 👋\n\nЯ — AI-коуч. Помогу управлять энергией, привычками и целями.\n\nПросто пиши как другу — текстом или голосом. Я пойму.\n\nНачнём с чекина? 👇`;

export function getReplyKeyboard(): Keyboard {
  const kb = new Keyboard()
    .text("⚡ Энергия").text("🔋 Привычки").text("📊 Отчёт")
    .row()
    .resized()
    .persistent();

  if (config.webappUrl) {
    kb.webApp("📱 Energy App", config.webappUrl);
  }

  return kb;
}

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
    const result = await chat(
      BigInt(from.id),
      "Привет, я снова тут",
      from.first_name,
    );
    const text = result.text.trim() || "С возвращением! Чем могу помочь?";
    await ctx.reply(text, {
      reply_markup: getReplyKeyboard(),
    });
    return;
  }

  // Check if new user or returning
  const totalMessages = await prisma.message.count({
    where: { userId: user.id },
  });

  if (totalMessages === 0) {
    // Brand new user — short warm welcome
    await ctx.reply(WELCOME_NEW(from.first_name), {
      reply_markup: getReplyKeyboard(),
    });
  } else {
    // Returning user — warm AI greeting
    const result = await chat(
      BigInt(from.id),
      "Привет! Я только что нажал /start. Я возвращаюсь — посмотри в историю. Поприветствуй коротко и тепло.",
      from.first_name,
    );
    const text = result.text.trim() || `Привет, ${from.first_name}! Рад видеть снова 👋`;
    await ctx.reply(text, {
      reply_markup: getReplyKeyboard(),
    });
  }
}
