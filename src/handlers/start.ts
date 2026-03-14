import { type CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { findOrCreateUser } from "../db.js";

export async function startHandler(ctx: CommandContext<Context>) {
  const from = ctx.from;
  if (!from) {
    await ctx.reply("Не удалось определить пользователя.");
    return;
  }

  await findOrCreateUser(
    BigInt(from.id),
    from.first_name,
    from.last_name ?? undefined,
    from.username ?? undefined
  );

  const message =
    `Привет, ${from.first_name}! Я EnergyBot — помогу отслеживать твои 4 типа энергии. ` +
    `Используй кнопку меню, чтобы открыть приложение.`;

  if (config.webappUrl) {
    const keyboard = new InlineKeyboard().webApp(
      "Energy App",
      config.webappUrl
    );
    await ctx.reply(message, { reply_markup: keyboard });
  } else {
    await ctx.reply(message);
  }
}
