import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";
import { isOnVacation } from "./awareness.js";

const ASSESSMENT_INTERVAL_DAYS = 14;

export async function checkBalanceAssessment(): Promise<void> {
  const users = await prisma.user.findMany();

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;
      // Find the most recent balance rating for this user
      const lastRating = await prisma.balanceRating.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      const daysSinceLastAssessment = lastRating
        ? Math.floor((Date.now() - lastRating.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity; // Never assessed

      if (daysSinceLastAssessment >= ASSESSMENT_INTERVAL_DAYS) {
        const chatId = Number(user.telegramId);

        // Get balance goals to know focus areas
        const focusGoals = await prisma.balanceGoal.findMany({
          where: { userId: user.id, isFocus: true },
        });

        let message: string;
        if (!lastRating) {
          message = "привет! ты ещё ни разу не оценивал баланс жизни. давай пройдёмся по сферам — это займёт минут 5, но даст полную картину. напиши «баланс» и начнём";
        } else {
          const focusText = focusGoals.length > 0
            ? ` (в фокусе: ${focusGoals.map(g => g.area).join(", ")})`
            : "";
          message = `слушай, прошло уже ${daysSinceLastAssessment} дней с последней оценки баланса${focusText}. давай обновим? напиши «баланс» и пройдёмся по сферам`;
        }

        await bot.api.sendMessage(chatId, message);
        console.log(`Balance assessment reminder sent to user ${user.id} (${daysSinceLastAssessment} days since last)`);
      }
    } catch (err) {
      await trackError("balance-cron", err, { userId: user.id });
      console.warn(`Failed to check balance assessment for user ${user.id}:`, err);
    }
  }
}
