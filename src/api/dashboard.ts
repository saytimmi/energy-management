import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function dashboardRoute(router: Router): void {
  router.get("/dashboard", async (req: Request, res: Response) => {
    const telegramIdParam = req.query.telegramId as string | undefined;

    if (!telegramIdParam) {
      res.status(400).json({ error: "missing_telegram_id" });
      return;
    }

    try {
      const telegramId = BigInt(telegramIdParam);

      const user = await prisma.user.findUnique({
        where: { telegramId },
      });

      if (!user) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }

      const latestLog = await prisma.energyLog.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (!latestLog) {
        res.json({ error: "no_data" });
        return;
      }

      res.json({
        physical: latestLog.physical,
        mental: latestLog.mental,
        emotional: latestLog.emotional,
        spiritual: latestLog.spiritual,
        loggedAt: latestLog.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("Dashboard API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
