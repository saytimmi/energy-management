import { config } from "./config.js";
import prisma from "./db.js";
import { bot, setupBot } from "./bot.js";
import { startScheduler, stopScheduler } from "./services/scheduler.js";

async function main() {
  console.log("EnergyBot starting...");
  console.log(`Database URL: ${config.databaseUrl}`);

  await prisma.$connect();
  console.log("Database connected");

  await setupBot();
  console.log("Bot commands and menu configured");

  bot.start({
    onStart: () => console.log("Bot is running"),
  });

  startScheduler();
}

process.on("SIGINT", () => {
  console.log("Shutting down...");
  stopScheduler();
  bot.stop();
  prisma.$disconnect().then(() => {
    console.log("Shutdown complete");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  stopScheduler();
  bot.stop();
  prisma.$disconnect().then(() => process.exit(0));
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
