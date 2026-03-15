import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function observationsRoute(router: Router): void {
  router.get("/observations", async (req: Request, res: Response) => {
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

      const observations = await prisma.observation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Group by date
      const grouped: Record<string, typeof observations> = {};
      for (const o of observations) {
        const dateKey = o.createdAt.toISOString().split("T")[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(o);
      }

      // Summary stats
      const typeCounts: Record<string, number> = {};
      const directionCounts: Record<string, number> = {};
      const triggers: string[] = [];

      for (const o of observations) {
        typeCounts[o.energyType] = (typeCounts[o.energyType] || 0) + 1;
        directionCounts[o.direction] = (directionCounts[o.direction] || 0) + 1;
        if (o.trigger) triggers.push(o.trigger);
      }

      res.json({
        observations,
        grouped,
        stats: { typeCounts, directionCounts, triggers, total: observations.length },
        user: { firstName: user.firstName },
      });
    } catch (err) {
      console.error("Observations API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
