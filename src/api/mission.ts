import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function missionRoute(router: Router): void {
  // GET /api/mission — get user's mission
  router.get("/mission", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const mission = await prisma.mission.findUnique({
        where: { userId },
      });

      if (!mission) {
        return res.json({
          identity: null,
          purpose: null,
          legacy: null,
          statement: null,
        });
      }

      res.json({
        identity: mission.identity,
        purpose: mission.purpose,
        legacy: mission.legacy,
        statement: mission.statement,
        updatedAt: mission.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[mission] GET error:", err);
      res.status(500).json({ error: "Failed to get mission" });
    }
  });

  // PUT /api/mission — update mission
  router.put("/mission", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { identity, purpose, legacy, statement } = req.body;

      const mission = await prisma.mission.upsert({
        where: { userId },
        create: {
          userId,
          identity: identity || null,
          purpose: purpose || null,
          legacy: legacy || null,
          statement: statement || null,
        },
        update: {
          ...(identity !== undefined && { identity }),
          ...(purpose !== undefined && { purpose }),
          ...(legacy !== undefined && { legacy }),
          ...(statement !== undefined && { statement }),
        },
      });

      res.json({
        identity: mission.identity,
        purpose: mission.purpose,
        legacy: mission.legacy,
        statement: mission.statement,
        updatedAt: mission.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[mission] PUT error:", err);
      res.status(500).json({ error: "Failed to update mission" });
    }
  });
}
