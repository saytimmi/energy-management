import { type CommandContext, Context } from "grammy";
import { findOrCreateUser } from "../db.js";
import prisma from "../db.js";
import { chat } from "../services/ai.js";

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
    // Already talked today — just continue conversation
    const reply = await chat(
      BigInt(from.id),
      "Привет, я снова тут",
      from.first_name,
    );
    await ctx.reply(reply);
    return;
  }

  // First time today — warm greeting
  const greeting = await chat(
    BigInt(from.id),
    "Привет! Я только что нажал /start. Это мой первый раз или я возвращаюсь — посмотри в историю. Поприветствуй коротко и тепло.",
    from.first_name,
  );

  await ctx.reply(greeting);
}
