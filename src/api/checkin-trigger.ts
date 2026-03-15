import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { sendCheckInMessage } from "../handlers/checkin.js";

export function checkinTriggerRoute(router: Router): void {
  router.get("/checkin-trigger", async (req: Request, res: Response) => {
    const telegramIdParam = req.query.telegramId as string | undefined;

    if (!telegramIdParam) {
      res.status(400).json({ error: "missing_telegram_id" });
      return;
    }

    try {
      const telegramId = BigInt(telegramIdParam);
      const user = await prisma.user.findUnique({ where: { telegramId } });

      if (!user) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }

      await sendCheckInMessage(Number(telegramId), "manual");
      res.json({ ok: true });
    } catch (err) {
      console.error("Check-in trigger error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
