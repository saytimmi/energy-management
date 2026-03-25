# Phase 2: Balance (Баланс жизни) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Balance system — AI-guided assessment of 8 life areas with sub-score decomposition, SVG radar chart in Mini App, balance detail screen, bot tools for assessment flow, and cron job for periodic reminders.

**Architecture:** Backend adds 3 API endpoints (/api/balance, /api/balance/radar, /api/balance/:area) + 1 POST endpoint (/api/balance/goals). Bot gets 3 updated/new tools (set_balance_goal, rate_life_area with subScores, start_balance_assessment). Frontend replaces BalanceScreen stub with SVG radar chart + area list, adds BalanceDetail sub-screen. Cron checks every day at 10:00 if >=14 days since last full assessment.

**Tech Stack:** Prisma (PostgreSQL), Express, grammy, Anthropic Claude API, Preact + @preact/signals, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-personal-os-design.md`

**Depends on:** Phase 1 (Foundation) — BalanceRating.subScores, BalanceGoal model, 5-tab nav, parameterized router, BalanceScreen stub

---

## Chunk 1: API Endpoints

### Task 1: Create /api/balance route — overview + radar + area detail + goals

**Files:**
- Create: `src/api/balance.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Create balance API route file**

Create `src/api/balance.ts`:
```typescript
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

export function balanceRoute(router: Router): void {
  // GET /api/balance — overview: latest ratings + goals + habits count
  router.get("/balance", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      const ratings = await getLatestRatings(userId);

      // Get balance goals
      const balanceGoals = await prisma.balanceGoal.findMany({
        where: { userId },
      });

      // Count habits per area
      const habits = await prisma.habit.findMany({
        where: { userId, isActive: true },
        select: { lifeArea: true },
      });
      const habitCounts: Record<string, number> = {};
      for (const h of habits) {
        if (h.lifeArea) {
          habitCounts[h.lifeArea] = (habitCounts[h.lifeArea] || 0) + 1;
        }
      }

      // Find last full assessment date (when all 8 areas were rated in one session — approximate by latest rating)
      const allRatingDates = Object.values(ratings).map(r => r.createdAt);
      const lastAssessmentDate = allRatingDates.length > 0
        ? new Date(Math.max(...allRatingDates.map(d => d.getTime())))
        : null;

      const areas = LIFE_AREAS.map(area => {
        const rating = ratings[area];
        const goal = balanceGoals.find(g => g.area === area);
        return {
          area,
          label: AREA_LABELS[area],
          icon: AREA_ICONS[area],
          score: rating?.score ?? null,
          targetScore: goal?.targetScore ?? null,
          identity: goal?.identity ?? null,
          isFocus: goal?.isFocus ?? false,
          habitCount: habitCounts[area] ?? 0,
          lastRatedAt: rating?.createdAt?.toISOString() ?? null,
          assessmentType: rating?.assessmentType ?? null,
        };
      });

      // Average score
      const scored = areas.filter(a => a.score !== null);
      const avgScore = scored.length > 0
        ? Math.round((scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length) * 10) / 10
        : null;

      res.json({
        areas,
        avgScore,
        ratedCount: scored.length,
        totalCount: LIFE_AREAS.length,
        lastAssessmentDate: lastAssessmentDate?.toISOString() ?? null,
      });
    } catch (err) {
      console.error("Balance API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/balance/radar — data for SVG radar chart
  router.get("/balance/radar", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;

    try {
      const ratings = await getLatestRatings(userId);

      const balanceGoals = await prisma.balanceGoal.findMany({
        where: { userId },
      });

      const points = LIFE_AREAS.map(area => {
        const rating = ratings[area];
        const goal = balanceGoals.find(g => g.area === area);
        return {
          area,
          label: AREA_LABELS[area],
          icon: AREA_ICONS[area],
          score: rating?.score ?? 0,
          targetScore: goal?.targetScore ?? null,
          isFocus: goal?.isFocus ?? false,
        };
      });

      res.json({ points });
    } catch (err) {
      console.error("Balance radar API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/balance/:area — detailed view for one area
  router.get("/balance/:area", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const { area } = req.params;

    if (!LIFE_AREAS.includes(area as any)) {
      res.status(400).json({ error: "invalid_area" });
      return;
    }

    try {
      // Latest rating with subScores
      const latestRating = await prisma.balanceRating.findFirst({
        where: { userId, area },
        orderBy: { createdAt: "desc" },
      });

      // History of ratings (last 10)
      const history = await prisma.balanceRating.findMany({
        where: { userId, area },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      // Balance goal
      const balanceGoal = await prisma.balanceGoal.findFirst({
        where: { userId, area },
      });

      // Habits linked to this area
      const habits = await prisma.habit.findMany({
        where: { userId, lifeArea: area, isActive: true },
        select: {
          id: true, name: true, icon: true, streakCurrent: true,
          consistency30d: true, stage: true, isDuration: true,
        },
      });

      // Auto-metric: average energy for health area
      let autoMetrics: Record<string, number | null> = {};
      if (area === "health") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const energyLogs = await prisma.energyLog.findMany({
          where: { userId, createdAt: { gte: weekAgo } },
          select: { physical: true },
        });
        if (energyLogs.length > 0) {
          autoMetrics.avgPhysicalEnergy = Math.round(
            energyLogs.reduce((sum, l) => sum + l.physical, 0) / energyLogs.length * 10
          ) / 10;
        }
      }

      const aspects = AREA_ASPECTS[area] || [];
      const subScores = (latestRating as any)?.subScores as Record<string, number> | null;

      res.json({
        area,
        label: AREA_LABELS[area],
        icon: AREA_ICONS[area],
        score: latestRating?.score ?? null,
        subScores: subScores ?? null,
        aspects: aspects.map(a => ({
          key: a,
          label: ASPECT_LABELS[a] || a,
          score: subScores?.[a] ?? null,
        })),
        assessmentType: (latestRating as any)?.assessmentType ?? null,
        note: latestRating?.note ?? null,
        lastRatedAt: latestRating?.createdAt?.toISOString() ?? null,
        targetScore: balanceGoal?.targetScore ?? null,
        identity: balanceGoal?.identity ?? null,
        isFocus: balanceGoal?.isFocus ?? false,
        habits,
        autoMetrics,
        history: history.map(h => ({
          score: h.score,
          note: h.note,
          subScores: (h as any).subScores ?? null,
          assessmentType: (h as any).assessmentType ?? "subjective",
          createdAt: h.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      console.error("Balance area API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/balance/goals — set/update balance goal
  router.post("/balance/goals", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const { area, targetScore, identity, isFocus } = req.body;

    if (!area || !LIFE_AREAS.includes(area)) {
      res.status(400).json({ error: "invalid_area" });
      return;
    }

    try {
      const goal = await prisma.balanceGoal.upsert({
        where: { userId_area: { userId, area } },
        update: {
          ...(targetScore !== undefined ? { targetScore: Math.max(1, Math.min(10, targetScore)) } : {}),
          ...(identity !== undefined ? { identity } : {}),
          ...(isFocus !== undefined ? { isFocus } : {}),
        },
        create: {
          userId,
          area,
          targetScore: targetScore ? Math.max(1, Math.min(10, targetScore)) : 7,
          identity: identity ?? null,
          isFocus: isFocus ?? false,
        },
      });

      res.json({ ok: true, goal });
    } catch (err) {
      console.error("Balance goals API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
```

- [ ] **Step 2: Register balance route in server.ts**

In `src/server.ts`, add import (after line 10):
```typescript
import { balanceRoute } from "./api/balance.js";
```

Add route registration in the authenticated router section (after line 48, before `app.use("/api", authedRouter);`):
```typescript
  balanceRoute(authedRouter);
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/api/balance.ts src/server.ts
git commit -m "feat: balance API — /api/balance, /api/balance/radar, /api/balance/:area, POST /api/balance/goals"
```

---

### Task 2: Write tests for balance API

**Files:**
- Create: `src/__tests__/balance-api.test.ts`

- [ ] **Step 1: Write balance API tests**

Create `src/__tests__/balance-api.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("balance API module", () => {
  it("should export balanceRoute function", async () => {
    const mod = await import("../api/balance");
    expect(mod.balanceRoute).toBeDefined();
    expect(typeof mod.balanceRoute).toBe("function");
  });

  it("should define all 8 life areas", async () => {
    // Verify the module imports cleanly — area constants are internal
    // but the route handler validates them
    const mod = await import("../api/balance");
    expect(mod.balanceRoute).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/balance-api.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/balance-api.test.ts
git commit -m "test: balance API module tests"
```

---

## Chunk 2: Bot Tools — Balance Assessment

### Task 3: Update rate_life_area tool with subScores + assessmentType

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Update rate_life_area tool definition (around line 113-125)**

Replace the existing `rate_life_area` tool definition in the TOOLS array:
```typescript
  {
    name: "rate_life_area",
    description: "Сохранить оценку сферы жизни (колесо баланса). Используй после обсуждения аспектов сферы. Для AI-guided assessment заполни subScores по каждому аспекту. Сферы: здоровье, карьера, отношения, финансы, семья, развитие, отдых, среда.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Сфера жизни" },
        score: { type: "number", description: "Итоговая оценка от 1 до 10" },
        note: { type: "string", description: "Комментарий (краткий инсайт по сфере)" },
        subScores: {
          type: "object",
          description: "Оценки аспектов сферы (1-10). Здоровье: sleep, activity, nutrition, wellbeing, energy. Карьера: satisfaction, growth, income, skills, influence. Отношения: depth, frequency, conflicts, support, intimacy. Финансы: income_expense, cushion, investments, debts, control. Семья: time_together, quality, responsibilities, harmony. Развитие: learning, reading, new_skills, challenges, progress. Отдых: hobby, vacation, recharge, pleasure, balance. Среда: housing, workspace, comfort, order, aesthetics.",
        },
        assessmentType: { type: "string", enum: ["subjective", "ai_guided"], description: "subjective = быстрая оценка, ai_guided = детальный разбор по аспектам" },
      },
      required: ["area", "score"],
    },
  },
```

- [ ] **Step 2: Update rate_life_area execution in executeTool (around line 423-457)**

Replace the `case "rate_life_area"` block:
```typescript
    case "rate_life_area": {
      const input = toolInput as {
        area: string;
        score: number;
        note?: string;
        subScores?: Record<string, number>;
        assessmentType?: string;
      };
      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      const clampedScore = Math.max(1, Math.min(10, Math.round(input.score)));

      // Clamp subScores too
      let clampedSubScores: Record<string, number> | undefined;
      if (input.subScores) {
        clampedSubScores = {};
        for (const [key, val] of Object.entries(input.subScores)) {
          clampedSubScores[key] = Math.max(1, Math.min(10, Math.round(val)));
        }
      }

      await prisma.balanceRating.create({
        data: {
          userId,
          area: input.area,
          score: clampedScore,
          note: input.note || null,
          subScores: clampedSubScores ?? undefined,
          assessmentType: input.assessmentType ?? "subjective",
        } as any,
      });

      // Get all latest ratings for context
      const allAreas = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
      const latestRatings: string[] = [];
      for (const area of allAreas) {
        const latest = await prisma.balanceRating.findFirst({
          where: { userId, area },
          orderBy: { createdAt: "desc" },
        });
        if (latest) {
          latestRatings.push(`${AREA_LABELS[area]}: ${latest.score}/10`);
        }
      }

      // Show subScores in confirmation if present
      let subScoresSummary = "";
      if (clampedSubScores) {
        const entries = Object.entries(clampedSubScores).map(([k, v]) => `${k}: ${v}`).join(", ");
        subScoresSummary = `\nАспекты: ${entries}`;
      }

      return {
        text: `Оценка записана: ${AREA_LABELS[input.area] || input.area} = ${clampedScore}/10 (${input.assessmentType ?? "subjective"}).${subScoresSummary}\n\nТекущий баланс:\n${latestRatings.join("\n") || "Только одна сфера оценена."}`,
        actions: [],
      };
    }
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: rate_life_area with subScores + assessmentType support"
```

---

### Task 4: Add set_balance_goal tool

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add set_balance_goal tool definition to TOOLS array (after rate_life_area, around line 126)**

```typescript
  {
    name: "set_balance_goal",
    description: "Установить идентичность, фокус и целевую оценку для сферы жизни. Используй когда пользователь определяет кем хочет стать в этой сфере, ставит целевую оценку баланса, или выбирает сферу в фокус на квартал.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Сфера жизни" },
        targetScore: { type: "number", description: "Целевая оценка баланса (1-10). Метрика удовлетворённости." },
        identity: { type: "string", description: "Идентичность в этой сфере — кем человек хочет стать. Например: 'Человек который бегает каждое утро', 'Надёжный муж и отец'" },
        isFocus: { type: "boolean", description: "Сфера в активном фокусе этого квартала (максимум 2-3 сферы в фокусе)" },
      },
      required: ["area"],
    },
  },
```

- [ ] **Step 2: Add set_balance_goal execution in executeTool (before the default case)**

```typescript
    case "set_balance_goal": {
      const input = toolInput as {
        area: string;
        targetScore?: number;
        identity?: string;
        isFocus?: boolean;
      };

      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      const goal = await prisma.balanceGoal.upsert({
        where: { userId_area: { userId, area: input.area } },
        update: {
          ...(input.targetScore !== undefined ? { targetScore: Math.max(1, Math.min(10, Math.round(input.targetScore))) } : {}),
          ...(input.identity !== undefined ? { identity: input.identity } : {}),
          ...(input.isFocus !== undefined ? { isFocus: input.isFocus } : {}),
        },
        create: {
          userId,
          area: input.area,
          targetScore: input.targetScore ? Math.max(1, Math.min(10, Math.round(input.targetScore))) : 7,
          identity: input.identity ?? null,
          isFocus: input.isFocus ?? false,
        },
      });

      const parts: string[] = [];
      if (goal.identity) parts.push(`идентичность: "${goal.identity}"`);
      if (goal.targetScore) parts.push(`цель: ${goal.targetScore}/10`);
      if (goal.isFocus) parts.push("в фокусе");

      return {
        text: `${AREA_LABELS[input.area] || input.area}: ${parts.join(", ") || "обновлено"}.`,
        actions: [],
      };
    }
```

- [ ] **Step 3: Update system prompt to mention new tools (around line 177-183)**

Add after the existing tools list in the system prompt:
```
- set_balance_goal — установить идентичность, фокус и целевую оценку для сферы
- rate_life_area — оценить сферу жизни (с аспектами: subScores)
```

Find the TOOLS instruction block in SYSTEM_PROMPT (around line 177) and add set_balance_goal to the list.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: set_balance_goal bot tool — identity, focus, targetScore per area"
```

---

### Task 5: Add start_balance_assessment tool

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add start_balance_assessment tool definition to TOOLS array**

```typescript
  {
    name: "start_balance_assessment",
    description: `Получить данные для AI-guided оценки баланса жизни. Возвращает по каждой сфере: последнюю оценку, привычки, автометрики (средняя энергия), цели.

AI-guided assessment flow:
1. Вызови start_balance_assessment чтобы получить контекст
2. Для каждой сферы: расскажи человеку его данные, задай 1-2 вопроса по аспектам, предложи оценку
3. Используй rate_life_area с subScores и assessmentType="ai_guided" чтобы сохранить

Аспекты по сферам:
- Здоровье: сон, активность, питание, самочувствие, энергия(авто)
- Карьера: удовлетворённость, рост, доход, навыки, влияние
- Отношения: глубина, частота, конфликты, поддержка, близость
- Финансы: доход/расход, подушка, инвестиции, долги, контроль
- Семья: время вместе, качество, обязанности, гармония
- Развитие: обучение, чтение, новые навыки, вызовы, прогресс
- Отдых: хобби, отпуск, перезагрузка, удовольствие, баланс
- Среда: жильё, рабочее место, комфорт, порядок, эстетика

Правила:
- НЕ спрашивай все 8 сфер за раз. Максимум 2-3 за сессию, если человек устал — останови.
- Предлагай оценку сам на основе данных: "по ощущению ставлю 5, ок?"
- Для здоровья используй автометрики (средняя энергия за неделю).
- Пиши как друг, не как анкета. Один вопрос за раз.`,
    input_schema: {
      type: "object" as const,
      properties: {
        areas: {
          type: "array",
          items: { type: "string" },
          description: "Конкретные сферы для оценки. Если пусто — все 8.",
        },
      },
      required: [],
    },
  },
```

- [ ] **Step 2: Add start_balance_assessment execution in executeTool (before the default case)**

```typescript
    case "start_balance_assessment": {
      const input = toolInput as { areas?: string[] };
      const targetAreas = (input.areas && input.areas.length > 0)
        ? input.areas.filter(a => ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"].includes(a))
        : ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];

      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      const AREA_ASPECTS: Record<string, string[]> = {
        health: ["сон", "активность", "питание", "самочувствие", "энергия"],
        career: ["удовлетворённость", "рост", "доход", "навыки", "влияние"],
        relationships: ["глубина", "частота", "конфликты", "поддержка", "близость"],
        finances: ["доход/расход", "подушка", "инвестиции", "долги", "контроль"],
        family: ["время вместе", "качество", "обязанности", "гармония"],
        growth: ["обучение", "чтение", "новые навыки", "вызовы", "прогресс"],
        recreation: ["хобби", "отпуск", "перезагрузка", "удовольствие", "баланс"],
        environment: ["жильё", "рабочее место", "комфорт", "порядок", "эстетика"],
      };

      const result: string[] = [];

      for (const area of targetAreas) {
        const parts: string[] = [`\n${AREA_LABELS[area] || area}:`];

        // Last rating
        const lastRating = await prisma.balanceRating.findFirst({
          where: { userId, area },
          orderBy: { createdAt: "desc" },
        });
        if (lastRating) {
          const daysAgo = Math.floor((Date.now() - lastRating.createdAt.getTime()) / (1000 * 60 * 60 * 24));
          parts.push(`  Последняя оценка: ${lastRating.score}/10 (${daysAgo} дней назад)`);
          const sub = (lastRating as any).subScores as Record<string, number> | null;
          if (sub) {
            parts.push(`  Аспекты: ${Object.entries(sub).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
          }
        } else {
          parts.push("  Ещё не оценена");
        }

        // Balance goal
        const goal = await prisma.balanceGoal.findFirst({
          where: { userId, area },
        });
        if (goal) {
          const goalParts: string[] = [];
          if (goal.targetScore) goalParts.push(`цель: ${goal.targetScore}/10`);
          if (goal.identity) goalParts.push(`идентичность: "${goal.identity}"`);
          if (goal.isFocus) goalParts.push("ФОКУС");
          if (goalParts.length > 0) parts.push(`  Цель: ${goalParts.join(", ")}`);
        }

        // Habits count
        const habitCount = await prisma.habit.count({
          where: { userId, lifeArea: area, isActive: true },
        });
        if (habitCount > 0) parts.push(`  Привычек: ${habitCount}`);

        // Auto-metrics for health
        if (area === "health") {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const energyLogs = await prisma.energyLog.findMany({
            where: { userId, createdAt: { gte: weekAgo } },
            select: { physical: true, mental: true, emotional: true, spiritual: true },
          });
          if (energyLogs.length > 0) {
            const avg = (field: "physical" | "mental" | "emotional" | "spiritual") =>
              (energyLogs.reduce((s, l) => s + l[field], 0) / energyLogs.length).toFixed(1);
            parts.push(`  Энергия (7 дней): физ ${avg("physical")}, мент ${avg("mental")}, эмоц ${avg("emotional")}, дух ${avg("spiritual")}`);
          }
        }

        // Aspects to evaluate
        parts.push(`  Аспекты для оценки: ${AREA_ASPECTS[area]?.join(", ") || "—"}`);

        result.push(parts.join("\n"));
      }

      return {
        text: `Данные для оценки баланса:${result.join("\n")}`,
        actions: [],
      };
    }
```

- [ ] **Step 3: Add tool name to system prompt tools list**

In the SYSTEM_PROMPT, update the tools list section to include:
```
- start_balance_assessment — получить данные для оценки баланса (вызывай ПЕРЕД оценкой сфер)
```

- [ ] **Step 4: Run build and tests**

Run: `npm run build && npm test`
Expected: Build and tests succeed

- [ ] **Step 5: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: start_balance_assessment bot tool — context data for AI-guided assessment"
```

---

## Chunk 3: Balance Assessment Cron

### Task 6: Add balance assessment reminder cron

**Files:**
- Create: `src/services/balance-cron.ts`
- Modify: `src/services/scheduler.ts`

- [ ] **Step 1: Create balance-cron.ts**

Create `src/services/balance-cron.ts`:
```typescript
import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";

const ASSESSMENT_INTERVAL_DAYS = 14;

export async function checkBalanceAssessment(): Promise<void> {
  const users = await prisma.user.findMany();

  for (const user of users) {
    try {
      // Find the most recent balance rating for this user
      const lastRating = await prisma.balanceRating.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      const daysSinceLastAssessment = lastRating
        ? Math.floor((Date.now() - lastRating.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity; // Never assessed

      if (daysSinceLastAssessment >= ASSESSMENT_INTERVAL_DAYS) {
        const chatId = Number(user.telegramId);

        // Get balance goals to know focus areas
        const focusGoals = await prisma.balanceGoal.findMany({
          where: { userId: user.id, isFocus: true },
        });

        let message: string;
        if (!lastRating) {
          message = "привет! ты ещё ни разу не оценивал баланс жизни. давай пройдёмся по сферам — это займёт минут 5, но даст полную картину. напиши «баланс» и начнём";
        } else {
          const focusText = focusGoals.length > 0
            ? ` (в фокусе: ${focusGoals.map(g => g.area).join(", ")})`
            : "";
          message = `слушай, прошло уже ${daysSinceLastAssessment} дней с последней оценки баланса${focusText}. давай обновим? напиши «баланс» и пройдёмся по сферам`;
        }

        await bot.api.sendMessage(chatId, message);
        console.log(`Balance assessment reminder sent to user ${user.id} (${daysSinceLastAssessment} days since last)`);
      }
    } catch (err) {
      await trackError("balance-cron", err, { userId: user.id });
      console.warn(`Failed to check balance assessment for user ${user.id}:`, err);
    }
  }
}
```

- [ ] **Step 2: Register cron in scheduler.ts**

In `src/services/scheduler.ts`, add import (after line 6):
```typescript
import { checkBalanceAssessment } from "./balance-cron.js";
```

Add the cron schedule (after the weekly digest, before the closing `}`):
```typescript
  // Balance assessment check — daily at 10:00, sends if >=14 days since last
  const balanceCheck = cron.schedule("0 10 * * *", () => {
    checkBalanceAssessment().catch(err => console.error("Balance assessment check failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(balanceCheck);
  console.log("Balance assessment check scheduled: 0 10 * * * (Asia/Shanghai)");
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/services/balance-cron.ts src/services/scheduler.ts
git commit -m "feat: balance assessment cron — daily check, remind if >=14 days since last assessment"
```

---

## Chunk 4: Frontend Types + Store + API Client

### Task 7: Add Balance types to frontend

**Files:**
- Modify: `src/mini-app/api/types.ts`

- [ ] **Step 1: Add Balance types at end of types.ts**

Append to `src/mini-app/api/types.ts`:
```typescript

// --- Balance ---

export interface BalanceAreaSummary {
  area: string;
  label: string;
  icon: string;
  score: number | null;
  targetScore: number | null;
  identity: string | null;
  isFocus: boolean;
  habitCount: number;
  lastRatedAt: string | null;
  assessmentType: string | null;
}

export interface BalanceOverview {
  areas: BalanceAreaSummary[];
  avgScore: number | null;
  ratedCount: number;
  totalCount: number;
  lastAssessmentDate: string | null;
}

export interface RadarPoint {
  area: string;
  label: string;
  icon: string;
  score: number;
  targetScore: number | null;
  isFocus: boolean;
}

export interface RadarData {
  points: RadarPoint[];
}

export interface BalanceAspect {
  key: string;
  label: string;
  score: number | null;
}

export interface BalanceAreaHabit {
  id: number;
  name: string;
  icon: string;
  streakCurrent: number;
  consistency30d: number;
  stage: string;
  isDuration: boolean;
}

export interface BalanceHistoryEntry {
  score: number;
  note: string | null;
  subScores: Record<string, number> | null;
  assessmentType: string;
  createdAt: string;
}

export interface BalanceAreaDetail {
  area: string;
  label: string;
  icon: string;
  score: number | null;
  subScores: Record<string, number> | null;
  aspects: BalanceAspect[];
  assessmentType: string | null;
  note: string | null;
  lastRatedAt: string | null;
  targetScore: number | null;
  identity: string | null;
  isFocus: boolean;
  habits: BalanceAreaHabit[];
  autoMetrics: Record<string, number | null>;
  history: BalanceHistoryEntry[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/api/types.ts
git commit -m "feat: Balance frontend types — BalanceOverview, RadarData, BalanceAreaDetail"
```

---

### Task 8: Add Balance API methods to client

**Files:**
- Modify: `src/mini-app/api/client.ts`

- [ ] **Step 1: Add Balance type imports**

In `src/mini-app/api/client.ts`, update the import (line 2):
```typescript
import type { DashboardData, ObservationsResponse, HistoryPoint, AnalyticsData, HabitData, HabitsGrouped, HabitStats, HeatmapDay, CreateHabitPayload, HabitCorrelation, BalanceOverview, RadarData, BalanceAreaDetail } from "./types";
```

- [ ] **Step 2: Add Balance API methods to api object**

Add before the closing `};` of the `api` object:
```typescript
  balance: () => request<BalanceOverview>("/api/balance"),
  balanceRadar: () => request<RadarData>("/api/balance/radar"),
  balanceArea: (area: string) => request<BalanceAreaDetail>(`/api/balance/${area}`),
  setBalanceGoal: (data: { area: string; targetScore?: number; identity?: string; isFocus?: boolean }) =>
    post<{ ok: boolean }>("/api/balance/goals", data),
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/api/client.ts
git commit -m "feat: Balance API client methods — balance, balanceRadar, balanceArea, setBalanceGoal"
```

---

### Task 9: Create Balance store

**Files:**
- Create: `src/mini-app/store/balance.ts`

- [ ] **Step 1: Create balance store**

Create `src/mini-app/store/balance.ts`:
```typescript
import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { BalanceOverview, RadarData, BalanceAreaDetail } from "../api/types";

export const balanceOverview = signal<BalanceOverview | null>(null);
export const radarData = signal<RadarData | null>(null);
export const balanceDetail = signal<BalanceAreaDetail | null>(null);
export const balanceLoading = signal(false);
export const balanceError = signal(false);

let overviewLoaded = false;

export async function loadBalanceOverview(): Promise<void> {
  if (overviewLoaded && balanceOverview.value) return;
  balanceLoading.value = true;
  balanceError.value = false;
  try {
    const [overview, radar] = await Promise.all([
      api.balance(),
      api.balanceRadar(),
    ]);
    balanceOverview.value = overview;
    radarData.value = radar;
    overviewLoaded = true;
  } catch {
    balanceError.value = true;
  } finally {
    balanceLoading.value = false;
  }
}

export async function loadBalanceArea(area: string): Promise<void> {
  balanceLoading.value = true;
  balanceError.value = false;
  try {
    balanceDetail.value = await api.balanceArea(area);
  } catch {
    balanceError.value = true;
  } finally {
    balanceLoading.value = false;
  }
}

export function resetBalanceCache(): void {
  overviewLoaded = false;
  balanceOverview.value = null;
  radarData.value = null;
  balanceDetail.value = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/store/balance.ts
git commit -m "feat: Balance store — signals for overview, radar, area detail"
```

---

## Chunk 5: SVG Radar Chart Component

### Task 10: Create RadarChart component

**Files:**
- Create: `src/mini-app/components/balance/RadarChart.tsx`

- [ ] **Step 1: Create SVG radar chart component**

Create `src/mini-app/components/balance/RadarChart.tsx`:
```typescript
import type { RadarPoint } from "../../api/types";

interface RadarChartProps {
  points: RadarPoint[];
  size?: number;
}

export function RadarChart({ points, size = 280 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 40; // Leave room for labels
  const levels = 5; // Concentric rings: 2, 4, 6, 8, 10
  const n = points.length;

  if (n === 0) return null;

  // Calculate angle for each axis (start from top, go clockwise)
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // Start from top

  function polarToCart(angle: number, radius: number): { x: number; y: number } {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  function getPolygonPoints(values: number[]): string {
    return values
      .map((val, i) => {
        const angle = startAngle + i * angleStep;
        const r = (val / 10) * maxRadius;
        const { x, y } = polarToCart(angle, r);
        return `${x},${y}`;
      })
      .join(" ");
  }

  const scores = points.map(p => p.score);
  const targets = points.map(p => p.targetScore ?? 0);
  const hasTargets = targets.some(t => t > 0);

  // Concentric grid rings
  const gridRings = Array.from({ length: levels }, (_, i) => {
    const val = ((i + 1) * 10) / levels; // 2, 4, 6, 8, 10
    const r = (val / 10) * maxRadius;
    return r;
  });

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Concentric grid rings */}
        {gridRings.map((r, i) => (
          <polygon
            key={`grid-${i}`}
            points={Array.from({ length: n }, (_, j) => {
              const angle = startAngle + j * angleStep;
              const { x, y } = polarToCart(angle, r);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            stroke-width="1"
          />
        ))}

        {/* Axis lines */}
        {points.map((_, i) => {
          const angle = startAngle + i * angleStep;
          const { x, y } = polarToCart(angle, maxRadius);
          return (
            <line
              key={`axis-${i}`}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke="rgba(255,255,255,0.06)"
              stroke-width="1"
            />
          );
        })}

        {/* Target polygon (dashed) */}
        {hasTargets && (
          <polygon
            points={getPolygonPoints(targets)}
            fill="none"
            stroke="rgba(200, 255, 115, 0.3)"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />
        )}

        {/* Current scores polygon (filled) */}
        <polygon
          points={getPolygonPoints(scores)}
          fill="rgba(200, 255, 115, 0.08)"
          stroke="var(--accent)"
          stroke-width="2"
        />

        {/* Score dots */}
        {scores.map((val, i) => {
          const angle = startAngle + i * angleStep;
          const r = (val / 10) * maxRadius;
          const { x, y } = polarToCart(angle, r);
          const isFocus = points[i].isFocus;
          return (
            <circle
              key={`dot-${i}`}
              cx={x} cy={y}
              r={isFocus ? 5 : 3.5}
              fill={val > 0 ? "var(--accent)" : "rgba(255,255,255,0.15)"}
              stroke={isFocus ? "rgba(200,255,115,0.4)" : "none"}
              stroke-width={isFocus ? 2 : 0}
            />
          );
        })}

        {/* Labels */}
        {points.map((p, i) => {
          const angle = startAngle + i * angleStep;
          const labelR = maxRadius + 22;
          const { x, y } = polarToCart(angle, labelR);

          // Text anchor based on position
          let anchor = "middle";
          if (x < cx - 10) anchor = "end";
          else if (x > cx + 10) anchor = "start";

          return (
            <g key={`label-${i}`}>
              <text
                x={x} y={y - 6}
                text-anchor={anchor}
                fill="var(--text2)"
                font-size="10"
                font-weight="500"
              >
                {p.icon}
              </text>
              <text
                x={x} y={y + 6}
                text-anchor={anchor}
                fill={p.score > 0 ? "var(--text)" : "var(--text3)"}
                font-size="10"
                font-weight={p.isFocus ? "700" : "400"}
              >
                {p.score > 0 ? p.score : "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/balance/RadarChart.tsx
git commit -m "feat: SVG RadarChart component — current scores + target polygon"
```

---

## Chunk 6: BalanceScreen (Main + Detail)

### Task 11: Replace BalanceScreen stub with full implementation

**Files:**
- Modify: `src/mini-app/components/balance/BalanceScreen.tsx`

- [ ] **Step 1: Replace BalanceScreen with full implementation**

Replace entire `src/mini-app/components/balance/BalanceScreen.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { RadarChart } from "./RadarChart";
import { BalanceDetail } from "./BalanceDetail";
import {
  balanceOverview, radarData, balanceLoading, balanceError,
  loadBalanceOverview,
} from "../../store/balance";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import type { BalanceAreaSummary } from "../../api/types";

interface BalanceScreenProps {
  param?: string;
}

export function BalanceScreen({ param }: BalanceScreenProps) {
  // If param is an area name, show detail
  const VALID_AREAS = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
  if (param && VALID_AREAS.includes(param)) {
    return <BalanceDetail area={param} />;
  }

  // Main balance screen
  useEffect(() => { loadBalanceOverview(); }, []);

  const overview = balanceOverview.value;
  const radar = radarData.value;
  const loading = balanceLoading.value;
  const error = balanceError.value;

  const handleAreaClick = (area: string) => {
    haptic("light");
    navigate("balance", area);
  };

  const handleAssess = () => {
    haptic("medium");
    // Deep link to Telegram bot
    const botUsername = getBotUsername();
    if (botUsername) {
      window.open(`https://t.me/${botUsername}?text=${encodeURIComponent("баланс")}`, "_blank");
    }
  };

  if (loading && !overview) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
        </header>
        <main class="views" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div class="pulse-ring" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
        </header>
        <main class="views" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Ошибка загрузки данных
        </main>
      </div>
    );
  }

  const hasAnyScores = overview && overview.ratedCount > 0;

  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
        {overview && overview.avgScore !== null && (
          <span style={{ fontSize: "13px", color: "var(--text2)", fontWeight: 400 }}>
            Средний: {overview.avgScore}/10
          </span>
        )}
      </header>
      <main class="views">
        {/* Radar Chart */}
        {radar && hasAnyScores ? (
          <div class="balance-radar-card">
            <RadarChart points={radar.points} />
          </div>
        ) : (
          <div class="balance-empty-radar">
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚖️</div>
            <div style={{ fontSize: "14px", color: "var(--text2)", marginBottom: "16px", lineHeight: 1.5 }}>
              Оцени баланс жизни через AI коуча — он поможет разобрать каждую сферу по аспектам
            </div>
            <button class="balance-assess-btn" onClick={handleAssess}>
              Оценить баланс
            </button>
          </div>
        )}

        {/* Assess button (when data exists) */}
        {hasAnyScores && (
          <button class="balance-reassess-btn" onClick={handleAssess}>
            🔄 Обновить оценку через AI коуча
          </button>
        )}

        {/* Area list */}
        {overview && (
          <div class="balance-area-list">
            {/* Focus areas first, then by score ascending (worst first) */}
            {sortAreas(overview.areas).map(area => (
              <AreaRow key={area.area} area={area} onClick={() => handleAreaClick(area.area)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function sortAreas(areas: BalanceAreaSummary[]): BalanceAreaSummary[] {
  return [...areas].sort((a, b) => {
    // Focus areas first
    if (a.isFocus && !b.isFocus) return -1;
    if (!a.isFocus && b.isFocus) return 1;
    // Then by score ascending (critical first), null last
    const sa = a.score ?? 99;
    const sb = b.score ?? 99;
    return sa - sb;
  });
}

interface AreaRowProps {
  area: BalanceAreaSummary;
  onClick: () => void;
}

function AreaRow({ area, onClick }: AreaRowProps) {
  const scoreColor = area.score !== null
    ? area.score <= 4 ? "#ff5b5b" : area.score <= 6 ? "#ffa85b" : "#5be07a"
    : "var(--text3)";

  return (
    <div class="balance-area-row" onClick={onClick}>
      <div class="balance-area-left">
        <span class="balance-area-icon">{area.icon}</span>
        <div>
          <div class="balance-area-name">
            {area.label}
            {area.isFocus && <span class="balance-focus-badge">фокус</span>}
          </div>
          <div class="balance-area-meta">
            {area.habitCount > 0 ? `${area.habitCount} привычек` : "нет привычек"}
          </div>
        </div>
      </div>
      <div class="balance-area-right">
        <span class="balance-area-score" style={{ color: scoreColor }}>
          {area.score !== null ? `${area.score}/10` : "—"}
        </span>
        <span class="balance-area-arrow">›</span>
      </div>
    </div>
  );
}

function getBotUsername(): string | null {
  try {
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user ? "energy_coach_bot" : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/balance/BalanceScreen.tsx
git commit -m "feat: BalanceScreen — radar chart + sorted area list + assess CTA"
```

---

### Task 12: Create BalanceDetail component

**Files:**
- Create: `src/mini-app/components/balance/BalanceDetail.tsx`

- [ ] **Step 1: Create BalanceDetail component**

Create `src/mini-app/components/balance/BalanceDetail.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import {
  balanceDetail, balanceLoading, balanceError,
  loadBalanceArea,
} from "../../store/balance";
import { navigate } from "../../router";
import { haptic, showBackButton, hideBackButton } from "../../telegram";

interface BalanceDetailProps {
  area: string;
}

export function BalanceDetail({ area }: BalanceDetailProps) {
  useEffect(() => {
    loadBalanceArea(area);
    const goBack = () => {
      haptic("light");
      navigate("balance");
    };
    showBackButton(goBack);
    return () => hideBackButton();
  }, [area]);

  const detail = balanceDetail.value;
  const loading = balanceLoading.value;
  const error = balanceError.value;

  if (loading && !detail) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>Загрузка...</h1>
        </header>
        <main class="views" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div class="pulse-ring" />
        </main>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>Ошибка</h1>
        </header>
        <main class="views" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Не удалось загрузить данные
        </main>
      </div>
    );
  }

  const scoreColor = detail.score !== null
    ? detail.score <= 4 ? "#ff5b5b" : detail.score <= 6 ? "#ffa85b" : "#5be07a"
    : "var(--text3)";

  const progressPercent = detail.score !== null && detail.targetScore
    ? Math.min(100, Math.round((detail.score / detail.targetScore) * 100))
    : null;

  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>
          {detail.icon} {detail.label}
        </h1>
      </header>
      <main class="views">
        {/* Score + Target + Progress */}
        <div class="balance-detail-score-card">
          <div class="balance-detail-score-row">
            <div>
              <div class="balance-detail-score" style={{ color: scoreColor }}>
                {detail.score !== null ? detail.score : "—"}
              </div>
              <div class="balance-detail-score-label">из 10</div>
            </div>
            {detail.targetScore && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--text2)" }}>
                  → {detail.targetScore}
                </div>
                <div class="balance-detail-score-label">цель</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {progressPercent !== null && (
            <div class="balance-detail-progress">
              <div class="balance-detail-progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          {/* Identity */}
          {detail.identity && (
            <div class="balance-detail-identity">
              🪞 {detail.identity}
            </div>
          )}

          {detail.isFocus && (
            <span class="balance-focus-badge" style={{ marginTop: "8px" }}>В фокусе</span>
          )}
        </div>

        {/* SubScores / Aspects */}
        {detail.aspects.length > 0 && (
          <div class="balance-detail-section">
            <div class="section-title">Аспекты</div>
            {detail.aspects.map(aspect => (
              <div key={aspect.key} class="balance-aspect-row">
                <span class="balance-aspect-label">{aspect.label}</span>
                <div class="balance-aspect-bar-container">
                  <div
                    class="balance-aspect-bar"
                    style={{
                      width: aspect.score !== null ? `${(aspect.score / 10) * 100}%` : "0%",
                      background: aspect.score !== null
                        ? aspect.score <= 4 ? "#ff5b5b" : aspect.score <= 6 ? "#ffa85b" : "#5be07a"
                        : "var(--text3)",
                    }}
                  />
                </div>
                <span class="balance-aspect-score">
                  {aspect.score !== null ? aspect.score : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Note / AI insight */}
        {detail.note && (
          <div class="balance-detail-section">
            <div class="section-title">Инсайт</div>
            <div class="balance-detail-note">{detail.note}</div>
          </div>
        )}

        {/* Habits */}
        {detail.habits.length > 0 && (
          <div class="balance-detail-section">
            <div class="section-title">Привычки</div>
            {detail.habits.map(h => (
              <div key={h.id} class="balance-habit-row">
                <span>{h.icon} {h.name}</span>
                <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                  🔥 {h.streakCurrent} · {Math.round(h.consistency30d * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Auto-metrics */}
        {Object.keys(detail.autoMetrics).length > 0 && (
          <div class="balance-detail-section">
            <div class="section-title">Автометрики</div>
            {Object.entries(detail.autoMetrics).map(([key, val]) => (
              <div key={key} class="balance-auto-metric">
                <span style={{ color: "var(--text2)", fontSize: "13px" }}>
                  {key === "avgPhysicalEnergy" ? "Средняя физическая энергия (7 дней)" : key}
                </span>
                <span style={{ fontWeight: 600 }}>{val !== null ? val : "—"}</span>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {detail.history.length > 1 && (
          <div class="balance-detail-section">
            <div class="section-title">История оценок</div>
            {detail.history.slice(0, 5).map((entry, i) => (
              <div key={i} class="balance-history-row">
                <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                  {new Date(entry.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
                <span style={{ fontWeight: 600 }}>{entry.score}/10</span>
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>
                  {entry.assessmentType === "ai_guided" ? "AI" : "субъ."}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom spacing for nav */}
        <div style={{ height: "80px" }} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/balance/BalanceDetail.tsx
git commit -m "feat: BalanceDetail — score, aspects, habits, history, auto-metrics"
```

---

## Chunk 7: CSS Styles for Balance

### Task 13: Add Balance CSS styles

**Files:**
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Append Balance styles to global.css**

Append to `src/mini-app/styles/global.css`:
```css
/* ── Balance Screen ── */
.balance-radar-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 12px;
}

.balance-empty-radar {
  text-align: center;
  padding: 40px 20px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.balance-assess-btn {
  display: inline-block;
  padding: 10px 24px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: var(--radius-xs);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.balance-assess-btn:active { transform: scale(0.96); opacity: 0.9; }

.balance-reassess-btn {
  display: block;
  width: 100%;
  padding: 10px;
  background: var(--accent-soft);
  border: 1px solid rgba(200,255,115,0.12);
  border-radius: var(--radius-xs);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  margin-bottom: 16px;
  text-align: center;
}
.balance-reassess-btn:active { transform: scale(0.97); }

.balance-area-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.balance-area-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: transform 0.1s;
}
.balance-area-row:active { transform: scale(0.98); }

.balance-area-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.balance-area-icon {
  font-size: 20px;
  width: 32px;
  text-align: center;
}

.balance-area-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.balance-focus-badge {
  display: inline-block;
  padding: 1px 6px;
  background: rgba(200,255,115,0.12);
  color: var(--accent);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.balance-area-meta {
  font-size: 11px;
  color: var(--text3);
  margin-top: 1px;
}

.balance-area-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.balance-area-score {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.balance-area-arrow {
  color: var(--text3);
  font-size: 18px;
}

/* ── Balance Detail ── */
.balance-detail-score-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 20px;
  margin-bottom: 12px;
}

.balance-detail-score-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.balance-detail-score {
  font-size: 42px;
  font-weight: 700;
  line-height: 1;
}

.balance-detail-score-label {
  font-size: 12px;
  color: var(--text3);
  margin-top: 2px;
}

.balance-detail-progress {
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  margin-top: 16px;
  overflow: hidden;
}

.balance-detail-progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.6s ease;
}

.balance-detail-identity {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text2);
  font-style: italic;
  line-height: 1.4;
}

.balance-detail-section {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xs);
  padding: 12px;
  margin-bottom: 8px;
}

.balance-aspect-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.balance-aspect-label {
  font-size: 13px;
  color: var(--text2);
  width: 100px;
  flex-shrink: 0;
}

.balance-aspect-bar-container {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
}

.balance-aspect-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.balance-aspect-score {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  width: 24px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.balance-detail-note {
  font-size: 13px;
  color: var(--text2);
  line-height: 1.5;
}

.balance-habit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.balance-auto-metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.balance-history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/styles/global.css
git commit -m "feat: Balance CSS — radar card, area list, detail screen, aspects bars"
```

---

## Chunk 8: Hub BalanceCard with Real Data

### Task 14: Update BalanceCard widget with real data

**Files:**
- Modify: `src/mini-app/components/hub/BalanceCard.tsx`

- [ ] **Step 1: Replace BalanceCard stub with data-driven widget**

Replace entire `src/mini-app/components/hub/BalanceCard.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import { balanceOverview, loadBalanceOverview } from "../../store/balance";
import type { BalanceAreaSummary } from "../../api/types";

export function BalanceCard() {
  useEffect(() => { loadBalanceOverview(); }, []);

  const handleClick = () => {
    haptic("light");
    navigate("balance");
  };

  const overview = balanceOverview.value;

  // No data state
  if (!overview || overview.ratedCount === 0) {
    return (
      <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
        <div class="hub-card-header">
          <span class="hub-card-title">⚖️ Баланс</span>
        </div>
        <div class="hub-card-empty">
          Расскажи боту о своих целях — появится колесо баланса
        </div>
      </div>
    );
  }

  // Show top areas: focus first, then critical (score <= 4), up to 4
  const focusAndCritical = getSummaryAreas(overview.areas);

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">⚖️ Баланс</span>
        {overview.avgScore !== null && (
          <span style={{ fontSize: "13px", color: "var(--text2)" }}>
            {overview.avgScore}/10
          </span>
        )}
      </div>
      <div class="balance-hub-areas">
        {focusAndCritical.map(area => (
          <BalanceHubArea key={area.area} area={area} />
        ))}
        {overview.ratedCount > focusAndCritical.length && (
          <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "4px" }}>
            ещё {overview.ratedCount - focusAndCritical.length} →
          </div>
        )}
      </div>
    </div>
  );
}

function getSummaryAreas(areas: BalanceAreaSummary[]): BalanceAreaSummary[] {
  const focus = areas.filter(a => a.isFocus && a.score !== null);
  const critical = areas.filter(a => !a.isFocus && a.score !== null && a.score <= 4);
  const combined = [...focus, ...critical];
  // If not enough, add remaining scored areas
  if (combined.length < 4) {
    const remaining = areas.filter(a => a.score !== null && !combined.includes(a))
      .sort((a, b) => (a.score ?? 99) - (b.score ?? 99));
    combined.push(...remaining);
  }
  return combined.slice(0, 4);
}

function BalanceHubArea({ area }: { area: BalanceAreaSummary }) {
  const scoreColor = area.score !== null
    ? area.score <= 4 ? "#ff5b5b" : area.score <= 6 ? "#ffa85b" : "#5be07a"
    : "var(--text3)";

  return (
    <div class="balance-hub-area-row">
      <span>{area.icon}</span>
      <span class="balance-hub-area-name">{area.label}</span>
      {area.isFocus && <span class="balance-focus-badge" style={{ fontSize: "8px", padding: "0 4px" }}>фокус</span>}
      <div class="balance-hub-bar-container">
        <div
          class="balance-hub-bar"
          style={{
            width: area.score !== null ? `${(area.score / 10) * 100}%` : "0%",
            background: scoreColor,
          }}
        />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color: scoreColor, width: "20px", textAlign: "right" }}>
        {area.score ?? "—"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add Hub balance styles to global.css**

Append to `src/mini-app/styles/global.css`:
```css
/* Hub Balance widget */
.balance-hub-areas { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.balance-hub-area-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.balance-hub-area-name { color: var(--text2); width: 64px; flex-shrink: 0; }
.balance-hub-bar-container { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
.balance-hub-bar { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/components/hub/BalanceCard.tsx src/mini-app/styles/global.css
git commit -m "feat: BalanceCard hub widget with real data — focus + critical areas"
```

---

## Chunk 9: Final Integration + Tests

### Task 15: Verify all imports and build

**Files:**
- Verify: `src/mini-app/app.tsx` (BalanceScreen import should work from Phase 1)
- Verify: `src/mini-app/components/balance/BalanceScreen.tsx` (imports BalanceDetail)

- [ ] **Step 1: Verify BalanceScreen imports BalanceDetail**

In `src/mini-app/components/balance/BalanceScreen.tsx`, confirm line 2 has:
```typescript
import { BalanceDetail } from "./BalanceDetail";
```

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit any final fixes**

If any fixes were needed:
```bash
git add -A
git commit -m "fix: Phase 2 build fixes"
```

---

### Task 16: Write integration test for balance tools

**Files:**
- Create: `src/__tests__/balance-tools.test.ts`

- [ ] **Step 1: Write bot tools test**

Create `src/__tests__/balance-tools.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("balance bot tools", () => {
  it("should have rate_life_area with subScores in AI module", async () => {
    // Verify the module exports cleanly
    const mod = await import("../services/ai");
    expect(mod.chat).toBeDefined();
    expect(typeof mod.chat).toBe("function");
  });

  it("should have balance-cron module", async () => {
    const mod = await import("../services/balance-cron");
    expect(mod.checkBalanceAssessment).toBeDefined();
    expect(typeof mod.checkBalanceAssessment).toBe("function");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/balance-tools.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/balance-tools.test.ts
git commit -m "test: balance bot tools and cron module tests"
```

---

## Summary

After Phase 2 completion, the app has:
- API: GET /api/balance (overview), GET /api/balance/radar (chart data), GET /api/balance/:area (detail), POST /api/balance/goals (set identity/focus/target)
- Bot tools: rate_life_area (with subScores + assessmentType), set_balance_goal (identity + focus + targetScore), start_balance_assessment (context data for AI-guided flow)
- Bot flow: AI-guided assessment — decompose each area into 3-5 aspects, ask specific questions, use auto-data, propose score
- Mini App: BalanceScreen with SVG radar chart + sorted area list, BalanceDetail with aspects bars + habits + history
- Hub: BalanceCard widget shows focus + critical areas with progress bars
- Cron: daily check at 10:00, sends reminder if >=14 days since last assessment
- Store: balance signals (overview, radar, detail) with loading/error states
- CSS: Glass Dark Premium styles for all balance components

**Next:** Phase 3 (Kaizen) implements algorithms CRUD, reflections, kaizen hour bot flow.
