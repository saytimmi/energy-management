import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function dashboardRoute(router: Router): void {
  router.get("/dashboard", async (req: Request, res: Response) => {
    const telegramIdParam = req.query.telegramId as string | undefined;

    if (!telegramIdParam) {
      res.status(400).json({ error: "missing_telegram_id" });
      return;
    }

    try {
      const telegramId = BigInt(telegramIdParam);

      const user = await prisma.user.findUnique({
        where: { telegramId },
      });

      if (!user) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }

      const latestLog = await prisma.energyLog.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (!latestLog) {
        res.json({ error: "no_data" });
        return;
      }

      // Calculate streak: consecutive days with at least one EnergyLog
      const streak = await calculateStreak(user.id);

      res.json({
        physical: latestLog.physical,
        mental: latestLog.mental,
        emotional: latestLog.emotional,
        spiritual: latestLog.spiritual,
        loggedAt: latestLog.createdAt.toISOString(),
        streak,
      });
    } catch (err) {
      console.error("Dashboard API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

async function calculateStreak(userId: number): Promise<number> {
  const logs = await prisma.energyLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (logs.length === 0) return 0;

  // Get unique dates (YYYY-MM-DD) sorted descending
  const uniqueDates = [
    ...new Set(
      logs.map((l) => {
        const d = l.createdAt;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }),
    ),
  ];

  // Check if today (or yesterday) starts the streak
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  // Streak must include today or yesterday
  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diffMs = prev.getTime() - curr.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
