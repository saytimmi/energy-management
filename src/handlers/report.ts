import type { Context } from "grammy";
import prisma from "../db.js";
import { analyzeEnergyHistory, formatDiagnostic } from "../services/diagnostics.js";

export async function reportHandler(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(from.id) },
  });

  if (!user) {
    await ctx.reply("Сначала отправь /start чтобы зарегистрироваться.");
    return;
  }

  const result = await analyzeEnergyHistory(user.id);
  const message = formatDiagnostic(result);
  await ctx.reply(message, { parse_mode: "HTML" });
}
