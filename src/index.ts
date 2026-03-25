import { config, resolveBotUsername } from "./config.js";
import prisma from "./db.js";
import { bot, setupBot } from "./bot.js";
import { startScheduler, stopScheduler } from "./services/scheduler.js";
import { startServer, stopServer } from "./server.js";

async function main() {
  console.log("EnergyBot starting...");

  await prisma.$connect();
  console.log("Database connected");

  // Resolve bot username from Telegram API
  await resolveBotUsername(config.telegramBotToken);

  // Start HTTP server first — Mini App must be available
  startServer();
  console.log(`Mini App server started on port ${config.port}`);

  // Bot setup (non-fatal — don't crash if commands fail)
  try {
    await setupBot();
    console.log("Bot commands and menu configured");
  } catch (err) {
    console.warn("Bot setup warning (non-fatal):", err);
  }

  // Drop pending updates to avoid conflicts, then start polling
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  bot.start({
    onStart: () => console.log("Bot is running"),
    drop_pending_updates: true,
  });

  startScheduler();
}

process.on("SIGINT", () => {
  console.log("Shutting down...");
  stopScheduler();
  stopServer();
  bot.stop();
  prisma.$disconnect().then(() => {
    console.log("Shutdown complete");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  stopScheduler();
  stopServer();
  bot.stop();
  prisma.$disconnect().then(() => process.exit(0));
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
