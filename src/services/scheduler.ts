import cron, { type ScheduledTask } from "node-cron";
import { sendScheduledCheckins } from "./checkin-sender.js";
import { runDailyHabitCron, runWeeklyHabitReset } from "./habit-cron.js";
import { sendWeeklyDigest } from "./weekly-digest.js";
import { sendRoutineReminders } from "./habit-cron.js";
import { checkBalanceAssessment } from "./balance-cron.js";
import { sendKaizenReminders } from "./kaizen-reminder.js";

const tasks: ScheduledTask[] = [];

export function startScheduler(): void {
  console.log("Scheduler started");

  // Heartbeat every 15 min — proves scheduler is alive without spamming logs
  const heartbeat = cron.schedule("*/15 * * * *", () => {
    console.log(`Scheduler heartbeat: ${new Date().toISOString()}`);
  });
  tasks.push(heartbeat);

  // Per-user timezone-aware checkins — runs every hour at :00
  // Checks each user's local time and sends morning (9:00) or evening (21:00)
  const checkins = cron.schedule("0 * * * *", () => {
    sendScheduledCheckins().catch(err => console.error("Scheduled checkin failed:", err));
  });
  tasks.push(checkins);
  console.log("Timezone-aware checkins scheduled: every hour at :00");

  // Daily habit maintenance at midnight UTC
  const habitDaily = cron.schedule("0 0 * * *", () => {
    runDailyHabitCron().catch(err => console.error("Daily habit cron failed:", err));
  });
  tasks.push(habitDaily);
  console.log("Daily habit cron scheduled: 0 0 * * *");

  // Weekly freeze reset Monday midnight UTC
  const habitWeekly = cron.schedule("0 0 * * 1", () => {
    runWeeklyHabitReset().catch(err => console.error("Weekly habit reset failed:", err));
  });
  tasks.push(habitWeekly);
  console.log("Weekly habit reset scheduled: 0 0 * * 1");

  // Habit routine reminders: morning 7:30, afternoon 13:00, evening 20:30
  // TODO: make these per-user timezone aware too
  const morningHabits = cron.schedule("30 7 * * *", () => {
    sendRoutineReminders("morning").catch(err => console.error("Morning habit reminder failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(morningHabits);

  const afternoonHabits = cron.schedule("0 13 * * *", () => {
    sendRoutineReminders("afternoon").catch(err => console.error("Afternoon habit reminder failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(afternoonHabits);

  const eveningHabits = cron.schedule("30 20 * * *", () => {
    sendRoutineReminders("evening").catch(err => console.error("Evening habit reminder failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(eveningHabits);
  console.log("Habit routine reminders scheduled: 7:30/13:00/20:30 (Asia/Shanghai)");

  // Weekly energy digest — Sunday 20:00
  const weeklyDigest = cron.schedule("0 20 * * 0", () => {
    sendWeeklyDigest().catch(err => console.error("Weekly digest failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(weeklyDigest);
  console.log("Weekly digest scheduled: 0 20 * * 0 (Asia/Shanghai)");

  // Balance assessment check — daily at 10:00, sends if >=14 days since last
  const balanceCheck = cron.schedule("0 10 * * *", () => {
    checkBalanceAssessment().catch(err => console.error("Balance assessment check failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(balanceCheck);
  console.log("Balance assessment check scheduled: 0 10 * * * (Asia/Shanghai)");

  // Kaizen morning reminder — daily at 8:00 AM
  const kaizenReminder = cron.schedule("0 8 * * *", () => {
    sendKaizenReminders().catch(err => console.error("Kaizen reminder failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(kaizenReminder);
  console.log("Kaizen reminder scheduled: 0 8 * * * (Asia/Shanghai)");
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  console.log("Scheduler stopped");
}
