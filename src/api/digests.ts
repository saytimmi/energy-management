import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function digestsRoute(router: Router): void {
  // GET /api/digests — last 10 weekly digests
  router.get("/digests", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      const digests = await prisma.weeklyDigest.findMany({
        where: { userId },
        orderBy: { weekStart: "desc" },
        take: 10,
      });

      res.json(digests.map(d => ({
        id: d.id,
        weekStart: d.weekStart.toISOString(),
        content: d.content,
        summary: d.summary,
        createdAt: d.createdAt.toISOString(),
      })));
    } catch (err) {
      console.error("[digests] GET error:", err);
      res.status(500).json({ error: "Failed to get digests" });
    }
  });

  // GET /api/digests/:weekStart — specific digest
  router.get("/digests/:weekStart", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const weekStart = new Date(req.params.weekStart as string);

      if (isNaN(weekStart.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }

      const digest = await prisma.weeklyDigest.findUnique({
        where: {
          userId_weekStart: { userId, weekStart },
        },
      });

      if (!digest) {
        return res.status(404).json({ error: "Digest not found" });
      }

      res.json({
        id: digest.id,
        weekStart: digest.weekStart.toISOString(),
        content: digest.content,
        summary: digest.summary,
        createdAt: digest.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("[digests] GET by week error:", err);
      res.status(500).json({ error: "Failed to get digest" });
    }
  });
}
