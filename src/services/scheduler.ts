import cron, { type ScheduledTask } from "node-cron";
import { config } from "../config.js";
import { sendCheckInToAll } from "./checkin-sender.js";

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
  });
  tasks.push(morningCheckin);
  console.log(`Morning check-in scheduled: ${config.morningCheckinCron}`);

  const eveningCheckin = cron.schedule(config.eveningCheckinCron, () => {
    sendCheckInToAll("evening");
  });
  tasks.push(eveningCheckin);
  console.log(`Evening check-in scheduled: ${config.eveningCheckinCron}`);
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  console.log("Scheduler stopped");
}
