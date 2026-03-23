import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { getHabitEnergyCorrelation } from "../services/habit-correlation.js";

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function recalculateStreak(habitId: number): Promise<{ streakCurrent: number; streakBest: number }> {
  const logs = await prisma.habitLog.findMany({
    where: { habitId },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (logs.length === 0) {
    return { streakCurrent: 0, streakBest: 0 };
  }

  const today = todayDateOnly();
  const todayStr = formatDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  const dates = logs.map((l) => formatDate(l.date));

  // Streak must start from today or yesterday
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    const habit = await prisma.habit.findUnique({ where: { id: habitId }, select: { streakBest: true } });
    return { streakCurrent: 0, streakBest: habit?.streakBest ?? 0 };
  }

  let streakCurrent = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streakCurrent++;
    } else {
      break;
    }
  }

  const habit = await prisma.habit.findUnique({ where: { id: habitId }, select: { streakBest: true } });
  const streakBest = Math.max(streakCurrent, habit?.streakBest ?? 0);

  return { streakCurrent, streakBest };
}

export function habitsRoute(router: Router): void {
  // GET /api/habits/today — today's habits with completion status (must be before /:id routes)
  router.get("/habits/today", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      const today = todayDateOnly();
      const habits = await prisma.habit.findMany({
        where: { userId, isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          logs: {
            where: { date: today },
            take: 1,
          },
        },
      });

      const result = habits.map((h) => ({
        ...h,
        completedToday: h.logs.length > 0,
        logs: undefined,
      }));

      res.json(result);
    } catch (err) {
      console.error("Habits today API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/habits/heatmap — last 30 days heatmap
  router.get("/habits/heatmap", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      const today = todayDateOnly();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

      const activeHabits = await prisma.habit.count({
        where: { userId, isActive: true },
      });

      const logs = await prisma.habitLog.findMany({
        where: {
          userId,
          date: { gte: thirtyDaysAgo, lte: today },
        },
        select: { date: true },
      });

      // Group by date
      const countByDate: Record<string, number> = {};
      for (const log of logs) {
        const key = formatDate(log.date);
        countByDate[key] = (countByDate[key] || 0) + 1;
      }

      const heatmap = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const key = formatDate(d);
        heatmap.push({
          date: key,
          completedCount: countByDate[key] || 0,
          totalCount: activeHabits,
        });
      }

      res.json(heatmap);
    } catch (err) {
      console.error("Habits heatmap API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/habits — grouped by routineSlot
  router.get("/habits", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      const today = todayDateOnly();
      const habits = await prisma.habit.findMany({
        where: { userId, isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          logs: {
            where: { date: today },
            take: 1,
          },
        },
      });

      const grouped: Record<string, any[]> = {
        morning: [],
        afternoon: [],
        evening: [],
      };

      for (const h of habits) {
        const slot = h.routineSlot as string;
        const todayLog = h.logs[0] ?? null;
        const entry = {
          ...h,
          completedToday: todayLog?.status === "completed",
          inProgress: todayLog?.status === "started",
          startedAt: todayLog?.startedAt ?? null,
          logs: undefined,
        };
        if (grouped[slot]) {
          grouped[slot].push(entry);
        } else {
          grouped[slot] = [entry];
        }
      }

      res.json(grouped);
    } catch (err) {
      console.error("Habits API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/habits — create habit
  router.post("/habits", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      const { name, icon, type, routineSlot, duration, isDuration, energyType, lifeArea, triggerAction,
        whyToday, whyMonth, whyYear, whyIdentity, isItBeneficial,
        breakTrigger, replacement, microActionId, frequency, customDays } = req.body;

      if (!name || !icon || !type || !routineSlot) {
        res.status(400).json({ error: "Обязательные поля: name, icon, type, routineSlot" });
        return;
      }

      // Slot limit: max 3 active habits in seed/growth stages
      const activeCount = await prisma.habit.count({
        where: {
          userId,
          isActive: true,
          stage: { in: ["seed", "growth"] },
        },
      });

      if (activeCount >= 3) {
        res.status(400).json({ error: "Максимум 3 активные привычки в стадиях Посев/Рост" });
        return;
      }

      // Get next sortOrder
      const maxOrder = await prisma.habit.findFirst({
        where: { userId, isActive: true, routineSlot },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      const habit = await prisma.habit.create({
        data: {
          userId,
          name,
          icon,
          type,
          routineSlot,
          sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
          duration: duration ?? null,
          isDuration: isDuration ?? false,
          energyType: energyType ?? null,
          lifeArea: lifeArea ?? null,
          triggerAction: triggerAction ?? null,
          whyToday: whyToday ?? null,
          whyMonth: whyMonth ?? null,
          whyYear: whyYear ?? null,
          whyIdentity: whyIdentity ?? null,
          isItBeneficial: isItBeneficial ?? null,
          breakTrigger: breakTrigger ?? null,
          replacement: replacement ?? null,
          microActionId: microActionId ?? null,
          frequency: frequency ?? "daily",
          customDays: customDays ?? null,
          stage: "seed",
          stageUpdatedAt: new Date(),
        },
      });

      res.status(201).json(habit);
    } catch (err) {
      console.error("Habits create API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // PATCH /api/habits/:id — update habit
  router.patch("/habits/:id", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const habitId = parseInt(req.params.id as string, 10);

    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId) {
        res.status(404).json({ error: "Привычка не найдена" });
        return;
      }

      const allowedFields = [
        "name", "icon", "type", "routineSlot", "sortOrder", "duration",
        "energyType", "lifeArea", "triggerAction", "whyToday", "whyMonth", "whyYear",
        "whyIdentity", "isItBeneficial", "breakTrigger", "replacement",
        "microActionId", "frequency", "customDays", "stage",
      ];

      const data: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      if (data.stage && data.stage !== habit.stage) {
        data.stageUpdatedAt = new Date();
      }

      const updated = await prisma.habit.update({
        where: { id: habitId },
        data,
      });

      res.json(updated);
    } catch (err) {
      console.error("Habits update API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE /api/habits/:id — soft delete
  router.delete("/habits/:id", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const habitId = parseInt(req.params.id as string, 10);

    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId) {
        res.status(404).json({ error: "Привычка не найдена" });
        return;
      }

      await prisma.habit.update({
        where: { id: habitId },
        data: { isActive: false },
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Habits delete API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/habits/:id/start — start a duration-based habit
  router.post("/habits/:id/start", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const habitId = parseInt(req.params.id as string, 10);

    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId) {
        res.status(404).json({ error: "Привычка не найдена" });
        return;
      }

      const today = todayDateOnly();

      const existing = await prisma.habitLog.findUnique({
        where: { habitId_date: { habitId, date: today } },
      });

      if (existing) {
        res.json(existing);
        return;
      }

      const log = await prisma.habitLog.create({
        data: {
          habitId,
          userId,
          date: today,
          status: "started",
          startedAt: new Date(),
        },
      });

      res.status(201).json(log);
    } catch (err) {
      console.error("Habits start API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/habits/:id/complete — log completion
  router.post("/habits/:id/complete", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const habitId = parseInt(req.params.id as string, 10);

    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId) {
        res.status(404).json({ error: "Привычка не найдена" });
        return;
      }

      const today = todayDateOnly();

      // Check if there's an in-progress log (duration habit)
      const existing = await prisma.habitLog.findUnique({
        where: { habitId_date: { habitId, date: today } },
      });

      if (existing && existing.status === "completed") {
        res.json(existing);
        return;
      }

      if (existing && existing.status === "started") {
        // Complete the in-progress duration habit
        const updated = await prisma.habitLog.update({
          where: { id: existing.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            note: req.body?.note ?? existing.note,
          },
        });

        const { streakCurrent, streakBest } = await recalculateStreak(habitId);
        await prisma.habit.update({
          where: { id: habitId },
          data: { streakCurrent, streakBest },
        });

        res.json({ ...updated, streakCurrent, streakBest });
        return;
      }

      // Normal (instant) habit — create completed log
      const log = await prisma.habitLog.create({
        data: {
          habitId,
          userId,
          date: today,
          status: "completed",
          note: req.body?.note ?? null,
        },
      });

      const { streakCurrent, streakBest } = await recalculateStreak(habitId);
      await prisma.habit.update({
        where: { id: habitId },
        data: { streakCurrent, streakBest },
      });

      res.status(201).json({ ...log, streakCurrent, streakBest });
    } catch (err) {
      console.error("Habits complete API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE /api/habits/:id/complete — undo today's completion
  router.delete("/habits/:id/complete", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const habitId = parseInt(req.params.id as string, 10);

    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId) {
        res.status(404).json({ error: "Привычка не найдена" });
        return;
      }

      const today = todayDateOnly();

      const existing = await prisma.habitLog.findUnique({
        where: { habitId_date: { habitId, date: today } },
      });

      if (!existing) {
        res.status(404).json({ error: "Запись не найдена" });
        return;
      }

      await prisma.habitLog.delete({
        where: { id: existing.id },
      });

      // Recalculate streak
      const { streakCurrent, streakBest } = await recalculateStreak(habitId);
      await prisma.habit.update({
        where: { id: habitId },
        data: { streakCurrent, streakBest },
      });

      res.json({ success: true, streakCurrent, streakBest });
    } catch (err) {
      console.error("Habits uncomplete API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/habits/:id/correlation — habit-energy correlation
  router.get("/habits/:id/correlation", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const habitId = parseInt(req.params.id as string, 10);

    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId) {
        res.status(404).json({ error: "Привычка не найдена" });
        return;
      }

      const correlation = await getHabitEnergyCorrelation(habitId, userId);
      if (!correlation) {
        res.json({ insufficient: true });
        return;
      }

      res.json({ ...correlation, habitName: habit.name, habitIcon: habit.icon });
    } catch (err) {
      console.error("Habits correlation API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/habits/:id/stats — streak, consistency, heatmap, stage
  router.get("/habits/:id/stats", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const habitId = parseInt(req.params.id as string, 10);

    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId) {
        res.status(404).json({ error: "Привычка не найдена" });
        return;
      }

      const today = todayDateOnly();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

      const logs = await prisma.habitLog.findMany({
        where: {
          habitId,
          date: { gte: thirtyDaysAgo, lte: today },
        },
        select: { date: true },
      });

      const logDates = new Set(logs.map((l) => formatDate(l.date)));

      // Monthly heatmap
      const heatmap = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const key = formatDate(d);
        heatmap.push({ date: key, completed: logDates.has(key) });
      }

      // Consistency = completed days / 30
      const consistency30d = logs.length / 30;

      // Freezes: 1 per week, calculate used this week
      const freezesRemaining = Math.max(0, 1 - habit.freezesUsedThisWeek);

      res.json({
        streakCurrent: habit.streakCurrent,
        streakBest: habit.streakBest,
        consistency30d: Math.round(consistency30d * 100) / 100,
        freezesRemaining,
        stage: habit.stage,
        stageUpdatedAt: habit.stageUpdatedAt.toISOString(),
        heatmap,
      });
    } catch (err) {
      console.error("Habits stats API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
