import { Router, Request, Response } from "express";
import prisma from "../db.js";

function mapGoal(g: any) {
  return {
    id: g.id,
    lifeArea: g.lifeArea,
    title: g.title,
    description: g.description,
    timeHorizon: g.timeHorizon,
    period: g.period,
    status: g.status,
    progress: g.progress ?? 0,
    metric: g.metric ?? null,
    targetValue: g.targetValue ?? null,
    currentValue: g.currentValue ?? 0,
    milestones: g.milestones ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

export function goalsRoute(router: Router): void {
  // GET /api/goals — list goals with optional filters
  router.get("/goals", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { lifeArea, timeHorizon, status } = req.query;

      const where: Record<string, unknown> = { userId };
      if (lifeArea && typeof lifeArea === "string") where.lifeArea = lifeArea;
      if (timeHorizon && typeof timeHorizon === "string") where.timeHorizon = timeHorizon;
      if (status && typeof status === "string") {
        where.status = status;
      } else {
        where.status = "active";
      }

      const goals = await prisma.goal.findMany({
        where,
        orderBy: [{ timeHorizon: "asc" }, { lifeArea: "asc" }, { createdAt: "desc" }],
      });

      res.json(goals.map(mapGoal));
    } catch (err) {
      console.error("[goals] GET error:", err);
      res.status(500).json({ error: "Failed to get goals" });
    }
  });

  // POST /api/goals — create goal
  router.post("/goals", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { lifeArea, title, description, timeHorizon, period, metric, targetValue } = req.body;

      if (!lifeArea || !title || !timeHorizon || !period) {
        return res.status(400).json({ error: "lifeArea, title, timeHorizon, period required" });
      }

      const validAreas = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
      if (!validAreas.includes(lifeArea)) {
        return res.status(400).json({ error: `Invalid lifeArea: ${lifeArea}` });
      }

      const validHorizons = ["year", "quarter"];
      if (!validHorizons.includes(timeHorizon)) {
        return res.status(400).json({ error: `Invalid timeHorizon: ${timeHorizon}` });
      }

      const goal = await prisma.goal.create({
        data: {
          userId,
          lifeArea,
          title,
          description: description || null,
          timeHorizon,
          period,
          metric: metric || null,
          targetValue: targetValue ? parseFloat(targetValue) : null,
        },
      });

      res.json(mapGoal(goal));
    } catch (err) {
      console.error("[goals] POST error:", err);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  // PATCH /api/goals/:id — update goal
  router.patch("/goals/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const goalId = parseInt(req.params.id as string, 10);
      if (isNaN(goalId)) return res.status(400).json({ error: "Invalid goal ID" });

      const existing = await prisma.goal.findFirst({
        where: { id: goalId, userId },
      });
      if (!existing) return res.status(404).json({ error: "Goal not found" });

      const { title, description, status, progress, currentValue, milestones, metric, targetValue } = req.body;
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) {
        const validStatuses = ["active", "completed", "dropped"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: `Invalid status: ${status}` });
        }
        updateData.status = status;
      }
      if (progress !== undefined) {
        const p = parseInt(progress, 10);
        if (isNaN(p) || p < 0 || p > 100) {
          return res.status(400).json({ error: "progress must be 0-100" });
        }
        updateData.progress = p;
      }
      if (currentValue !== undefined) updateData.currentValue = parseFloat(currentValue);
      if (milestones !== undefined) updateData.milestones = milestones;
      if (metric !== undefined) updateData.metric = metric;
      if (targetValue !== undefined) updateData.targetValue = parseFloat(targetValue);

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const goal = await prisma.goal.update({
        where: { id: goalId },
        data: updateData,
      });

      res.json(mapGoal(goal));
    } catch (err) {
      console.error("[goals] PATCH error:", err);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });
}
