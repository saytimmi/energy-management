/**
 * In-memory tracking of Telegram users who blocked the bot.
 * Prevents cron spam (403 errors) until next deploy/restart.
 */

const blockedUsers = new Set<number>();

export function markBlocked(telegramId: number): void {
  blockedUsers.add(telegramId);
  console.log(`[blocked-users] User ${telegramId} marked as blocked`);
}

export function isUserBlocked(telegramId: number): boolean {
  return blockedUsers.has(telegramId);
}

/**
 * Check if a Telegram API error is a "bot was blocked" error.
 * If so, mark user as blocked and return true.
 */
export function handleSendError(err: unknown, telegramId: number): boolean {
  const msg = String(err);
  if (msg.includes("403") || msg.includes("bot was blocked") || msg.includes("Forbidden")) {
    markBlocked(telegramId);
    return true;
  }
  return false;
}
