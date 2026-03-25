import cron, { type ScheduledTask } from "node-cron";
import prisma from "../db.js";
import { sendScheduledCheckins } from "./checkin-sender.js";
import { runDailyHabitCron, runWeeklyHabitReset } from "./habit-cron.js";
import { sendWeeklyDigest } from "./weekly-digest.js";
import { sendRoutineReminders } from "./habit-cron.js";
import { checkBalanceAssessment } from "./balance-cron.js";
import { sendKaizenReminders } from "./kaizen-reminder.js";
import { sendQuarterlyReview, sendMissionReview } from "./strategy-cron.js";
import { sendDailyNudges } from "./smart-nudges.js";

const tasks: ScheduledTask[] = [];

/**
 * Get users whose local hour matches the target.
 * Uses IANA timezone from user.timezone.
 */
async function getUsersByLocalHour(targetHour: number, targetMinute: number = 0): Promise<number[]> {
  const users = await prisma.user.findMany({ select: { id: true, timezone: true } });
  const matching: number[] = [];

  for (const user of users) {
    try {
      const tz = user.timezone || "UTC";
      const now = new Date();
      const localTime = now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false });
      const [h, m] = localTime.split(":").map(Number);
      if (h === targetHour && (targetMinute === 0 || m === targetMinute)) {
        matching.push(user.id);
      }
    } catch {
      // Invalid timezone — skip
    }
  }

  return matching;
}

export function startScheduler(): void {
  console.log("Scheduler started");

  // Heartbeat every 15 min
  const heartbeat = cron.schedule("*/15 * * * *", () => {
    console.log(`Scheduler heartbeat: ${new Date().toISOString()}`);
  });
  tasks.push(heartbeat);

  // Per-user timezone-aware checkins — already hourly
  const checkins = cron.schedule("0 * * * *", () => {
    sendScheduledCheckins().catch(err => console.error("Scheduled checkin failed:", err));
  });
  tasks.push(checkins);
  console.log("Timezone-aware checkins scheduled: every hour at :00");

  // Daily habit maintenance at midnight UTC (internal, not user-facing)
  const habitDaily = cron.schedule("0 0 * * *", () => {
    runDailyHabitCron().catch(err => console.error("Daily habit cron failed:", err));
  });
  tasks.push(habitDaily);

  // Weekly freeze reset Monday midnight UTC (internal)
  const habitWeekly = cron.schedule("0 0 * * 1", () => {
    runWeeklyHabitReset().catch(err => console.error("Weekly habit reset failed:", err));
  });
  tasks.push(habitWeekly);

  // === TIMEZONE-AWARE USER-FACING CRONS (hourly poll) ===

  const hourlyUserCrons = cron.schedule("0 * * * *", async () => {
    try {
      // Morning habits (local 7:00)
      const morning7 = await getUsersByLocalHour(7);
      if (morning7.length > 0) {
        sendRoutineReminders("morning", morning7).catch(err => console.error("Morning habit reminder failed:", err));
      }

      // Kaizen reminder (local 8:00)
      const kaizen8 = await getUsersByLocalHour(8);
      if (kaizen8.length > 0) {
        sendKaizenReminders(kaizen8).catch(err => console.error("Kaizen reminder failed:", err));
      }

      // Smart nudge (local 9:00)
      const nudge9 = await getUsersByLocalHour(9);
      if (nudge9.length > 0) {
        sendDailyNudges(nudge9).catch(err => console.error("Daily nudge failed:", err));
      }

      // Balance check (local 10:00)
      const balance10 = await getUsersByLocalHour(10);
      if (balance10.length > 0) {
        checkBalanceAssessment(balance10).catch(err => console.error("Balance check failed:", err));
      }

      // Afternoon habits (local 13:00)
      const afternoon = await getUsersByLocalHour(13);
      if (afternoon.length > 0) {
        sendRoutineReminders("afternoon", afternoon).catch(err => console.error("Afternoon habit reminder failed:", err));
      }

      // Evening habits (local 20:00)
      const evening = await getUsersByLocalHour(20);
      if (evening.length > 0) {
        sendRoutineReminders("evening", evening).catch(err => console.error("Evening habit reminder failed:", err));
      }

      // Weekly digest Sunday 20:00 local
      const digest20sun = await getUsersByLocalHour(20);
      const now = new Date();
      // Check if it's Sunday for any of these users (using their local time)
      if (digest20sun.length > 0) {
        const sundayUsers = await filterUsersByLocalDay(digest20sun, 0); // 0 = Sunday
        if (sundayUsers.length > 0) {
          sendWeeklyDigest(sundayUsers).catch(err => console.error("Weekly digest failed:", err));
        }
      }

      // Quarterly review (1st of quarter months) — local 10:00
      if (balance10.length > 0) {
        const quarterUsers = await filterUsersByLocalDate(balance10, [1, 4, 7, 10], 1);
        if (quarterUsers.length > 0) {
          sendQuarterlyReview(quarterUsers).catch(err => console.error("Quarterly review failed:", err));
        }
      }

      // Yearly mission review (Jan 1) — local 10:00
      if (balance10.length > 0) {
        const yearUsers = await filterUsersByLocalDate(balance10, [1], 1);
        if (yearUsers.length > 0) {
          sendMissionReview(yearUsers).catch(err => console.error("Mission review failed:", err));
        }
      }
    } catch (err) {
      console.error("Hourly user crons failed:", err);
    }
  });
  tasks.push(hourlyUserCrons);
  console.log("Timezone-aware user crons scheduled: every hour at :00");
}

/**
 * Filter user IDs by local day of week (0=Sunday, 1=Monday, etc.)
 */
async function filterUsersByLocalDay(userIds: number[], targetDay: number): Promise<number[]> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, timezone: true },
  });
  return users.filter(u => {
    try {
      const tz = u.timezone || "UTC";
      const day = parseInt(new Date().toLocaleString("en-US", { timeZone: tz, weekday: "narrow" }), 10);
      // weekday narrow gives locale-specific, use getDay equivalent
      const localDay = new Date(new Date().toLocaleString("en-US", { timeZone: tz })).getDay();
      return localDay === targetDay;
    } catch { return false; }
  }).map(u => u.id);
}

/**
 * Filter user IDs by local month + day-of-month
 */
async function filterUsersByLocalDate(userIds: number[], months: number[], dayOfMonth: number): Promise<number[]> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, timezone: true },
  });
  return users.filter(u => {
    try {
      const tz = u.timezone || "UTC";
      const localDate = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      return months.includes(localDate.getMonth() + 1) && localDate.getDate() === dayOfMonth;
    } catch { return false; }
  }).map(u => u.id);
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  console.log("Scheduler stopped");
}
