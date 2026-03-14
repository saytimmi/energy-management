import type { CommandContext, Context } from "grammy";
import { sendCheckInMessage } from "./checkin.js";

export async function energyHandler(
  ctx: CommandContext<Context>
): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("Не удалось определить пользователя.");
    return;
  }

  await sendCheckInMessage(ctx.chat.id, "manual");
}
