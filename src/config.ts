import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  databaseUrl: process.env.DATABASE_URL || "file:./data/energy.db",
  webappUrl: process.env.WEBAPP_URL || "",
  morningCheckinCron: process.env.MORNING_CHECKIN_CRON || "0 9 * * *",
  eveningCheckinCron: process.env.EVENING_CHECKIN_CRON || "0 21 * * *",
  port: parseInt(process.env.PORT || "3000", 10),
};
