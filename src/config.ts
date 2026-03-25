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
  botUsername: process.env.BOT_USERNAME || "",
};

/** Resolve bot username via Telegram API (called once at startup) */
export async function resolveBotUsername(token: string): Promise<void> {
  if (config.botUsername) return; // already set via env
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { username?: string } };
    if (data.ok && data.result?.username) {
      config.botUsername = data.result.username;
      console.log(`Bot username resolved: @${config.botUsername}`);
    }
  } catch (err) {
    console.warn("Failed to resolve bot username:", err);
  }
}
