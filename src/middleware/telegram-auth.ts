import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import prisma from "../db.js";
import { config } from "../config.js";

export interface TelegramUser {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export function validateInitData(initData: string, botToken: string): boolean {
  if (!initData) return false;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    // Check auth_date expiry (24 hours) to prevent replay attacks
    const authDate = params.get("auth_date");
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authTimestamp > 86400) return false; // expired (24h)
    }

    params.delete("hash");
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    // Timing-safe comparison to prevent timing attacks
    const hashBuf = Buffer.from(hash, "hex");
    const computedBuf = Buffer.from(computed, "hex");
    if (hashBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, computedBuf);
  } catch {
    return false;
  }
}

export function parseInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    if (!user.id) return null;
    return {
      telegramId: user.id,
      firstName: user.first_name || "",
      lastName: user.last_name,
      username: user.username,
    };
  } catch {
    return null;
  }
}

export function telegramAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("tma ")) {
    const initData = authHeader.slice(4);
    if (!validateInitData(initData, config.telegramBotToken)) {
      res.status(401).json({ error: "invalid_init_data" });
      return;
    }
    const tgUser = parseInitData(initData);
    if (!tgUser) {
      res.status(401).json({ error: "invalid_user_data" });
      return;
    }
    prisma.user
      .findUnique({ where: { telegramId: BigInt(tgUser.telegramId) } })
      .then((user) => {
        if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
        (req as any).userId = user.id;
        (req as any).telegramId = BigInt(tgUser.telegramId);
        next();
      })
      .catch(() => { res.status(500).json({ error: "internal_error" }); });
    return;
  }

  res.status(401).json({ error: "missing_auth" });
}
