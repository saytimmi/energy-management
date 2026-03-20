import cron, { type ScheduledTask } from "node-cron";
import { config } from "../config.js";
import { sendCheckInToAll } from "./checkin-sender.js";
import { runDailyHabitCron, runWeeklyHabitReset } from "./habit-cron.js";

const tasks: ScheduledTask[] = [];

export function startScheduler(): void {
  console.log("Scheduler started");

  // Heartbeat every 15 min — proves scheduler is alive without spamming logs
  const heartbeat = cron.schedule("*/15 * * * *", () => {
    console.log(`Scheduler heartbeat: ${new Date().toISOString()}`);
  });
  tasks.push(heartbeat);

  const morningCheckin = cron.schedule(config.morningCheckinCron, () => {
    sendCheckInToAll("morning");
  }, { timezone: "Asia/Shanghai" });
  tasks.push(morningCheckin);
  console.log(`Morning check-in scheduled: ${config.morningCheckinCron} (Asia/Shanghai)`);

  const eveningCheckin = cron.schedule(config.eveningCheckinCron, () => {
    sendCheckInToAll("evening");
  }, { timezone: "Asia/Shanghai" });
  tasks.push(eveningCheckin);
  console.log(`Evening check-in scheduled: ${config.eveningCheckinCron} (Asia/Shanghai)`);

  // Daily habit maintenance at midnight
  const habitDaily = cron.schedule("0 0 * * *", () => {
    runDailyHabitCron().catch(err => console.error("Daily habit cron failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(habitDaily);
  console.log("Daily habit cron scheduled: 0 0 * * * (Asia/Shanghai)");

  // Weekly freeze reset Monday midnight
  const habitWeekly = cron.schedule("0 0 * * 1", () => {
    runWeeklyHabitReset().catch(err => console.error("Weekly habit reset failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(habitWeekly);
  console.log("Weekly habit reset scheduled: 0 0 * * 1 (Asia/Shanghai)");
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  console.log("Scheduler stopped");
}
