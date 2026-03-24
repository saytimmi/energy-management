import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function kaizenApiRoutes(router: Router): void {
  // ─── Reflection Status ──────────────────────────────────────────────
  // GET /api/reflection/status — check if yesterday's reflection is done + context
  router.get("/reflection/status", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      // Yesterday date (UTC)
      const now = new Date();
      const yesterday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

      // Check if reflection exists for yesterday
      const reflection = await prisma.reflection.findFirst({
        where: {
          userId,
          date: {
            gte: yesterday,
            lt: today,
          },
        },
      });

      // Gather yesterday's context
      const energyLogs = await prisma.energyLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        orderBy: { createdAt: "asc" },
        select: {
          physical: true,
          mental: true,
          emotional: true,
          spiritual: true,
          logType: true,
          createdAt: true,
        },
      });

      const habitLogs = await prisma.habitLog.findMany({
        where: {
          userId,
          date: yesterday,
        },
        include: {
          habit: {
            select: { name: true, icon: true, routineSlot: true },
          },
        },
      });

      const totalHabits = await prisma.habit.count({
        where: { userId, isActive: true },
      });

      const observations = await prisma.observation.findMany({
        where: {
          userId,
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          energyType: true,
          direction: true,
          trigger: true,
          context: true,
        },
      });

      res.json({
        done: !!reflection,
        reflection: reflection
          ? {
              id: reflection.id,
              summary: reflection.summary,
              insights: reflection.insights,
              createdAt: reflection.createdAt,
            }
          : null,
        context: {
          date: yesterday.toISOString().split("T")[0],
          energy: energyLogs,
          habits: {
            completed: habitLogs.map((l) => ({
              name: l.habit.name,
              icon: l.habit.icon,
              slot: l.habit.routineSlot,
            })),
            total: totalHabits,
          },
          observations,
        },
      });
    } catch (err) {
      console.error("Reflection status API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ─── Algorithms CRUD ────────────────────────────────────────────────
  // GET /api/algorithms — list with optional filters
  router.get("/algorithms", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const { lifeArea, q } = req.query;

    try {
      const where: Record<string, unknown> = { userId, isActive: true };

      if (lifeArea && typeof lifeArea === "string") {
        where.lifeArea = lifeArea;
      }

      // ILIKE search on title + context
      if (q && typeof q === "string" && q.trim()) {
        where.OR = [
          { title: { contains: q.trim(), mode: "insensitive" } },
          { context: { contains: q.trim(), mode: "insensitive" } },
        ];
      }

      const algorithms = await prisma.algorithm.findMany({
        where,
        orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          icon: true,
          lifeArea: true,
          steps: true,
          context: true,
          usageCount: true,
          lastUsedAt: true,
          createdAt: true,
        },
      });

      res.json({ algorithms });
    } catch (err) {
      console.error("Algorithms list API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/algorithms/:id — single algorithm detail
  router.get("/algorithms/:id", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    try {
      const algorithm = await prisma.algorithm.findFirst({
        where: { id, userId, isActive: true },
        include: {
          sourceReflection: {
            select: { id: true, date: true, summary: true },
          },
        },
      });

      if (!algorithm) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      // Increment usage count
      await prisma.algorithm.update({
        where: { id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      res.json({
        ...algorithm,
        usageCount: algorithm.usageCount + 1,
        lastUsedAt: new Date(),
      });
    } catch (err) {
      console.error("Algorithm detail API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // PATCH /api/algorithms/:id — update algorithm
  router.patch("/algorithms/:id", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    try {
      const existing = await prisma.algorithm.findFirst({
        where: { id, userId, isActive: true },
      });

      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const { title, steps, isActive } = req.body;
      const updateData: Record<string, unknown> = {};

      if (title !== undefined) updateData.title = title;
      if (steps !== undefined) updateData.steps = steps;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "no_fields" });
        return;
      }

      const updated = await prisma.algorithm.update({
        where: { id },
        data: updateData,
      });

      res.json(updated);
    } catch (err) {
      console.error("Algorithm update API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE /api/algorithms/:id — soft delete (isActive=false)
  router.delete("/algorithms/:id", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    try {
      const existing = await prisma.algorithm.findFirst({
        where: { id, userId, isActive: true },
      });

      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      await prisma.algorithm.update({
        where: { id },
        data: { isActive: false },
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Algorithm delete API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ─── Reflections Feed ───────────────────────────────────────────────
  // GET /api/reflections — paginated feed
  router.get("/reflections", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    try {
      const [reflections, total] = await Promise.all([
        prisma.reflection.findMany({
          where: { userId },
          orderBy: { date: "desc" },
          skip,
          take: limit,
          include: {
            algorithms: {
              where: { isActive: true },
              select: { id: true, title: true, icon: true },
            },
          },
        }),
        prisma.reflection.count({ where: { userId } }),
      ]);

      res.json({
        reflections: reflections.map((r) => ({
          id: r.id,
          date: r.date,
          summary: r.summary,
          insights: r.insights,
          algorithms: r.algorithms,
          createdAt: r.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Reflections list API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/reflections/:date — single reflection by date (YYYY-MM-DD)
  router.get("/reflections/:date", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const dateStr = req.params.date as string;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ error: "invalid_date_format" });
      return;
    }

    const dateStart = new Date(dateStr + "T00:00:00.000Z");
    const dateEnd = new Date(dateStr + "T23:59:59.999Z");

    try {
      const reflection = await prisma.reflection.findFirst({
        where: {
          userId,
          date: {
            gte: dateStart,
            lte: dateEnd,
          },
        },
        include: {
          algorithms: {
            where: { isActive: true },
            select: { id: true, title: true, icon: true, steps: true },
          },
        },
      });

      if (!reflection) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.json({
        id: reflection.id,
        date: reflection.date,
        summary: reflection.summary,
        insights: reflection.insights,
        energyContext: reflection.energyContext,
        habitsContext: reflection.habitsContext,
        algorithms: reflection.algorithms,
        createdAt: reflection.createdAt,
      });
    } catch (err) {
      console.error("Reflection detail API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
