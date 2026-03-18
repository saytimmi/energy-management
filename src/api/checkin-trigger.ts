import { Router, Request, Response } from "express";
import { sendCheckInMessage } from "../handlers/checkin.js";

export function checkinTriggerRoute(router: Router): void {
  router.get("/checkin-trigger", async (req: Request, res: Response) => {
    const telegramId = (req as any).telegramId as bigint;

    try {
      await sendCheckInMessage(Number(telegramId), "manual");
      res.json({ ok: true });
    } catch (err) {
      console.error("Check-in trigger error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
