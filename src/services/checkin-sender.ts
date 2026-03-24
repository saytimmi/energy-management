import prisma from "../db.js";
import { sendCheckInMessage } from "../handlers/checkin.js";
import { trackError } from "./monitor.js";
import { isOnVacation } from "./awareness.js";

/**
 * Send checkin to all users — legacy, used as fallback.
 */
export async function sendCheckInToAll(
  logType: "morning" | "evening"
): Promise<void> {
  const users = await prisma.user.findMany();

  console.log(
    `Sending ${logType} check-in to ${users.length} user(s)`
  );

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;
      const chatId = Number(user.telegramId);
      await sendCheckInMessage(chatId, logType);
    } catch (err) {
      await trackError("scheduler", err, { logType, userId: user.id });
      console.warn(
        `Failed to send ${logType} check-in to user ${user.id} (telegramId: ${user.telegramId}):`,
        err
      );
    }
  }
}

/**
 * Per-user timezone-aware checkin sender.
 * Called every hour — checks each user's local time and sends if it's 9:00 or 21:00.
 */
export async function sendScheduledCheckins(): Promise<void> {
  const users = await prisma.user.findMany();

  for (const user of users) {
    try {
      const tz = user.timezone || "Asia/Shanghai";
      const now = new Date();
      const localHour = parseInt(
        now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }),
        10
      );

      let logType: "morning" | "evening" | null = null;
      if (localHour === 9) logType = "morning";
      if (localHour === 21) logType = "evening";

      if (!logType) continue;

      // Dedup: don't send if already sent today for this type
      const todayStart = new Date(
        now.toLocaleDateString("en-CA", { timeZone: tz }) + "T00:00:00"
      );
      const recentLog = await prisma.energyLog.findFirst({
        where: {
          userId: user.id,
          logType,
          createdAt: { gte: todayStart },
        },
      });
      if (recentLog) continue;

      const chatId = Number(user.telegramId);
      console.log(`Sending ${logType} check-in to user ${user.id} (tz: ${tz}, localHour: ${localHour})`);
      await sendCheckInMessage(chatId, logType);
    } catch (err) {
      await trackError("scheduler", err, { userId: user.id });
      console.warn(`Failed scheduled checkin for user ${user.id}:`, err);
    }
  }
}
