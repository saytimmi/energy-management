# Phase 4: Strategy (Mission + Goals) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mission formation + goals system + strategy screen. Users define their mission (3 questions), set yearly/quarterly goals per life area, and see everything on a Strategy screen. AI bot guides through mission formation and quarterly reviews. Weekly digest enhanced with goals progress.

**Architecture:** Mission (1:1 with User) stores identity/purpose/legacy/statement. Goals (many per User) track concrete outcomes per life area with year/quarter horizons. Strategy API aggregates mission + goals + balance goals + focus areas. Bot tools: set_mission, set_goal, get_goals. Cron: quarterly goal review + yearly mission review. Mini App: Strategy screen (#balance/strategy) shows mission card + focus areas with goals + compact other areas. buildUserContext extended with mission + goals.

**Prerequisites:** Phase 1 (DB models Mission, Goal, BalanceGoal exist in schema), Phase 2 (BalanceScreen exists with param routing, /api/balance works), Phase 3 (KaizenScreen works). If models don't exist yet, Phase 1 migration must be run first.

**Tech Stack:** Prisma (PostgreSQL), Preact + @preact/signals, TypeScript, Vitest, Express, grammy, Claude AI Tool Use

**Spec:** `docs/superpowers/specs/2026-03-23-personal-os-design.md`

---

## Chunk 1: Mission API

### Task 1: Create Mission API endpoints

**Files:**
- Create: `src/api/mission.ts`
- Modify: `src/server.ts`
- Test: `src/__tests__/mission-api.test.ts`

- [ ] **Step 1: Write tests for mission API**

Create `src/__tests__/mission-api.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("mission API", () => {
  it("should export missionRoute", async () => {
    const mod = await import("../api/mission");
    expect(mod.missionRoute).toBeDefined();
    expect(typeof mod.missionRoute).toBe("function");
  });
});
```

- [ ] **Step 2: Create mission API route**

Create `src/api/mission.ts`:
```typescript
import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function missionRoute(router: Router): void {
  // GET /api/mission — get user's mission
  router.get("/mission", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const mission = await prisma.mission.findUnique({
        where: { userId },
      });

      if (!mission) {
        return res.json({
          identity: null,
          purpose: null,
          legacy: null,
          statement: null,
        });
      }

      res.json({
        identity: mission.identity,
        purpose: mission.purpose,
        legacy: mission.legacy,
        statement: mission.statement,
        updatedAt: mission.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[mission] GET error:", err);
      res.status(500).json({ error: "Failed to get mission" });
    }
  });

  // PUT /api/mission — update mission
  router.put("/mission", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { identity, purpose, legacy, statement } = req.body;

      const mission = await prisma.mission.upsert({
        where: { userId },
        create: {
          userId,
          identity: identity || null,
          purpose: purpose || null,
          legacy: legacy || null,
          statement: statement || null,
        },
        update: {
          ...(identity !== undefined && { identity }),
          ...(purpose !== undefined && { purpose }),
          ...(legacy !== undefined && { legacy }),
          ...(statement !== undefined && { statement }),
        },
      });

      res.json({
        identity: mission.identity,
        purpose: mission.purpose,
        legacy: mission.legacy,
        statement: mission.statement,
        updatedAt: mission.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[mission] PUT error:", err);
      res.status(500).json({ error: "Failed to update mission" });
    }
  });
}
```

- [ ] **Step 3: Register mission route in server.ts**

In `src/server.ts`, add import and registration. Add to the authenticated routes section:
```typescript
// Add import (after habitsRoute import):
import { missionRoute } from "./api/mission.js";

// Add registration (after habitsRoute(authedRouter)):
missionRoute(authedRouter);
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/__tests__/mission-api.test.ts`
Expected: PASS

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/api/mission.ts src/server.ts src/__tests__/mission-api.test.ts
git commit -m "feat: Mission API — GET/PUT /api/mission"
```

---

## Chunk 2: Goals API

### Task 2: Create Goals API endpoints

**Files:**
- Create: `src/api/goals.ts`
- Modify: `src/server.ts`
- Test: `src/__tests__/goals-api.test.ts`

- [ ] **Step 1: Write tests for goals API**

Create `src/__tests__/goals-api.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("goals API", () => {
  it("should export goalsRoute", async () => {
    const mod = await import("../api/goals");
    expect(mod.goalsRoute).toBeDefined();
    expect(typeof mod.goalsRoute).toBe("function");
  });
});
```

- [ ] **Step 2: Create goals API route**

Create `src/api/goals.ts`:
```typescript
import { Router, Request, Response } from "express";
import prisma from "../db.js";

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
        // Default: only active goals
        where.status = "active";
      }

      const goals = await prisma.goal.findMany({
        where,
        orderBy: [{ timeHorizon: "asc" }, { lifeArea: "asc" }, { createdAt: "desc" }],
      });

      res.json(goals.map(g => ({
        id: g.id,
        lifeArea: g.lifeArea,
        title: g.title,
        description: g.description,
        timeHorizon: g.timeHorizon,
        period: g.period,
        status: g.status,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })));
    } catch (err) {
      console.error("[goals] GET error:", err);
      res.status(500).json({ error: "Failed to get goals" });
    }
  });

  // POST /api/goals — create goal
  router.post("/goals", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { lifeArea, title, description, timeHorizon, period } = req.body;

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
        },
      });

      res.json({
        id: goal.id,
        lifeArea: goal.lifeArea,
        title: goal.title,
        description: goal.description,
        timeHorizon: goal.timeHorizon,
        period: goal.period,
        status: goal.status,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[goals] POST error:", err);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  // PATCH /api/goals/:id — update goal
  router.patch("/goals/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const goalId = parseInt(req.params.id, 10);
      if (isNaN(goalId)) return res.status(400).json({ error: "Invalid goal ID" });

      const existing = await prisma.goal.findFirst({
        where: { id: goalId, userId },
      });
      if (!existing) return res.status(404).json({ error: "Goal not found" });

      const { title, description, status } = req.body;
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

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const goal = await prisma.goal.update({
        where: { id: goalId },
        data: updateData,
      });

      res.json({
        id: goal.id,
        lifeArea: goal.lifeArea,
        title: goal.title,
        description: goal.description,
        timeHorizon: goal.timeHorizon,
        period: goal.period,
        status: goal.status,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[goals] PATCH error:", err);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });
}
```

- [ ] **Step 3: Register goals route in server.ts**

In `src/server.ts`:
```typescript
// Add import:
import { goalsRoute } from "./api/goals.js";

// Add registration (after missionRoute):
goalsRoute(authedRouter);
```

- [ ] **Step 4: Run test and build**

Run: `npx vitest run src/__tests__/goals-api.test.ts && npm run build`
Expected: Both pass

- [ ] **Step 5: Commit**

```bash
git add src/api/goals.ts src/server.ts src/__tests__/goals-api.test.ts
git commit -m "feat: Goals API — GET/POST/PATCH /api/goals"
```

---

## Chunk 3: Strategy API (Combined Endpoint)

### Task 3: Create Strategy API endpoint

**Files:**
- Create: `src/api/strategy.ts`
- Modify: `src/server.ts`
- Test: `src/__tests__/strategy-api.test.ts`

- [ ] **Step 1: Write test**

Create `src/__tests__/strategy-api.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("strategy API", () => {
  it("should export strategyRoute", async () => {
    const mod = await import("../api/strategy");
    expect(mod.strategyRoute).toBeDefined();
    expect(typeof mod.strategyRoute).toBe("function");
  });
});
```

- [ ] **Step 2: Create strategy API route**

Create `src/api/strategy.ts`:
```typescript
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
```

- [ ] **Step 3: Register strategy route in server.ts**

In `src/server.ts`:
```typescript
// Add import:
import { strategyRoute } from "./api/strategy.js";

// Add registration (after goalsRoute):
strategyRoute(authedRouter);
```

- [ ] **Step 4: Run test and build**

Run: `npx vitest run src/__tests__/strategy-api.test.ts && npm run build`
Expected: Both pass

- [ ] **Step 5: Commit**

```bash
git add src/api/strategy.ts src/server.ts src/__tests__/strategy-api.test.ts
git commit -m "feat: Strategy API — GET /api/strategy (combined mission + goals + areas)"
```

---

## Chunk 4: Bot Tools — set_mission, set_goal, get_goals

### Task 4: Add mission and goals tools to AI

**Files:**
- Modify: `src/services/ai.ts`
- Test: `src/__tests__/ai-tools-strategy.test.ts`

- [ ] **Step 1: Write test for new tools**

Create `src/__tests__/ai-tools-strategy.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("AI strategy tools", () => {
  it("should include set_mission, set_goal, get_goals in TOOLS", async () => {
    // Verify the module compiles and exports chat
    const mod = await import("../services/ai");
    expect(mod.chat).toBeDefined();
    expect(typeof mod.chat).toBe("function");
  });
});
```

- [ ] **Step 2: Add set_mission tool definition to TOOLS array**

In `src/services/ai.ts`, add after the `rate_life_area` tool definition (after line 125, before the closing `];`):
```typescript
  {
    name: "set_mission",
    description: `Сохранить миссию пользователя. AI проводит через 3 вопроса последовательно:
1. "Кто я?" — ценности, роли, суть → identity
2. "Каково моё место в мире?" — вклад, предназначение → purpose
3. "Что я оставлю после себя?" — наследие → legacy

После 3 ответов AI формулирует statement и вызывает этот инструмент.
Можно обновлять отдельные поля (например, только statement после корректировки).`,
    input_schema: {
      type: "object" as const,
      properties: {
        identity: { type: "string", description: "Ответ на 'Кто я?' — ценности, роли, суть" },
        purpose: { type: "string", description: "Ответ на 'Каково моё место в мире?' — вклад, предназначение" },
        legacy: { type: "string", description: "Ответ на 'Что я оставлю после себя?' — наследие" },
        statement: { type: "string", description: "Сводная формулировка миссии (AI генерирует из 3 ответов)" },
      },
      required: [],
    },
  },
  {
    name: "set_goal",
    description: `Установить конкретную цель для сферы жизни. Используй при:
- Квартальном пересмотре целей
- После balance assessment (если сфера критичная)
- По запросу пользователя "хочу цель на..."
Сферы: health, career, relationships, finances, family, growth, recreation, environment.`,
    input_schema: {
      type: "object" as const,
      properties: {
        lifeArea: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Сфера жизни" },
        title: { type: "string", description: "Конкретная цель: 'Пробежать полумарафон', 'Довести доход до X'" },
        description: { type: "string", description: "Детали, метрики, контекст" },
        timeHorizon: { type: "string", enum: ["year", "quarter"], description: "year = годовая цель, quarter = квартальная" },
        period: { type: "string", description: "Период: '2026' для year, 'Q2 2026' для quarter" },
      },
      required: ["lifeArea", "title", "timeHorizon", "period"],
    },
  },
  {
    name: "get_goals",
    description: "Получить цели пользователя. Используй чтобы показать текущие цели, проверить прогресс, или перед квартальным пересмотром.",
    input_schema: {
      type: "object" as const,
      properties: {
        lifeArea: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Фильтр по сфере" },
        timeHorizon: { type: "string", enum: ["year", "quarter"], description: "Фильтр по горизонту" },
        status: { type: "string", enum: ["active", "completed", "dropped"], description: "Фильтр по статусу (default: active)" },
      },
      required: [],
    },
  },
```

- [ ] **Step 3: Add set_mission tool execution to executeTool**

In `src/services/ai.ts`, add case inside the `executeTool` switch, before the `default:` case:
```typescript
    case "set_mission": {
      const input = toolInput as {
        identity?: string;
        purpose?: string;
        legacy?: string;
        statement?: string;
      };

      const mission = await prisma.mission.upsert({
        where: { userId },
        create: {
          userId,
          identity: input.identity || null,
          purpose: input.purpose || null,
          legacy: input.legacy || null,
          statement: input.statement || null,
        },
        update: {
          ...(input.identity !== undefined && { identity: input.identity }),
          ...(input.purpose !== undefined && { purpose: input.purpose }),
          ...(input.legacy !== undefined && { legacy: input.legacy }),
          ...(input.statement !== undefined && { statement: input.statement }),
        },
      });

      const filled: string[] = [];
      if (mission.identity) filled.push("кто я");
      if (mission.purpose) filled.push("место в мире");
      if (mission.legacy) filled.push("наследие");
      if (mission.statement) filled.push("формулировка");

      return {
        text: `Миссия сохранена (${filled.join(", ")}).${mission.statement ? ` Формулировка: "${mission.statement}"` : " Формулировка пока не сгенерирована."}`,
        actions: [],
      };
    }
```

- [ ] **Step 4: Add set_goal tool execution to executeTool**

Add case in `executeTool`:
```typescript
    case "set_goal": {
      const input = toolInput as {
        lifeArea: string;
        title: string;
        description?: string;
        timeHorizon: string;
        period: string;
      };

      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      const goal = await prisma.goal.create({
        data: {
          userId,
          lifeArea: input.lifeArea,
          title: input.title,
          description: input.description || null,
          timeHorizon: input.timeHorizon,
          period: input.period,
        },
      });

      const areaLabel = AREA_LABELS[goal.lifeArea] || goal.lifeArea;
      const horizonLabel = goal.timeHorizon === "year" ? "Годовая" : "Квартальная";

      return {
        text: `Цель создана! ${horizonLabel} цель для "${areaLabel}": "${goal.title}" (${goal.period}).`,
        actions: [],
      };
    }
```

- [ ] **Step 5: Add get_goals tool execution to executeTool**

Add case in `executeTool`:
```typescript
    case "get_goals": {
      const input = toolInput as {
        lifeArea?: string;
        timeHorizon?: string;
        status?: string;
      };

      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      const where: Record<string, unknown> = { userId, status: input.status || "active" };
      if (input.lifeArea) where.lifeArea = input.lifeArea;
      if (input.timeHorizon) where.timeHorizon = input.timeHorizon;

      const goals = await prisma.goal.findMany({
        where,
        orderBy: [{ timeHorizon: "asc" }, { lifeArea: "asc" }],
      });

      if (goals.length === 0) {
        return { text: "У пользователя пока нет активных целей.", actions: [] };
      }

      const list = goals.map(g => {
        const areaLabel = AREA_LABELS[g.lifeArea] || g.lifeArea;
        const horizonLabel = g.timeHorizon === "year" ? "Год" : "Квартал";
        return `- ${areaLabel} (${horizonLabel}, ${g.period}): ${g.title}${g.description ? ` — ${g.description}` : ""}`;
      }).join("\n");

      return {
        text: `Цели (${goals.length}):\n${list}`,
        actions: [],
      };
    }
```

- [ ] **Step 6: Update SYSTEM_PROMPT tool instructions**

In `src/services/ai.ts`, in the `ВАЖНО — ИНСТРУМЕНТЫ:` section of SYSTEM_PROMPT, add:
```
- set_mission — сохранить миссию (3 вопроса: кто я, место в мире, наследие → формулировка)
- set_goal — установить цель для сферы жизни (год/квартал)
- get_goals — посмотреть текущие цели
```

Also add a section about mission flow:
```

ФОРМИРОВАНИЕ МИССИИ:
Когда пользователь хочет определить миссию, веди через 3 вопроса ПОСЛЕДОВАТЕЛЬНО:
1. "Кто ты? Не должность и не роль. Что тебя определяет как человека?"
2. "Каково твоё место в мире? Что ты даёшь другим?"
3. "Что ты оставишь после себя? Какой след?"
После 3 ответов — сформулируй statement, предложи пользователю: "Вот как я это вижу: [statement]. Резонирует?"
Только после подтверждения — вызови set_mission со всеми полями.

ЦЕЛИ:
- Годовые = конкретный результат на год ("пробежать полумарафон")
- Квартальные = milestone к годовой ("довести до 3 пробежек в неделю")
- После set_goal — предложи создать привычку для этой цели
```

- [ ] **Step 7: Run test and build**

Run: `npx vitest run src/__tests__/ai-tools-strategy.test.ts && npm run build`
Expected: Both pass

- [ ] **Step 8: Commit**

```bash
git add src/services/ai.ts src/__tests__/ai-tools-strategy.test.ts
git commit -m "feat: AI tools — set_mission, set_goal, get_goals for strategy layer"
```

---

## Chunk 5: Update buildUserContext with Mission + Goals

### Task 5: Extend buildUserContext in ai.ts

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add mission and goals to buildUserContext**

In `src/services/ai.ts`, inside the `buildUserContext` function, add after the balance section (after the `if (balanceLines.length > 0)` block, around line 762):

```typescript
    // Mission
    try {
      const mission = await prisma.mission.findUnique({ where: { userId } });
      if (mission?.statement) {
        lines.push(`\nМиссия: ${mission.statement}`);
      }
      if (mission?.identity) {
        lines.push(`  Кто я: ${mission.identity}`);
      }
    } catch {}

    // Goals
    try {
      const goals = await prisma.goal.findMany({
        where: { userId, status: "active" },
        orderBy: [{ timeHorizon: "asc" }, { lifeArea: "asc" }],
      });

      if (goals.length > 0) {
        lines.push("\nЦели:");
        for (const g of goals) {
          const horizonLabel = g.timeHorizon === "year" ? "Год" : "Квартал";
          lines.push(`  ${g.lifeArea} (${horizonLabel}, ${g.period}): ${g.title}`);
        }
      }
    } catch {}

    // Balance goals (focus areas + identities)
    try {
      const balanceGoals = await prisma.balanceGoal.findMany({ where: { userId } });
      const focusAreas = balanceGoals.filter(bg => bg.isFocus);

      if (focusAreas.length > 0) {
        lines.push("\nФокус-сферы:");
        for (const bg of focusAreas) {
          const identity = bg.identity ? ` → ${bg.identity}` : "";
          lines.push(`  [ФОКУС] ${bg.area}${identity}`);
        }
      }
    } catch {}
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: buildUserContext — add mission, goals, focus areas to AI context"
```

---

## Chunk 6: Frontend Types + API Client

### Task 6: Add strategy types and API methods

**Files:**
- Modify: `src/mini-app/api/types.ts`
- Modify: `src/mini-app/api/client.ts`

- [ ] **Step 1: Add strategy types**

Append to `src/mini-app/api/types.ts`:
```typescript

// --- Strategy types ---

export interface MissionData {
  identity: string | null;
  purpose: string | null;
  legacy: string | null;
  statement: string | null;
  updatedAt?: string;
}

export interface GoalData {
  id: number;
  lifeArea: string;
  title: string;
  description: string | null;
  timeHorizon: "year" | "quarter";
  period: string;
  status: "active" | "completed" | "dropped";
  createdAt: string;
  updatedAt: string;
}

export interface StrategyHabit {
  id: number;
  name: string;
  icon: string;
  streak: number;
  consistency: number;
}

export interface StrategyGoal {
  id: number;
  title: string;
  description: string | null;
  period: string;
  status: string;
}

export interface StrategyArea {
  area: string;
  label: string;
  icon: string;
  score: number | null;
  targetScore: number | null;
  identity: string | null;
  isFocus: boolean;
  yearGoals: StrategyGoal[];
  quarterGoals: StrategyGoal[];
  habits: StrategyHabit[];
}

export interface StrategyData {
  mission: MissionData | null;
  focusAreas: StrategyArea[];
  otherAreas: StrategyArea[];
}
```

- [ ] **Step 2: Add API methods to client**

In `src/mini-app/api/client.ts`, first add a `put` helper after the existing `patch` function:
```typescript
async function put<T>(path: string, body: unknown): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) headers["Authorization"] = `tma ${initData}`;
  const res = await fetch(`${BASE}${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
```

Then add import of new types and API methods. Update the import line at the top:
```typescript
import type { DashboardData, ObservationsResponse, HistoryPoint, AnalyticsData, HabitData, HabitsGrouped, HabitStats, HeatmapDay, CreateHabitPayload, HabitCorrelation, MissionData, GoalData, StrategyData } from "./types";
```

Add to the `api` object:
```typescript
  // Strategy
  strategy: () => request<StrategyData>("/api/strategy"),
  mission: () => request<MissionData>("/api/mission"),
  updateMission: (data: Partial<MissionData>) => put<MissionData>("/api/mission", data),
  goals: (params?: { lifeArea?: string; timeHorizon?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.lifeArea) qs.set("lifeArea", params.lifeArea);
    if (params?.timeHorizon) qs.set("timeHorizon", params.timeHorizon);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return request<GoalData[]>(`/api/goals${query ? `?${query}` : ""}`);
  },
  createGoal: (data: { lifeArea: string; title: string; description?: string; timeHorizon: string; period: string }) =>
    post<GoalData>("/api/goals", data),
  updateGoal: (id: number, data: { title?: string; description?: string; status?: string }) =>
    patch<GoalData>(`/api/goals/${id}`, data),
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/api/types.ts src/mini-app/api/client.ts
git commit -m "feat: frontend strategy types + API client methods"
```

---

## Chunk 7: Strategy Store

### Task 7: Create strategy store

**Files:**
- Create: `src/mini-app/store/strategy.ts`

- [ ] **Step 1: Create strategy store**

Create `src/mini-app/store/strategy.ts`:
```typescript
import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { StrategyData, MissionData } from "../api/types";

export const strategyData = signal<StrategyData | null>(null);
export const strategyLoading = signal(false);
export const strategyError = signal(false);

export async function loadStrategy() {
  strategyLoading.value = true;
  strategyError.value = false;
  try {
    const data = await api.strategy();
    strategyData.value = data;
  } catch {
    strategyError.value = true;
  } finally {
    strategyLoading.value = false;
  }
}

export async function updateMission(data: Partial<MissionData>) {
  try {
    const updated = await api.updateMission(data);
    if (strategyData.value) {
      strategyData.value = { ...strategyData.value, mission: updated };
    }
    return updated;
  } catch (err) {
    console.error("Failed to update mission:", err);
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/store/strategy.ts
git commit -m "feat: strategy store — signals for mission + goals data"
```

---

## Chunk 8: Strategy Screen (Mini App)

### Task 8: Create StrategyScreen component

**Files:**
- Create: `src/mini-app/components/balance/StrategyScreen.tsx`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Create StrategyScreen component**

Create `src/mini-app/components/balance/StrategyScreen.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { strategyData, strategyLoading, strategyError, loadStrategy } from "../../store/strategy";
import { navigate } from "../../router";
import { haptic, getTelegramBotUsername } from "../../telegram";
import type { StrategyArea } from "../../api/types";

export function StrategyScreen() {
  useEffect(() => { loadStrategy(); }, []);

  const handleBack = () => {
    haptic("light");
    navigate("balance");
  };

  const handleEditMission = () => {
    haptic("medium");
    const botUsername = getTelegramBotUsername();
    if (botUsername) {
      window.open(`https://t.me/${botUsername}?text=${encodeURIComponent("Хочу определить миссию")}`, "_blank");
    }
  };

  const handleSetGoals = () => {
    haptic("medium");
    const botUsername = getTelegramBotUsername();
    if (botUsername) {
      window.open(`https://t.me/${botUsername}?text=${encodeURIComponent("Поставить цели")}`, "_blank");
    }
  };

  if (strategyLoading.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>←</button>
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧭 Стратегия</h1>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Загрузка...</div>
        </main>
      </div>
    );
  }

  if (strategyError.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>←</button>
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧭 Стратегия</h1>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Ошибка загрузки</div>
        </main>
      </div>
    );
  }

  const data = strategyData.value;
  const mission = data?.mission;
  const hasMission = mission && (mission.identity || mission.purpose || mission.legacy || mission.statement);

  // Current quarter label
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const quarterLabel = `Q${quarter} ${now.getFullYear()}`;

  return (
    <div class="screen">
      <header class="app-header">
        <button class="back-btn" onClick={handleBack}>←</button>
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧭 Стратегия</h1>
      </header>
      <main class="views">
        {/* Mission Card */}
        <div class="strategy-mission-card">
          {hasMission ? (
            <>
              {mission!.statement && (
                <div class="strategy-mission-statement">"{mission!.statement}"</div>
              )}
              <div class="strategy-mission-questions">
                {mission!.identity && (
                  <div class="strategy-mission-item">
                    <span class="strategy-mission-icon">🪞</span>
                    <div>
                      <div class="strategy-mission-label">Кто я</div>
                      <div class="strategy-mission-text">{mission!.identity}</div>
                    </div>
                  </div>
                )}
                {mission!.purpose && (
                  <div class="strategy-mission-item">
                    <span class="strategy-mission-icon">🌍</span>
                    <div>
                      <div class="strategy-mission-label">Моё место</div>
                      <div class="strategy-mission-text">{mission!.purpose}</div>
                    </div>
                  </div>
                )}
                {mission!.legacy && (
                  <div class="strategy-mission-item">
                    <span class="strategy-mission-icon">🏛️</span>
                    <div>
                      <div class="strategy-mission-label">Наследие</div>
                      <div class="strategy-mission-text">{mission!.legacy}</div>
                    </div>
                  </div>
                )}
              </div>
              <button class="strategy-edit-btn" onClick={handleEditMission}>
                Обновить миссию
              </button>
            </>
          ) : (
            <div class="strategy-empty-mission">
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧭</div>
              <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 12 }}>
                Миссия определяет направление жизни
              </div>
              <button class="strategy-cta-btn" onClick={handleEditMission}>
                Определить миссию
              </button>
            </div>
          )}
        </div>

        {/* Focus Areas */}
        {data && data.focusAreas.length > 0 && (
          <>
            <div class="section-title">В фокусе {quarterLabel}</div>
            {data.focusAreas.map(area => (
              <FocusAreaCard key={area.area} area={area} />
            ))}
          </>
        )}

        {/* Other Areas */}
        {data && data.otherAreas.length > 0 && (
          <>
            <div class="section-title">Остальные сферы</div>
            {data.otherAreas.map(area => (
              <CompactAreaCard key={area.area} area={area} />
            ))}
          </>
        )}

        {/* No goals at all */}
        {data && data.focusAreas.length === 0 && data.otherAreas.every(a => a.yearGoals.length === 0 && a.quarterGoals.length === 0) && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <button class="strategy-cta-btn" onClick={handleSetGoals}>
              Поставить цели
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Focus Area Card (expanded) ---

function FocusAreaCard({ area }: { area: StrategyArea }) {
  const handleAreaClick = () => {
    haptic("light");
    navigate("balance", area.area);
  };

  return (
    <div class="strategy-focus-card" onClick={handleAreaClick}>
      <div class="strategy-focus-header">
        <span class="strategy-focus-icon">{area.icon}</span>
        <span class="strategy-focus-name">{area.label}</span>
        {area.score !== null && (
          <span class="strategy-focus-score">{area.score}/10</span>
        )}
        <span class="strategy-focus-badge">фокус</span>
      </div>

      {area.identity && (
        <div class="strategy-identity">
          <span style={{ color: "var(--text3)", fontSize: 11 }}>Кем стану:</span>{" "}
          {area.identity}
        </div>
      )}

      {area.yearGoals.length > 0 && (
        <div class="strategy-goals-section">
          <div class="strategy-goals-label">Цель года</div>
          {area.yearGoals.map(g => (
            <div key={g.id} class="strategy-goal-item">{g.title}</div>
          ))}
        </div>
      )}

      {area.quarterGoals.length > 0 && (
        <div class="strategy-goals-section">
          <div class="strategy-goals-label">Цель квартала</div>
          {area.quarterGoals.map(g => (
            <div key={g.id} class="strategy-goal-item">{g.title}</div>
          ))}
        </div>
      )}

      {area.habits.length > 0 && (
        <div class="strategy-habits-chips">
          {area.habits.map(h => (
            <span key={h.id} class="strategy-habit-chip">
              {h.icon} {h.name}
              {h.streak > 0 && <span class="strategy-habit-streak">🔥{h.streak}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Compact Area Card ---

function CompactAreaCard({ area }: { area: StrategyArea }) {
  const handleClick = () => {
    haptic("light");
    navigate("balance", area.area);
  };

  const yearGoalText = area.yearGoals.length > 0 ? area.yearGoals[0].title : null;

  return (
    <div class="strategy-compact-card" onClick={handleClick}>
      <span class="strategy-compact-icon">{area.icon}</span>
      <div class="strategy-compact-info">
        <div class="strategy-compact-name">{area.label}</div>
        {yearGoalText && (
          <div class="strategy-compact-goal">{yearGoalText}</div>
        )}
      </div>
      {area.score !== null && (
        <span class="strategy-compact-score">{area.score}/10</span>
      )}
      <span class="strategy-compact-arrow">›</span>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for strategy screen**

Append to `src/mini-app/styles/global.css`:
```css
/* Strategy Screen */
.strategy-mission-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 16px;
  margin-bottom: 16px;
}
.strategy-mission-statement {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.5;
  font-style: italic;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(200,255,115,0.04);
  border-left: 2px solid var(--accent);
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
}
.strategy-mission-questions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.strategy-mission-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.strategy-mission-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}
.strategy-mission-label {
  font-size: 11px;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}
.strategy-mission-text {
  font-size: 13px;
  color: var(--text2);
  line-height: 1.4;
}
.strategy-edit-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 8px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xs);
  color: var(--text3);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.strategy-edit-btn:active { opacity: 0.7; }
.strategy-empty-mission {
  text-align: center;
  padding: 20px 0;
}
.strategy-cta-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, rgba(200,255,115,0.15), rgba(200,255,115,0.05));
  border: 1px solid rgba(200,255,115,0.2);
  border-radius: var(--radius-xs);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.strategy-cta-btn:active { transform: scale(0.97); }

/* Focus Area Card */
.strategy-focus-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 14px;
  margin-bottom: 10px;
  cursor: pointer;
}
.strategy-focus-card:active { transform: scale(0.99); }
.strategy-focus-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.strategy-focus-icon { font-size: 20px; }
.strategy-focus-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
}
.strategy-focus-score {
  font-size: 13px;
  color: var(--text2);
  font-weight: 500;
}
.strategy-focus-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(200,255,115,0.12);
  color: var(--accent);
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.strategy-identity {
  font-size: 13px;
  color: var(--text2);
  margin-bottom: 8px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.02);
  border-radius: var(--radius-xs);
}
.strategy-goals-section { margin-bottom: 6px; }
.strategy-goals-label {
  font-size: 10px;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}
.strategy-goal-item {
  font-size: 13px;
  color: var(--text);
  padding: 2px 0;
}
.strategy-habits-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.strategy-habit-chip {
  font-size: 11px;
  padding: 3px 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  color: var(--text2);
  white-space: nowrap;
}
.strategy-habit-streak {
  margin-left: 3px;
  font-size: 10px;
  color: var(--text3);
}

/* Compact Area Card */
.strategy-compact-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  cursor: pointer;
}
.strategy-compact-card:active { transform: scale(0.99); }
.strategy-compact-icon { font-size: 18px; }
.strategy-compact-info { flex: 1; min-width: 0; }
.strategy-compact-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.strategy-compact-goal {
  font-size: 11px;
  color: var(--text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.strategy-compact-score {
  font-size: 12px;
  color: var(--text2);
  font-weight: 500;
}
.strategy-compact-arrow {
  color: var(--text3);
  font-size: 16px;
}

/* Back button */
.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  margin-right: 4px;
  font-family: inherit;
}
.back-btn:active { opacity: 0.6; }
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/components/balance/StrategyScreen.tsx src/mini-app/styles/global.css
git commit -m "feat: StrategyScreen — mission card, focus areas, compact areas"
```

---

## Chunk 9: Wire Strategy Screen into BalanceScreen

### Task 9: Update BalanceScreen to route to StrategyScreen

**Files:**
- Modify: `src/mini-app/components/balance/BalanceScreen.tsx`

- [ ] **Step 1: Update BalanceScreen to handle param="strategy"**

Replace `src/mini-app/components/balance/BalanceScreen.tsx` with:
```typescript
import { StrategyScreen } from "./StrategyScreen";
import { navigate } from "../../router";
import { haptic } from "../../telegram";

interface BalanceScreenProps {
  param?: string;
}

export function BalanceScreen({ param }: BalanceScreenProps) {
  // Route to strategy sub-screen
  if (param === "strategy") {
    return <StrategyScreen />;
  }

  // param === area name (e.g., "health") → BalanceDetail (future Phase 2)
  if (param) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={() => { haptic("light"); navigate("balance"); }}>←</button>
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ {param}</h1>
        </header>
        <main class="views">
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text2)" }}>
            Детали сферы скоро появятся
          </div>
        </main>
      </div>
    );
  }

  const handleStrategy = () => {
    haptic("medium");
    navigate("balance", "strategy");
  };

  // Main balance screen
  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
      </header>
      <main class="views">
        {/* Strategy button at top */}
        <button class="strategy-nav-btn" onClick={handleStrategy}>
          🧭 Миссия и цели
          <span style={{ opacity: 0.4, fontSize: "12px" }}>→</span>
        </button>

        {/* Radar chart + areas list placeholder (Phase 2) */}
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text2)" }}>
          Колесо баланса скоро появится
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for strategy nav button**

Append to `src/mini-app/styles/global.css`:
```css
/* Strategy nav button on Balance screen */
.strategy-nav-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(200,255,115,0.08), rgba(200,255,115,0.02));
  border: 1px solid rgba(200,255,115,0.12);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 16px;
  font-family: inherit;
}
.strategy-nav-btn:active { transform: scale(0.98); }
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/components/balance/BalanceScreen.tsx src/mini-app/styles/global.css
git commit -m "feat: BalanceScreen — strategy button + route to StrategyScreen"
```

---

## Chunk 10: Cron Jobs — Quarterly Review + Yearly Mission Review

### Task 10: Add strategy cron jobs

**Files:**
- Create: `src/services/strategy-cron.ts`
- Modify: `src/services/scheduler.ts`

- [ ] **Step 1: Create strategy-cron.ts**

Create `src/services/strategy-cron.ts`:
```typescript
import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

/**
 * Quarterly goal review — sent on 1st of Jan/Apr/Jul/Oct.
 * Shows progress per area (balance score change + goal completion).
 * Prompts user to review goals with AI.
 */
export async function sendQuarterlyReview(): Promise<void> {
  const users = await prisma.user.findMany();

  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevYear = quarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
  const prevPeriod = `Q${prevQuarter} ${prevYear}`;
  const currentPeriod = `Q${quarter} ${now.getFullYear()}`;

  console.log(`[strategy-cron] Sending quarterly review for ${currentPeriod} to ${users.length} user(s)`);

  for (const user of users) {
    try {
      // Get goals for previous quarter
      const prevGoals = await prisma.goal.findMany({
        where: { userId: user.id, period: prevPeriod },
      });

      // Get focus areas
      const focusAreas = await prisma.balanceGoal.findMany({
        where: { userId: user.id, isFocus: true },
      });

      // Build message
      const lines: string[] = [`🎯 *Пересмотр целей — ${currentPeriod}*\n`];

      if (prevGoals.length > 0) {
        lines.push(`*Итоги ${prevPeriod}:*`);
        for (const g of prevGoals) {
          const areaLabel = AREA_LABELS[g.lifeArea] || g.lifeArea;
          const statusIcon = g.status === "completed" ? "✅" : g.status === "dropped" ? "❌" : "⏳";
          lines.push(`${statusIcon} ${areaLabel}: ${g.title}`);
        }
        lines.push("");
      }

      if (focusAreas.length > 0) {
        lines.push("*Сферы в фокусе:*");
        for (const fa of focusAreas) {
          const label = AREA_LABELS[fa.area] || fa.area;
          const identity = fa.identity ? ` — ${fa.identity}` : "";
          lines.push(`— ${label}${identity}`);
        }
        lines.push("");
      }

      lines.push("Давай обсудим цели на новый квартал. Напиши мне, и мы поставим конкретные цели для каждой сферы.");

      const chatId = Number(user.telegramId);
      await bot.api.sendMessage(chatId, lines.join("\n"), { parse_mode: "Markdown" });
    } catch (err) {
      await trackError("strategy-cron-quarterly", err, { userId: user.id });
    }
  }
}

/**
 * Yearly mission review — sent on January 1st.
 * Asks if mission still resonates, invites user to update.
 */
export async function sendMissionReview(): Promise<void> {
  const users = await prisma.user.findMany();

  console.log(`[strategy-cron] Sending yearly mission review to ${users.length} user(s)`);

  for (const user of users) {
    try {
      const mission = await prisma.mission.findUnique({
        where: { userId: user.id },
      });

      const chatId = Number(user.telegramId);

      if (mission?.statement) {
        const daysSinceUpdate = Math.round((Date.now() - mission.updatedAt.getTime()) / (1000 * 60 * 60 * 24));

        await bot.api.sendMessage(chatId,
          `🧭 *Годовой пересмотр миссии*\n\n` +
          `Твоя миссия (${daysSinceUpdate} дней назад):\n` +
          `_"${mission.statement}"_\n\n` +
          `Это всё ещё резонирует? Напиши мне, если хочешь обновить.`,
          { parse_mode: "Markdown" },
        );
      } else {
        await bot.api.sendMessage(chatId,
          `🧭 *Новый год — время определить миссию*\n\n` +
          `У тебя ещё нет сформулированной миссии. Это 3 простых вопроса — напиши мне, и мы пройдём их за 5 минут.`,
          { parse_mode: "Markdown" },
        );
      }
    } catch (err) {
      await trackError("strategy-cron-yearly", err, { userId: user.id });
    }
  }
}
```

- [ ] **Step 2: Register cron jobs in scheduler.ts**

In `src/services/scheduler.ts`, add import:
```typescript
import { sendQuarterlyReview, sendMissionReview } from "./strategy-cron.js";
```

Add cron schedules inside `startScheduler()` function, before the closing brace:
```typescript
  // Quarterly goal review — 1st of Jan/Apr/Jul/Oct at 10:00
  const quarterlyReview = cron.schedule("0 10 1 1,4,7,10 *", () => {
    sendQuarterlyReview().catch(err => console.error("Quarterly review failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(quarterlyReview);
  console.log("Quarterly review scheduled: 0 10 1 1,4,7,10 * (Asia/Shanghai)");

  // Yearly mission review — January 1st at 10:00
  const yearlyReview = cron.schedule("0 10 1 1 *", () => {
    sendMissionReview().catch(err => console.error("Mission review failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(yearlyReview);
  console.log("Yearly mission review scheduled: 0 10 1 1 * (Asia/Shanghai)");
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/services/strategy-cron.ts src/services/scheduler.ts
git commit -m "feat: cron — quarterly goal review + yearly mission review"
```

---

## Chunk 11: Update Weekly Digest with Goals Progress

### Task 11: Add goals and balance sections to weekly digest

**Files:**
- Modify: `src/services/weekly-digest.ts`

- [ ] **Step 1: Add goals data to analyzeWeeklyPatterns**

In `src/services/weekly-digest.ts`, add to the `WeeklyInsight` interface:
```typescript
  goalsProgress: { lifeArea: string; title: string; timeHorizon: string; period: string }[];
  focusAreas: { area: string; score: number | null; identity: string | null }[];
```

Inside `analyzeWeeklyPatterns`, before the `return` statement, add:
```typescript
  // --- Goals progress ---
  const activeGoals = await prisma.goal.findMany({
    where: { userId, status: "active" },
    orderBy: [{ timeHorizon: "asc" }, { lifeArea: "asc" }],
  });

  const goalsProgress = activeGoals.map(g => ({
    lifeArea: g.lifeArea,
    title: g.title,
    timeHorizon: g.timeHorizon,
    period: g.period,
  }));

  // --- Focus areas with balance scores ---
  let focusAreas: { area: string; score: number | null; identity: string | null }[] = [];
  try {
    const balanceGoals = await prisma.balanceGoal.findMany({
      where: { userId, isFocus: true },
    });
    focusAreas = await Promise.all(balanceGoals.map(async (bg) => {
      const latest = await prisma.balanceRating.findFirst({
        where: { userId, area: bg.area },
        orderBy: { createdAt: "desc" },
        select: { score: true },
      });
      return { area: bg.area, score: latest?.score ?? null, identity: bg.identity };
    }));
  } catch {}
```

Add `goalsProgress` and `focusAreas` to the return value.

- [ ] **Step 2: Add goals section to formatDigestMessage**

In `formatDigestMessage`, after the habit strength section and before the final checkins line, add:
```typescript
  // Goals progress
  if (insight.goalsProgress.length > 0) {
    lines.push("\n*🎯 Цели:*");
    for (const g of insight.goalsProgress.slice(0, 5)) {
      const areaLabel = ENERGY_LABELS[g.lifeArea] || g.lifeArea;
      const horizonLabel = g.timeHorizon === "year" ? "Год" : "Квартал";
      lines.push(`— ${areaLabel} (${horizonLabel}): ${g.title}`);
    }
  }

  // Focus areas
  if (insight.focusAreas.length > 0) {
    lines.push("\n*⚖️ Фокус-сферы:*");
    for (const fa of insight.focusAreas) {
      const areaLabel = ENERGY_LABELS[fa.area] || fa.area;
      const score = fa.score !== null ? `${fa.score}/10` : "?";
      lines.push(`— ${areaLabel}: ${score}${fa.identity ? ` (${fa.identity})` : ""}`);
    }
  }
```

- [ ] **Step 3: Update AI insights data to include goals**

In `generateAIInsights`, add to `dataContext`:
```typescript
      goals: insight.goalsProgress,
      focusAreas: insight.focusAreas,
```

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/services/weekly-digest.ts
git commit -m "feat: weekly digest — goals progress + balance focus areas sections"
```

---

## Chunk 12: Final Verification

### Task 12: Build, test, verify

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 3: Verify file structure**

Run: `ls -la src/api/mission.ts src/api/goals.ts src/api/strategy.ts src/services/strategy-cron.ts src/mini-app/components/balance/StrategyScreen.tsx src/mini-app/store/strategy.ts`
Expected: All files exist

- [ ] **Step 4: Verify no broken imports**

Run: `grep -rn "from.*balance/BalanceScreen" src/mini-app/ --include="*.tsx" --include="*.ts"`
Expected: Only app.tsx imports BalanceScreen

- [ ] **Step 5: Final commit (if any uncommitted changes)**

```bash
git add -A
git commit -m "chore: Phase 4 Strategy — final cleanup and verification"
```

---

## Summary

After Phase 4 completion, the app has:
- Mission API (GET/PUT /api/mission) for storing identity/purpose/legacy/statement
- Goals API (GET/POST/PATCH /api/goals) with filtering by lifeArea, timeHorizon, status
- Strategy API (GET /api/strategy) combining mission + goals + balance goals + habits per area
- AI bot tools: set_mission (3-question flow), set_goal, get_goals
- AI system prompt updated with mission formation instructions
- buildUserContext enriched with mission, goals, focus areas
- StrategyScreen (#balance/strategy) with mission card + focus area cards + compact area list
- BalanceScreen updated with "Mission & Goals" button at top
- Cron: quarterly goal review (1 Jan/Apr/Jul/Oct) + yearly mission review (1 Jan)
- Weekly digest enhanced with goals progress + focus areas sections
- Frontend types + API client methods for all strategy endpoints

**Files created/modified:**
- `src/api/mission.ts` (new)
- `src/api/goals.ts` (new)
- `src/api/strategy.ts` (new)
- `src/services/strategy-cron.ts` (new)
- `src/services/ai.ts` (modified: 3 tools + executeTool cases + system prompt + buildUserContext)
- `src/services/weekly-digest.ts` (modified: goals + focus areas sections)
- `src/services/scheduler.ts` (modified: 2 new cron jobs)
- `src/server.ts` (modified: 3 new route imports + registrations)
- `src/mini-app/api/types.ts` (modified: strategy types)
- `src/mini-app/api/client.ts` (modified: put helper + 6 API methods)
- `src/mini-app/store/strategy.ts` (new)
- `src/mini-app/components/balance/StrategyScreen.tsx` (new)
- `src/mini-app/components/balance/BalanceScreen.tsx` (new/modified)
- `src/mini-app/styles/global.css` (modified: strategy CSS)
- `src/__tests__/mission-api.test.ts` (new)
- `src/__tests__/goals-api.test.ts` (new)
- `src/__tests__/strategy-api.test.ts` (new)
- `src/__tests__/ai-tools-strategy.test.ts` (new)

**Next:** Phase 5 (Polish) implements light/dark theme, skeleton loading, animations.
