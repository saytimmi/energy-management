import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { analyzeSeverity, getTriggersForSeverity } from "../services/energy-analysis.js";
import { getInstantRecommendations, type EnergyValues } from "../services/instant-recommendations.js";
import { config } from "../config.js";

export async function createEnergyLog(userId: number, input: {
  physical: number; mental: number; emotional: number; spiritual: number; logType: string;
}) {
  const { physical, mental, emotional, spiritual, logType } = input;

  for (const val of [physical, mental, emotional, spiritual]) {
    if (!Number.isInteger(val) || val < 1 || val > 10) {
      throw new Error("Energy values must be integers 1-10");
    }
  }

  // Dedup: update if <5min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentLog = await prisma.energyLog.findFirst({
    where: { userId, createdAt: { gte: fiveMinAgo } },
    orderBy: { createdAt: "desc" },
  });

  let logId: number;
  if (recentLog) {
    await prisma.energyLog.update({
      where: { id: recentLog.id },
      data: { physical, mental, emotional, spiritual, logType },
    });
    logId = recentLog.id;
  } else {
    const newLog = await prisma.energyLog.create({
      data: { userId, physical, mental, emotional, spiritual, logType },
    });
    logId = newLog.id;
  }

  // Severity analysis — find previous same-slot checkin
  const current: EnergyValues = { physical, mental, emotional, spiritual };
  const previousLog = await prisma.energyLog.findFirst({
    where: {
      userId,
      logType,
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });

  const previous: EnergyValues | null = previousLog
    ? { physical: previousLog.physical, mental: previousLog.mental, emotional: previousLog.emotional, spiritual: previousLog.spiritual }
    : null;

  const severity = analyzeSeverity(current, previous);

  // Recommendations for drops
  let recommendations: Array<{ name: string; duration: number }> = [];
  if (severity.drops.length > 0) {
    const recResult = getInstantRecommendations(current, undefined, undefined);
    recommendations = recResult.recommendations.slice(0, 5).map(r => ({ name: r.name, duration: r.duration }));
  }

  // Build trigger info for worst change
  let triggerInfo: { energyType: string; direction: string; triggers: string[] } | null = null;
  if (severity.drops.length > 0) {
    const worst = [...severity.drops].sort((a, b) => b.drop - a.drop)[0];
    triggerInfo = {
      energyType: worst.type,
      direction: "drop",
      triggers: getTriggersForSeverity(worst.severity, worst.type),
    };
  } else if (severity.improvements.length > 0) {
    const best = [...severity.improvements].sort((a, b) => a.drop - b.drop)[0];
    triggerInfo = {
      energyType: best.type,
      direction: "rise",
      triggers: getTriggersForSeverity("improved", best.type),
    };
  }

  return { logId, severity, recommendations, triggerInfo };
}

export function energyRoute(router: Router): void {
  // POST /api/energy — create energy log from Mini App
  router.post("/energy", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    try {
      const result = await createEnergyLog(userId, req.body);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("1-10")) {
        res.status(400).json({ error: err.message });
      } else {
        console.error("Energy API error:", err);
        res.status(500).json({ error: "internal_error" });
      }
    }
  });

  // POST /api/energy/:logId/triggers — save triggers/observations
  router.post("/energy/:logId/triggers", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const logId = parseInt(req.params.logId, 10);
    if (isNaN(logId)) { res.status(400).json({ error: "invalid_logId" }); return; }

    const { triggers, context, energyType, direction } = req.body as {
      triggers: string[];
      context?: string;
      energyType: string;
      direction: string;
    };

    if (!triggers || !Array.isArray(triggers) || triggers.length === 0) {
      res.status(400).json({ error: "triggers required" }); return;
    }

    try {
      const observationIds: number[] = [];
      for (const trigger of triggers) {
        const obs = await prisma.observation.create({
          data: {
            userId,
            energyType,
            direction,
            trigger,
            context: context || null,
            energyLogId: logId,
          },
        });
        observationIds.push(obs.id);
      }
      res.json({ ok: true, observationIds });
    } catch (err) {
      console.error("Triggers API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

// Public route (no auth) for config
export function configRoute(router: Router): void {
  router.get("/config", (_req: Request, res: Response) => {
    res.json({
      botUsername: config.botUsername,
      webappUrl: config.webappUrl,
    });
  });
}
