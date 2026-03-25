import { Router, Request, Response } from "express";
import prisma from "../db.js";

interface NotificationPrefs {
  morningBrief: boolean;
  morningTime: string;
  afternoonReminder: boolean;
  eveningReminder: boolean;
  weeklyDigest: boolean;
  balanceReminder: boolean;
  balanceIntervalDays: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  morningBrief: true,
  morningTime: "08:00",
  afternoonReminder: true,
  eveningReminder: true,
  weeklyDigest: true,
  balanceReminder: true,
  balanceIntervalDays: 14,
};

export function settingsRoute(router: Router): void {
  // GET /api/settings
  router.get("/settings", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) { res.status(404).json({ error: "user_not_found" }); return; }

      const prefs = (user as any).notificationPrefs as NotificationPrefs | null;

      res.json({
        timezone: user.timezone,
        vacationUntil: (user as any).vacationUntil?.toISOString() ?? null,
        vacationReason: (user as any).vacationReason ?? null,
        notificationPrefs: { ...DEFAULT_PREFS, ...prefs },
      });
    } catch (err) {
      console.error("Settings GET error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // PUT /api/settings
  router.put("/settings", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const { timezone, notificationPrefs, vacationUntil, vacationReason } = req.body;

    try {
      const data: Record<string, unknown> = {};

      if (timezone !== undefined) data.timezone = timezone;
      if (notificationPrefs !== undefined) data.notificationPrefs = notificationPrefs;
      if (vacationUntil !== undefined) data.vacationUntil = vacationUntil ? new Date(vacationUntil) : null;
      if (vacationReason !== undefined) data.vacationReason = vacationReason;

      const user = await prisma.user.update({
        where: { id: userId },
        data,
      });

      // Sync habit pause state with vacation mode
      if (vacationUntil !== undefined) {
        if (vacationUntil) {
          // Entering vacation — pause all active habits
          const pauseDate = new Date(vacationUntil);
          await prisma.habit.updateMany({
            where: { userId, isActive: true, pausedAt: null },
            data: { pausedAt: new Date(), pausedUntil: pauseDate },
          });
        } else {
          // Ending vacation — resume all habits that were paused
          await prisma.habit.updateMany({
            where: { userId, isActive: true, pausedAt: { not: null } },
            data: { pausedAt: null, pausedUntil: null },
          });
        }
      }

      const prefs = (user as any).notificationPrefs as NotificationPrefs | null;

      res.json({
        timezone: user.timezone,
        vacationUntil: (user as any).vacationUntil?.toISOString() ?? null,
        vacationReason: (user as any).vacationReason ?? null,
        notificationPrefs: { ...DEFAULT_PREFS, ...prefs },
      });
    } catch (err) {
      console.error("Settings PUT error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
