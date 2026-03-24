import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";
import { isOnVacation } from "./awareness.js";

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

/**
 * Quarterly goal review — sent on 1st of Jan/Apr/Jul/Oct.
 * Shows progress per area (balance score change + goal completion).
 * Prompts user to review goals with AI.
 */
export async function sendQuarterlyReview(): Promise<void> {
  const users = await prisma.user.findMany();

  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevYear = quarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
  const prevPeriod = `Q${prevQuarter} ${prevYear}`;
  const currentPeriod = `Q${quarter} ${now.getFullYear()}`;

  console.log(`[strategy-cron] Sending quarterly review for ${currentPeriod} to ${users.length} user(s)`);

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;
      // Get goals for previous quarter
      const prevGoals = await prisma.goal.findMany({
        where: { userId: user.id, period: prevPeriod },
      });

      // Get focus areas
      const focusAreas = await prisma.balanceGoal.findMany({
        where: { userId: user.id, isFocus: true },
      });

      // Build message
      const lines: string[] = [`🎯 *Пересмотр целей — ${currentPeriod}*\n`];

      if (prevGoals.length > 0) {
        lines.push(`*Итоги ${prevPeriod}:*`);
        for (const g of prevGoals) {
          const areaLabel = AREA_LABELS[g.lifeArea] || g.lifeArea;
          const statusIcon = g.status === "completed" ? "✅" : g.status === "dropped" ? "❌" : "⏳";
          lines.push(`${statusIcon} ${areaLabel}: ${g.title}`);
        }
        lines.push("");
      }

      if (focusAreas.length > 0) {
        lines.push("*Сферы в фокусе:*");
        for (const fa of focusAreas) {
          const label = AREA_LABELS[fa.area] || fa.area;
          const identity = fa.identity ? ` — ${fa.identity}` : "";
          lines.push(`— ${label}${identity}`);
        }
        lines.push("");
      }

      lines.push("Давай обсудим цели на новый квартал. Напиши мне, и мы поставим конкретные цели для каждой сферы.");

      const chatId = Number(user.telegramId);
      await bot.api.sendMessage(chatId, lines.join("\n"), { parse_mode: "Markdown" });
    } catch (err) {
      await trackError("strategy-cron-quarterly", err, { userId: user.id });
    }
  }
}

/**
 * Yearly mission review — sent on January 1st.
 * Asks if mission still resonates, invites user to update.
 */
export async function sendMissionReview(): Promise<void> {
  const users = await prisma.user.findMany();

  console.log(`[strategy-cron] Sending yearly mission review to ${users.length} user(s)`);

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;
      const mission = await prisma.mission.findUnique({
        where: { userId: user.id },
      });

      const chatId = Number(user.telegramId);

      if (mission?.statement) {
        const daysSinceUpdate = Math.round((Date.now() - mission.updatedAt.getTime()) / (1000 * 60 * 60 * 24));

        await bot.api.sendMessage(chatId,
          `🧭 *Годовой пересмотр миссии*\n\n` +
          `Твоя миссия (${daysSinceUpdate} дней назад):\n` +
          `_"${mission.statement}"_\n\n` +
          `Это всё ещё резонирует? Напиши мне, если хочешь обновить.`,
          { parse_mode: "Markdown" },
        );
      } else {
        await bot.api.sendMessage(chatId,
          `🧭 *Новый год — время определить миссию*\n\n` +
          `У тебя ещё нет сформулированной миссии. Это 3 простых вопроса — напиши мне, и мы пройдём их за 5 минут.`,
          { parse_mode: "Markdown" },
        );
      }
    } catch (err) {
      await trackError("strategy-cron-yearly", err, { userId: user.id });
    }
  }
}
