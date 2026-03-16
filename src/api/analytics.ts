import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import prisma from "../db.js";

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// Cache analytics per user for 1 hour to avoid redundant AI calls
const analyticsCache = new Map<number, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const ANALYTICS_SYSTEM_PROMPT =
  "Ты анализируешь паттерны энергии пользователя за последний месяц. Выдели 3-5 конкретных паттернов. Каждый паттерн должен ссылаться на реальные данные. Формат: нумерованный список. Не давай общих советов — только наблюдения о паттернах.";

export function analyticsRoute(router: Router): void {
  router.get("/analytics", async (req: Request, res: Response) => {
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

      // Fetch last 30 days of energy logs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const logs = await prisma.energyLog.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: "asc" },
      });

      if (logs.length < 3) {
        res.json({
          hasEnoughData: false,
          message:
            "Нужно минимум 3 записи энергии для анализа паттернов",
        });
        return;
      }

      // Calculate stats
      const stats = {
        avgPhysical: avg(logs.map((l) => l.physical)),
        avgMental: avg(logs.map((l) => l.mental)),
        avgEmotional: avg(logs.map((l) => l.emotional)),
        avgSpiritual: avg(logs.map((l) => l.spiritual)),
        totalLogs: logs.length,
        periodDays: Math.ceil(
          (Date.now() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24),
        ),
      };

      // Build data summary for AI
      const logLines = logs.map((l) => {
        const date = l.createdAt.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
          weekday: "short",
        });
        return `${date}: Физ=${l.physical}, Мент=${l.mental}, Эмоц=${l.emotional}, Дух=${l.spiritual}`;
      });

      // Day-of-week averages
      const dayMap: Record<string, { ph: number[]; me: number[]; em: number[]; sp: number[] }> = {};
      const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
      for (const log of logs) {
        const day = dayNames[log.createdAt.getDay()];
        if (!dayMap[day]) dayMap[day] = { ph: [], me: [], em: [], sp: [] };
        dayMap[day].ph.push(log.physical);
        dayMap[day].me.push(log.mental);
        dayMap[day].em.push(log.emotional);
        dayMap[day].sp.push(log.spiritual);
      }

      const dayAvgLines = Object.entries(dayMap).map(
        ([day, vals]) =>
          `${day}: Физ=${avg(vals.ph)}, Мент=${avg(vals.me)}, Эмоц=${avg(vals.em)}, Дух=${avg(vals.sp)}`,
      );

      // Min/max per type
      const minMax = {
        physical: { min: Math.min(...logs.map((l) => l.physical)), max: Math.max(...logs.map((l) => l.physical)) },
        mental: { min: Math.min(...logs.map((l) => l.mental)), max: Math.max(...logs.map((l) => l.mental)) },
        emotional: { min: Math.min(...logs.map((l) => l.emotional)), max: Math.max(...logs.map((l) => l.emotional)) },
        spiritual: { min: Math.min(...logs.map((l) => l.spiritual)), max: Math.max(...logs.map((l) => l.spiritual)) },
      };

      const dataSummary = [
        `Записи за ${stats.periodDays} дней (${stats.totalLogs} записей):`,
        ...logLines,
        "",
        "Средние значения:",
        `Физ=${stats.avgPhysical}, Мент=${stats.avgMental}, Эмоц=${stats.avgEmotional}, Дух=${stats.avgSpiritual}`,
        "",
        "Мин/Макс:",
        `Физ: ${minMax.physical.min}-${minMax.physical.max}, Мент: ${minMax.mental.min}-${minMax.mental.max}, Эмоц: ${minMax.emotional.min}-${minMax.emotional.max}, Дух: ${minMax.spiritual.min}-${minMax.spiritual.max}`,
        "",
        "Средние по дням недели:",
        ...dayAvgLines,
      ].join("\n");

      // Check cache first
      const cached = analyticsCache.get(user.id);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.data);
        return;
      }

      // Call AI for pattern analysis
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: ANALYTICS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: dataSummary }],
        });
        const block = response.content[0];
        const insights = block.type === "text" ? block.text : null;
        const result = { hasEnoughData: true, insights, stats };
        analyticsCache.set(user.id, { data: result, expiresAt: Date.now() + CACHE_TTL });
        res.json(result);
      } catch {
        // AI unavailable — return stats without insights
        res.json({
          hasEnoughData: true,
          insights: null,
          stats,
          error: "ai_unavailable",
        });
      }
    } catch (err) {
      console.error("Analytics API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}
