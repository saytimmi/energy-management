import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";
import { isOnVacation } from "./awareness.js";

/**
 * Morning kaizen reminder — checks if yesterday's reflection exists,
 * if not, sends a reminder with yesterday's context summary.
 * Runs at 8:00 AM daily.
 */
export async function sendKaizenReminders(userIds?: number[]): Promise<void> {
  const users = userIds
    ? await prisma.user.findMany({ where: { id: { in: userIds } } })
    : await prisma.user.findMany();

  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  console.log(`Kaizen reminder check for ${users.length} user(s), date: ${yesterday.toISOString().split("T")[0]}`);

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;
      // Check if reflection already exists for yesterday
      const reflection = await prisma.reflection.findFirst({
        where: {
          userId: user.id,
          date: {
            gte: yesterday,
            lt: today,
          },
        },
      });

      if (reflection) {
        continue; // Already reflected, skip
      }

      // Check if user has any recent activity (don't spam inactive users)
      const recentLog = await prisma.energyLog.findFirst({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
      });

      if (!recentLog) {
        continue; // Inactive user, skip
      }

      // Gather yesterday's context for the message
      const energyLogs = await prisma.energyLog.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: yesterday, lt: today },
        },
        orderBy: { createdAt: "asc" },
      });

      const habitLogs = await prisma.habitLog.findMany({
        where: {
          userId: user.id,
          date: yesterday,
        },
        include: {
          habit: { select: { name: true, icon: true } },
        },
      });

      const totalHabits = await prisma.habit.count({
        where: { userId: user.id, isActive: true },
      });

      // Build context summary
      let contextMsg = "";

      if (energyLogs.length > 0) {
        const last = energyLogs[energyLogs.length - 1];
        contextMsg += `\n🔋 Энергия: физ ${last.physical}, мент ${last.mental}, эмо ${last.emotional}, дух ${last.spiritual}`;
      }

      if (habitLogs.length > 0) {
        const names = habitLogs.slice(0, 3).map((l) => `${l.habit.icon} ${l.habit.name}`).join(", ");
        const extra = habitLogs.length > 3 ? ` +${habitLogs.length - 3}` : "";
        contextMsg += `\n⚡ Привычки: ${habitLogs.length}/${totalHabits} — ${names}${extra}`;
      }

      const chatId = Number(user.telegramId);
      const dateStr = yesterday.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

      await bot.api.sendMessage(
        chatId,
        `🧠 Время для кайдзен-часа!\n\nВчера (${dateStr}):${contextMsg || "\nДанных пока нет."}\n\nЧто было самым важным вчера? Напиши, и мы порефлексируем вместе.`
      );
    } catch (err) {
      await trackError("kaizen-reminder", err, { userId: user.id });
      console.warn(`Failed to send kaizen reminder to user ${user.id}:`, err);
    }
  }
}
