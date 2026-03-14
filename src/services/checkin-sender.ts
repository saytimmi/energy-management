import prisma from "../db.js";
import { sendCheckInMessage } from "../handlers/checkin.js";

export async function sendCheckInToAll(
  logType: "morning" | "evening"
): Promise<void> {
  const users = await prisma.user.findMany();

  console.log(
    `Sending ${logType} check-in to ${users.length} user(s)`
  );

  for (const user of users) {
    try {
      const chatId = Number(user.telegramId);
      await sendCheckInMessage(chatId, logType);
    } catch (err) {
      console.warn(
        `Failed to send ${logType} check-in to user ${user.id} (telegramId: ${user.telegramId}):`,
        err
      );
    }
  }
}
