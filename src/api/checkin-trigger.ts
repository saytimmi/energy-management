import { Router, Request, Response } from "express";
import { sendCheckInMessage } from "../handlers/checkin.js";

// Dedup: track recent triggers per user (telegramId → timestamp)
const recentTriggers = new Map<number, number>();

export function checkinTriggerRoute(router: Router): void {
  router.get("/checkin-trigger", async (req: Request, res: Response) => {
    const telegramId = (req as any).telegramId as bigint;
    const tgId = Number(telegramId);

    // Server-side dedup: 30 second cooldown
    const lastTrigger = recentTriggers.get(tgId);
    if (lastTrigger && Date.now() - lastTrigger < 30_000) {
      res.json({ ok: true, alreadySent: true });
      return;
    }

    try {
      recentTriggers.set(tgId, Date.now());
      await sendCheckInMessage(tgId, "manual");
      res.json({ ok: true });
    } catch (err) {
      recentTriggers.delete(tgId);
      console.error("Check-in trigger error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
