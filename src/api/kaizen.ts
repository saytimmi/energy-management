import { Router } from "express";
import prisma from "../db.js";

export function kaizenRoute(router: Router): void {
  router.get("/kaizen", async (_req, res) => {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Recent errors (last 24h)
      const recentErrors = await prisma.errorLog.findMany({
        where: { createdAt: { gte: oneDayAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      // Error summary by source (last week)
      const weekErrors = await prisma.errorLog.findMany({
        where: { createdAt: { gte: oneWeekAgo } },
      });
      const errorsBySource: Record<string, number> = {};
      for (const e of weekErrors) {
        errorsBySource[e.source] = (errorsBySource[e.source] || 0) + e.count;
      }

      // Performance metrics (last 24h)
      const metrics = await prisma.metric.findMany({
        where: { createdAt: { gte: oneDayAgo } },
      });
      const metricSummary: Record<string, { avg: number; max: number; count: number }> = {};
      for (const m of metrics) {
        if (!metricSummary[m.name]) {
          metricSummary[m.name] = { avg: 0, max: 0, count: 0 };
        }
        const s = metricSummary[m.name];
        s.count++;
        s.avg = (s.avg * (s.count - 1) + m.value) / s.count;
        s.max = Math.max(s.max, m.value);
      }

      // Usage stats
      const totalUsers = await prisma.user.count();
      const activeUsersToday = await prisma.message.findMany({
        where: { createdAt: { gte: oneDayAgo }, role: "user" },
        distinct: ["userId"],
        select: { userId: true },
      });
      const messagesToday = await prisma.message.count({
        where: { createdAt: { gte: oneDayAgo } },
      });
      const voiceToday = await prisma.message.count({
        where: { createdAt: { gte: oneDayAgo }, type: "voice" },
      });
      const observationsToday = await prisma.observation.count({
        where: { createdAt: { gte: oneDayAgo } },
      });

      // Sessions summary
      const sessionsToday = await prisma.session.count({
        where: { createdAt: { gte: oneDayAgo } },
      });
      const completedSessions = await prisma.session.count({
        where: { createdAt: { gte: oneWeekAgo }, status: "completed", summary: { not: null } },
      });

      // Feature usage (which handlers are being used)
      const energyLogs = await prisma.energyLog.count({
        where: { createdAt: { gte: oneWeekAgo } },
      });

      res.json({
        timestamp: now.toISOString(),
        health: {
          errors24h: recentErrors.length,
          errorsBySource,
        },
        performance: metricSummary,
        usage: {
          totalUsers,
          activeUsersToday: activeUsersToday.length,
          messagesToday,
          voiceMessagesToday: voiceToday,
          observationsToday,
          sessionsToday,
          completedSessionsThisWeek: completedSessions,
          energyLogsThisWeek: energyLogs,
        },
        recentErrors: recentErrors.map(e => ({
          source: e.source,
          message: e.message,
          count: e.count,
          context: e.context ? JSON.parse(e.context) : null,
          at: e.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate kaizen report" });
    }
  });
}
