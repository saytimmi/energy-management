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
      const tz = user.timezone || "Asia/Shanghai";
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

  // Every hour at :30 — check for habit reminders + other timed events
  const hourlyUserCrons = cron.schedule("0 * * * *", async () => {
    try {
      // Morning habits (local 7:00)
      const morning7 = await getUsersByLocalHour(7);
      if (morning7.length > 0) {
        sendRoutineReminders("morning").catch(err => console.error("Morning habit reminder failed:", err));
      }

      // Kaizen reminder (local 8:00)
      sendKaizenReminders().catch(err => console.error("Kaizen reminder failed:", err));

      // Smart nudge (local 9:00)
      sendDailyNudges().catch(err => console.error("Daily nudge failed:", err));

      // Balance check (local 10:00)
      checkBalanceAssessment().catch(err => console.error("Balance check failed:", err));

      // Afternoon habits (local 13:00)
      const afternoon = await getUsersByLocalHour(13);
      if (afternoon.length > 0) {
        sendRoutineReminders("afternoon").catch(err => console.error("Afternoon habit reminder failed:", err));
      }

      // Evening habits (local 20:00)
      const evening = await getUsersByLocalHour(20);
      if (evening.length > 0) {
        sendRoutineReminders("evening").catch(err => console.error("Evening habit reminder failed:", err));
      }

      // Weekly digest Sunday 20:00
      const now = new Date();
      if (now.getDay() === 0) {
        sendWeeklyDigest().catch(err => console.error("Weekly digest failed:", err));
      }

      // Quarterly review (1st of quarter months)
      const month = now.getMonth() + 1;
      const day = now.getDate();
      if ([1, 4, 7, 10].includes(month) && day === 1) {
        sendQuarterlyReview().catch(err => console.error("Quarterly review failed:", err));
      }

      // Yearly mission review (Jan 1)
      if (month === 1 && day === 1) {
        sendMissionReview().catch(err => console.error("Mission review failed:", err));
      }
    } catch (err) {
      console.error("Hourly user crons failed:", err);
    }
  });
  tasks.push(hourlyUserCrons);
  console.log("Timezone-aware user crons scheduled: every hour at :00");
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  console.log("Scheduler stopped");
}
