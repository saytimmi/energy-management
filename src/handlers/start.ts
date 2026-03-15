import { type CommandContext, Context } from "grammy";
import { findOrCreateUser } from "../db.js";
import { chat } from "../services/ai.js";

export async function startHandler(ctx: CommandContext<Context>) {
  const from = ctx.from;
  if (!from) return;

  await findOrCreateUser(
    BigInt(from.id),
    from.first_name,
    from.last_name ?? undefined,
    from.username ?? undefined,
  );

  // Let AI handle the greeting naturally
  const greeting = await chat(
    BigInt(from.id),
    "Привет! Я только что нажал /start. Расскажи кто ты и как ты можешь мне помочь с энергией. Коротко и тепло.",
    from.first_name,
  );

  await ctx.reply(greeting);
}
