import { Router, Request, Response } from "express";
import prisma from "../db.js";

const LIFE_AREAS = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"] as const;

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

const AREA_ICONS: Record<string, string> = {
  health: "🩺", career: "🚀", relationships: "💞",
  finances: "💎", family: "🏡", growth: "📚",
  recreation: "🧘", environment: "🌿",
};

const AREA_ASPECTS: Record<string, string[]> = {
  health: ["sleep", "activity", "nutrition", "wellbeing", "energy"],
  career: ["satisfaction", "growth", "income", "skills", "influence"],
  relationships: ["depth", "frequency", "conflicts", "support", "intimacy"],
  finances: ["income_expense", "cushion", "investments", "debts", "control"],
  family: ["time_together", "quality", "responsibilities", "harmony"],
  growth: ["learning", "reading", "new_skills", "challenges", "progress"],
  recreation: ["hobby", "vacation", "recharge", "pleasure", "balance"],
  environment: ["housing", "workspace", "comfort", "order", "aesthetics"],
};

const ASPECT_LABELS: Record<string, string> = {
  sleep: "Сон", activity: "Активность", nutrition: "Питание",
  wellbeing: "Самочувствие", energy: "Энергия",
  satisfaction: "Удовлетворённость", growth: "Рост", income: "Доход",
  skills: "Навыки", influence: "Влияние",
  depth: "Глубина", frequency: "Частота", conflicts: "Конфликты",
  support: "Поддержка", intimacy: "Близость",
  income_expense: "Доход/расход", cushion: "Подушка", investments: "Инвестиции",
  debts: "Долги", control: "Контроль",
  time_together: "Время вместе", quality: "Качество",
  responsibilities: "Обязанности", harmony: "Гармония",
  learning: "Обучение", reading: "Чтение", new_skills: "Новые навыки",
  challenges: "Вызовы", progress: "Прогресс",
  hobby: "Хобби", vacation: "Отпуск", recharge: "Перезагрузка",
  pleasure: "Удовольствие", balance: "Баланс",
  housing: "Жильё", workspace: "Рабочее место", comfort: "Комфорт",
  order: "Порядок", aesthetics: "Эстетика",
};

async function getLatestRatings(userId: number) {
  const ratings: Record<string, { score: number; subScores: Record<string, number> | null; note: string | null; createdAt: Date; assessmentType: string }> = {};
  for (const area of LIFE_AREAS) {
    const latest = await prisma.balanceRating.findFirst({
      where: { userId, area },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      ratings[area] = {
        score: latest.score,
        subScores: (latest as any).subScores as Record<string, number> | null,
        note: latest.note,
        createdAt: latest.createdAt,
        assessmentType: (latest as any).assessmentType ?? "subjective",
      };
    }
  }
  return ratings;
}

export default function balanceRoute(router: Router): void {
  // GET /api/balance — overview
  router.get("/balance", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    try {
      const ratings = await getLatestRatings(userId);
      const balanceGoals = await prisma.balanceGoal.findMany({ where: { userId } });
      const habits = await prisma.habit.findMany({
        where: { userId, isActive: true },
        select: { lifeArea: true },
      });
      const habitCounts: Record<string, number> = {};
      for (const h of habits) {
        if (h.lifeArea) habitCounts[h.lifeArea] = (habitCounts[h.lifeArea] || 0) + 1;
      }
      const allRatingDates = Object.values(ratings).map(r => r.createdAt);
      const lastAssessmentDate = allRatingDates.length > 0
        ? new Date(Math.max(...allRatingDates.map(d => d.getTime())))
        : null;

      const areas = LIFE_AREAS.map(area => {
        const rating = ratings[area];
        const goal = balanceGoals.find(g => g.area === area);
        return {
          area, label: AREA_LABELS[area], icon: AREA_ICONS[area],
          score: rating?.score ?? null,
          targetScore: goal?.targetScore ?? null,
          identity: goal?.identity ?? null,
          isFocus: goal?.isFocus ?? false,
          habitCount: habitCounts[area] ?? 0,
          lastRatedAt: rating?.createdAt?.toISOString() ?? null,
          assessmentType: rating?.assessmentType ?? null,
        };
      });

      const scored = areas.filter(a => a.score !== null);
      const avgScore = scored.length > 0
        ? Math.round((scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length) * 10) / 10
        : null;

      res.json({ areas, avgScore, ratedCount: scored.length, totalCount: LIFE_AREAS.length, lastAssessmentDate: lastAssessmentDate?.toISOString() ?? null });
    } catch (err) {
      console.error("Balance API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/balance/radar
  router.get("/balance/radar", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    try {
      const ratings = await getLatestRatings(userId);
      const balanceGoals = await prisma.balanceGoal.findMany({ where: { userId } });
      const points = LIFE_AREAS.map(area => {
        const rating = ratings[area];
        const goal = balanceGoals.find(g => g.area === area);
        return { area, label: AREA_LABELS[area], icon: AREA_ICONS[area], score: rating?.score ?? 0, targetScore: goal?.targetScore ?? null, isFocus: goal?.isFocus ?? false };
      });
      res.json({ points });
    } catch (err) {
      console.error("Balance radar API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/balance/:area
  router.get("/balance/:area", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const area = req.params.area as string;
    if (!LIFE_AREAS.includes(area as any)) { res.status(400).json({ error: "invalid_area" }); return; }
    try {
      const latestRating = await prisma.balanceRating.findFirst({ where: { userId, area }, orderBy: { createdAt: "desc" } });
      const history = await prisma.balanceRating.findMany({ where: { userId, area }, orderBy: { createdAt: "desc" }, take: 10 });
      const balanceGoal = await prisma.balanceGoal.findFirst({ where: { userId, area } });
      const habits = await prisma.habit.findMany({
        where: { userId, lifeArea: area, isActive: true },
        select: { id: true, name: true, icon: true, streakCurrent: true, consistency30d: true, stage: true, isDuration: true },
      });
      let autoMetrics: Record<string, number | null> = {};
      if (area === "health") {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const energyLogs = await prisma.energyLog.findMany({ where: { userId, createdAt: { gte: weekAgo } }, select: { physical: true } });
        if (energyLogs.length > 0) {
          autoMetrics.avgPhysicalEnergy = Math.round(energyLogs.reduce((sum, l) => sum + l.physical, 0) / energyLogs.length * 10) / 10;
        }
      }
      const aspects = AREA_ASPECTS[area] || [];
      const subScores = (latestRating as any)?.subScores as Record<string, number> | null;
      res.json({
        area, label: AREA_LABELS[area], icon: AREA_ICONS[area],
        score: latestRating?.score ?? null, subScores: subScores ?? null,
        aspects: aspects.map(a => ({ key: a, label: ASPECT_LABELS[a] || a, score: subScores?.[a] ?? null })),
        assessmentType: (latestRating as any)?.assessmentType ?? null,
        note: latestRating?.note ?? null, lastRatedAt: latestRating?.createdAt?.toISOString() ?? null,
        targetScore: balanceGoal?.targetScore ?? null, identity: balanceGoal?.identity ?? null,
        isFocus: balanceGoal?.isFocus ?? false, habits, autoMetrics,
        history: history.map(h => ({ score: h.score, note: h.note, subScores: (h as any).subScores ?? null, assessmentType: (h as any).assessmentType ?? "subjective", createdAt: h.createdAt.toISOString() })),
      });
    } catch (err) {
      console.error("Balance area API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/balance/goals
  router.post("/balance/goals", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const { area, targetScore, identity, isFocus } = req.body;
    if (!area || !LIFE_AREAS.includes(area)) { res.status(400).json({ error: "invalid_area" }); return; }
    try {
      const goal = await prisma.balanceGoal.upsert({
        where: { userId_area: { userId, area } },
        update: {
          ...(targetScore !== undefined ? { targetScore: Math.max(1, Math.min(10, targetScore)) } : {}),
          ...(identity !== undefined ? { identity } : {}),
          ...(isFocus !== undefined ? { isFocus } : {}),
        },
        create: { userId, area, targetScore: targetScore ? Math.max(1, Math.min(10, targetScore)) : 7, identity: identity ?? null, isFocus: isFocus ?? false },
      });
      res.json({ ok: true, goal });
    } catch (err) {
      console.error("Balance goals API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/balance/rate — bulk quick rating from Mini App
  router.post("/balance/rate", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const { ratings } = req.body as { ratings: Array<{ area: string; score: number; subScores?: Record<string, number> }> };

    if (!ratings || !Array.isArray(ratings) || ratings.length === 0) {
      res.status(400).json({ error: "ratings array required" }); return;
    }

    try {
      let updated = 0;
      for (const r of ratings) {
        if (!LIFE_AREAS.includes(r.area as any)) continue;
        if (!Number.isInteger(r.score) || r.score < 1 || r.score > 10) continue;

        await prisma.balanceRating.create({
          data: {
            userId,
            area: r.area,
            score: r.score,
            subScores: r.subScores ?? undefined,
            assessmentType: "quick",
          },
        });
        updated++;
      }
      res.json({ ok: true, updated });
    } catch (err) {
      console.error("Balance rate API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
