import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function observationsRoute(router: Router): void {
  router.get("/observations", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      const observations = await prisma.observation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Deduplicate: remove entries with same energyType+direction+trigger within 1 hour
      const deduped: typeof observations = [];
      for (const o of observations) {
        const isDupe = deduped.some(d =>
          d.energyType === o.energyType &&
          d.direction === o.direction &&
          d.trigger && o.trigger &&
          d.trigger.slice(0, 20) === o.trigger.slice(0, 20) &&
          Math.abs(new Date(d.createdAt).getTime() - new Date(o.createdAt).getTime()) < 3600000
        );
        if (!isDupe) deduped.push(o);
      }

      // Group by date
      const grouped: Record<string, typeof observations> = {};
      for (const o of deduped) {
        const dateKey = o.createdAt.toISOString().split("T")[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(o);
      }

      // Summary stats (from deduped)
      const typeCounts: Record<string, number> = {};
      const directionCounts: Record<string, number> = {};
      const triggers: string[] = [];

      for (const o of deduped) {
        typeCounts[o.energyType] = (typeCounts[o.energyType] || 0) + 1;
        directionCounts[o.direction] = (directionCounts[o.direction] || 0) + 1;
        if (o.trigger) triggers.push(o.trigger);
      }

      res.json({
        observations: deduped,
        grouped,
        stats: { typeCounts, directionCounts, triggers, total: deduped.length },
      });
    } catch (err) {
      console.error("Observations API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
