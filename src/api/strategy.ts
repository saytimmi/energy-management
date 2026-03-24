import { Router, Request, Response } from "express";
import prisma from "../db.js";

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

const ALL_AREAS = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];

export function strategyRoute(router: Router): void {
  // GET /api/strategy — combined: mission + goals + identities + focus areas
  router.get("/strategy", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      // Fetch all data in parallel
      const [mission, goals, balanceGoals, latestRatings] = await Promise.all([
        prisma.mission.findUnique({ where: { userId } }),
        prisma.goal.findMany({
          where: { userId, status: "active" },
          orderBy: [{ timeHorizon: "asc" }, { createdAt: "desc" }],
        }),
        prisma.balanceGoal.findMany({ where: { userId } }),
        getLatestRatings(userId),
      ]);

      // Build areas with goals, identity, focus, balance score
      const focusAreas: StrategyArea[] = [];
      const otherAreas: StrategyArea[] = [];

      for (const area of ALL_AREAS) {
        const bg = balanceGoals.find(b => b.area === area);
        const rating = latestRatings.find(r => r.area === area);
        const areaGoals = goals.filter(g => g.lifeArea === area);
        const yearGoals = areaGoals.filter(g => g.timeHorizon === "year");
        const quarterGoals = areaGoals.filter(g => g.timeHorizon === "quarter");

        // Fetch habits for this area
        const habits = await prisma.habit.findMany({
          where: { userId, lifeArea: area, isActive: true },
          select: { id: true, name: true, icon: true, streakCurrent: true, consistency30d: true },
        });

        const areaData: StrategyArea = {
          area,
          label: AREA_LABELS[area] || area,
          icon: AREA_ICONS[area] || "📌",
          score: rating?.score ?? null,
          targetScore: bg?.targetScore ?? null,
          identity: bg?.identity ?? null,
          isFocus: bg?.isFocus ?? false,
          yearGoals: yearGoals.map(g => ({
            id: g.id, title: g.title, description: g.description, period: g.period, status: g.status,
          })),
          quarterGoals: quarterGoals.map(g => ({
            id: g.id, title: g.title, description: g.description, period: g.period, status: g.status,
          })),
          habits: habits.map(h => ({
            id: h.id, name: h.name, icon: h.icon, streak: h.streakCurrent, consistency: h.consistency30d,
          })),
        };

        if (bg?.isFocus) {
          focusAreas.push(areaData);
        } else {
          otherAreas.push(areaData);
        }
      }

      res.json({
        mission: mission ? {
          identity: mission.identity,
          purpose: mission.purpose,
          legacy: mission.legacy,
          statement: mission.statement,
          updatedAt: mission.updatedAt.toISOString(),
        } : null,
        focusAreas,
        otherAreas,
      });
    } catch (err) {
      console.error("[strategy] GET error:", err);
      res.status(500).json({ error: "Failed to get strategy" });
    }
  });
}

// --- Helpers ---

interface StrategyArea {
  area: string;
  label: string;
  icon: string;
  score: number | null;
  targetScore: number | null;
  identity: string | null;
  isFocus: boolean;
  yearGoals: { id: number; title: string; description: string | null; period: string; status: string }[];
  quarterGoals: { id: number; title: string; description: string | null; period: string; status: string }[];
  habits: { id: number; name: string; icon: string; streak: number; consistency: number }[];
}

async function getLatestRatings(userId: number): Promise<{ area: string; score: number }[]> {
  const areas = ALL_AREAS;
  const ratings: { area: string; score: number }[] = [];

  for (const area of areas) {
    const latest = await prisma.balanceRating.findFirst({
      where: { userId, area },
      orderBy: { createdAt: "desc" },
      select: { score: true },
    });
    if (latest) {
      ratings.push({ area, score: latest.score });
    }
  }

  return ratings;
}
