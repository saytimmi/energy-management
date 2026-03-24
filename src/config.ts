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
  groqApiKey: process.env.GROQ_API_KEY || "",
  databaseUrl: process.env.DATABASE_URL || "file:./data/energy.db",
  webappUrl: process.env.WEBAPP_URL || "",
  port: parseInt(process.env.PORT || "3000", 10),
  botUsername: process.env.BOT_USERNAME || "energy_coach_bot",
};
