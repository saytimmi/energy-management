import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function historyRoute(router: Router): void {
  router.get("/history", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const period = (req.query.period as string) || "week";

    try {
      // Calculate date range
      const now = new Date();
      const daysBack = period === "month" ? 30 : 7;
      const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const logs = await prisma.energyLog.findMany({
        where: {
          userId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by date and average if multiple logs per day
      const grouped: Record<string, { physical: number[]; mental: number[]; emotional: number[]; spiritual: number[] }> = {};

      for (const log of logs) {
        const dateKey = log.createdAt.toISOString().split("T")[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = { physical: [], mental: [], emotional: [], spiritual: [] };
        }
        grouped[dateKey].physical.push(log.physical);
        grouped[dateKey].mental.push(log.mental);
        grouped[dateKey].emotional.push(log.emotional);
        grouped[dateKey].spiritual.push(log.spiritual);
      }

      const result = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => ({
          date,
          physical: Math.round(values.physical.reduce((s, v) => s + v, 0) / values.physical.length),
          mental: Math.round(values.mental.reduce((s, v) => s + v, 0) / values.mental.length),
          emotional: Math.round(values.emotional.reduce((s, v) => s + v, 0) / values.emotional.length),
          spiritual: Math.round(values.spiritual.reduce((s, v) => s + v, 0) / values.spiritual.length),
        }));

      res.json(result);
    } catch (err) {
      console.error("History API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
