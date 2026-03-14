import cron, { type ScheduledTask } from "node-cron";

const tasks: ScheduledTask[] = [];

export function startScheduler(): void {
  console.log("Scheduler started");

  // Heartbeat job — proves scheduler fires without manual trigger
  const heartbeat = cron.schedule("* * * * *", () => {
    console.log(`Scheduler heartbeat: ${new Date().toISOString()}`);
  });
  tasks.push(heartbeat);

  // TODO: Wire to bot check-in handler in Phase 3
  // const morningCheckin = cron.schedule("0 9 * * *", () => {
  //   // Morning check-in — 9:00 AM
  // });
  // tasks.push(morningCheckin);

  // TODO: Wire to bot check-in handler in Phase 3
  // const eveningCheckin = cron.schedule("0 21 * * *", () => {
  //   // Evening check-in — 9:00 PM
  // });
  // tasks.push(eveningCheckin);
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  console.log("Scheduler stopped");
}
