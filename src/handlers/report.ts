import type { Context } from "grammy";
import prisma from "../db.js";
import { analyzeEnergyHistory, formatDiagnostic } from "../services/diagnostics.js";
import { getRecommendations, formatRecommendations } from "../services/recommendations.js";

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
  let message = formatDiagnostic(result);

  // Append recommendations if available
  try {
    const recs = await getRecommendations(result, user.id);
    const formatted = formatRecommendations(recs);
    if (formatted) {
      message += "\n\n<b>Рекомендации:</b>\n" + formatted;
    }
  } catch (err) {
    console.error("Failed to generate recommendations for report:", err);
  }

  await ctx.reply(message, { parse_mode: "HTML" });
}
