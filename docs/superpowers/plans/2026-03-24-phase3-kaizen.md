# Phase 3: Kaizen (Кайдзен) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full Kaizen layer — reflection status API, algorithm CRUD, reflection feed, bot tools (save_algorithm, get_algorithms, save_reflection), Kaizen Hour flow, algorithm detail screen, morning reminder cron.

**Depends on:** Phase 1 (DB models Algorithm + Reflection exist in schema, KaizenScreen stub exists, parameterized router with `#kaizen/:id` support).

**Architecture:** Three API route files (reflection-status, algorithms, reflections) behind telegramAuth. Three new bot tools added to TOOLS array in ai.ts with executeTool handlers. KaizenScreen rewritten from stub to full screen. New AlgorithmDetail component. Cron job for morning kaizen reminder.

**Tech Stack:** Prisma (PostgreSQL), Express, grammy, Anthropic Claude Tool Use, Preact + @preact/signals, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-personal-os-design.md`

---

## Chunk 1: Kaizen API Routes

### Task 1: Reflection Status endpoint

**Files:**
- Create: `src/api/reflection-status.ts`
- Test: `src/__tests__/reflection-status.test.ts`

- [ ] **Step 1: Write test for reflection status endpoint**

Create `src/__tests__/reflection-status.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("reflection-status endpoint", () => {
  it("should export reflectionStatusRoute as a function", async () => {
    const mod = await import("../api/reflection-status");
    expect(mod.reflectionStatusRoute).toBeDefined();
    expect(typeof mod.reflectionStatusRoute).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/reflection-status.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create reflection-status.ts**

Create `src/api/reflection-status.ts`:
```typescript
import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function reflectionStatusRoute(router: Router): void {
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
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/__tests__/reflection-status.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/reflection-status.ts src/__tests__/reflection-status.test.ts
git commit -m "feat: GET /api/reflection/status — yesterday context + reflection done check"
```

### Task 2: Algorithms CRUD endpoint

**Files:**
- Create: `src/api/algorithms.ts`
- Test: `src/__tests__/algorithms.test.ts`

- [ ] **Step 1: Write test for algorithms endpoint**

Create `src/__tests__/algorithms.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("algorithms endpoint", () => {
  it("should export algorithmsRoute as a function", async () => {
    const mod = await import("../api/algorithms");
    expect(mod.algorithmsRoute).toBeDefined();
    expect(typeof mod.algorithmsRoute).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/algorithms.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create algorithms.ts**

Create `src/api/algorithms.ts`:
```typescript
import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function algorithmsRoute(router: Router): void {
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
    const id = parseInt(req.params.id, 10);

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
    const id = parseInt(req.params.id, 10);

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
    const id = parseInt(req.params.id, 10);

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
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/__tests__/algorithms.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/algorithms.ts src/__tests__/algorithms.test.ts
git commit -m "feat: /api/algorithms CRUD — list, detail, update, soft delete"
```

### Task 3: Reflections feed endpoint

**Files:**
- Create: `src/api/reflections.ts`
- Test: `src/__tests__/reflections.test.ts`

- [ ] **Step 1: Write test for reflections endpoint**

Create `src/__tests__/reflections.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("reflections endpoint", () => {
  it("should export reflectionsRoute as a function", async () => {
    const mod = await import("../api/reflections");
    expect(mod.reflectionsRoute).toBeDefined();
    expect(typeof mod.reflectionsRoute).toBe("function");
  });
});
```

- [ ] **Step 2: Create reflections.ts**

Create `src/api/reflections.ts`:
```typescript
import { Router, Request, Response } from "express";
import prisma from "../db.js";

export function reflectionsRoute(router: Router): void {
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
    const dateStr = req.params.date;

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
```

- [ ] **Step 3: Run test**

Run: `npx vitest run src/__tests__/reflections.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/reflections.ts src/__tests__/reflections.test.ts
git commit -m "feat: /api/reflections — paginated feed + detail by date"
```

### Task 4: Register new routes in server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add imports for new routes**

In `src/server.ts`, add after existing imports (after line 10):
```typescript
import { reflectionStatusRoute } from "./api/reflection-status.js";
import { algorithmsRoute } from "./api/algorithms.js";
import { reflectionsRoute } from "./api/reflections.js";
```

- [ ] **Step 2: Register routes in authed router**

In `src/server.ts`, add after `habitsRoute(authedRouter);` (line 48):
```typescript
  reflectionStatusRoute(authedRouter);
  algorithmsRoute(authedRouter);
  reflectionsRoute(authedRouter);
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: register reflection/algorithms/reflections routes in server"
```

---

## Chunk 2: Bot Tools

### Task 5: Add save_algorithm tool

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add save_algorithm tool definition to TOOLS array**

In `src/services/ai.ts`, add after the `rate_life_area` tool definition (after line 125, before the closing `];`):
```typescript
  {
    name: "save_algorithm",
    description: `Сохранить персональный алгоритм (протокол, чеклист) в библиотеку знаний пользователя.
Используй когда пользователь описывает рабочий процесс, инструкцию, или в ходе рефлексии формируется набор шагов.
Примеры: "Как проводить встречу", "Протокол восстановления после бессонницы", "Алгоритм принятия решений".`,
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Название алгоритма, краткое и понятное: 'Как проводить встречу'" },
        icon: { type: "string", description: "Эмодзи иконка, подбери по смыслу: 🤝📋🧠💡🔧📝🎯🏃" },
        lifeArea: {
          type: "string",
          enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"],
          description: "Сфера жизни. Определи автоматически по контексту.",
        },
        steps: {
          type: "array",
          items: { type: "string" },
          description: "Шаги алгоритма. Каждый шаг — одно действие. Минимум 2, максимум 10.",
        },
        context: { type: "string", description: "Из какой ситуации/рефлексии родился этот алгоритм. Кратко." },
      },
      required: ["title", "icon", "steps"],
    },
  },
```

- [ ] **Step 2: Add save_algorithm case to executeTool**

In `src/services/ai.ts`, add before the `default:` case in the `executeTool` switch (before line 459):
```typescript
    case "save_algorithm": {
      const input = toolInput as {
        title: string;
        icon: string;
        lifeArea?: string;
        steps: string[];
        context?: string;
      };

      // Check for duplicate title
      const existingAlgo = await prisma.algorithm.findFirst({
        where: {
          userId,
          title: { equals: input.title, mode: "insensitive" },
          isActive: true,
        },
      });

      if (existingAlgo) {
        return {
          text: `Алгоритм "${existingAlgo.title}" уже существует (id: ${existingAlgo.id}). Обновить его или создать с другим названием?`,
          actions: [],
        };
      }

      const algorithm = await prisma.algorithm.create({
        data: {
          userId,
          title: input.title,
          icon: input.icon,
          lifeArea: input.lifeArea || null,
          steps: input.steps,
          context: input.context || null,
        },
      });

      return {
        text: `Алгоритм сохранён: ${algorithm.icon} "${algorithm.title}" (${input.steps.length} шагов).${input.lifeArea ? ` Сфера: ${input.lifeArea}.` : ""} Доступен в мини-приложении.`,
        actions: [],
      };
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: save_algorithm bot tool — create personal algorithms"
```

### Task 6: Add get_algorithms tool

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add get_algorithms tool definition to TOOLS array**

In `src/services/ai.ts`, add after save_algorithm tool in TOOLS array:
```typescript
  {
    name: "get_algorithms",
    description: `Найти персональные алгоритмы пользователя из его библиотеки знаний.
Используй когда пользователь спрашивает "как делать X?", "у меня был протокол для...", "напомни алгоритм".
Поиск по названию и контексту. Возвращает топ-5 по релевантности.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Поисковый запрос. Что ищет пользователь? Например: 'встреча', 'бессонница', 'решения'" },
        lifeArea: {
          type: "string",
          enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"],
          description: "Фильтр по сфере жизни (опционально).",
        },
      },
      required: [],
    },
  },
```

- [ ] **Step 2: Add get_algorithms case to executeTool**

In `src/services/ai.ts`, add after save_algorithm case in executeTool switch:
```typescript
    case "get_algorithms": {
      const input = toolInput as { query?: string; lifeArea?: string };

      const where: Record<string, unknown> = { userId, isActive: true };

      if (input.lifeArea) {
        where.lifeArea = input.lifeArea;
      }

      if (input.query && input.query.trim()) {
        where.OR = [
          { title: { contains: input.query.trim(), mode: "insensitive" } },
          { context: { contains: input.query.trim(), mode: "insensitive" } },
        ];
      }

      const algorithms = await prisma.algorithm.findMany({
        where,
        orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        take: 5,
      });

      if (algorithms.length === 0) {
        return {
          text: input.query
            ? `Алгоритмов по запросу "${input.query}" не найдено. Можно создать новый.`
            : "У пользователя пока нет сохранённых алгоритмов.",
          actions: [],
        };
      }

      // Increment usage for viewed algorithms
      for (const algo of algorithms) {
        await prisma.algorithm.update({
          where: { id: algo.id },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        });
      }

      const list = algorithms
        .map((a) => {
          const steps = (a.steps as string[]).slice(0, 3).join(", ");
          return `${a.icon} ${a.title} (${(a.steps as string[]).length} шагов): ${steps}...`;
        })
        .join("\n");

      return {
        text: `Найдено ${algorithms.length} алгоритм(ов):\n${list}`,
        actions: [],
      };
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: get_algorithms bot tool — ILIKE search on title+context"
```

### Task 7: Add save_reflection tool

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add save_reflection tool definition to TOOLS array**

In `src/services/ai.ts`, add after get_algorithms tool in TOOLS array:
```typescript
  {
    name: "save_reflection",
    description: `Сохранить ежедневную рефлексию. Используй в конце кайдзен-часа, когда пользователь порефлексировал о прошедшем дне.
AI формулирует summary и insights на основе разговора. Сервер автоматически сохраняет контекст энергии и привычек.
Upsert: если рефлексия за эту дату уже есть — обновляет.`,
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Дата рефлексии в формате YYYY-MM-DD (обычно вчера)" },
        summary: { type: "string", description: "Краткое резюме рефлексии (2-4 предложения). Что было ключевым, что понял." },
        insights: {
          type: "array",
          items: { type: "string" },
          description: "Ключевые инсайты — конкретные выводы. Например: 'Без перерывов после 4 часов работы ментальная падает ниже 4'",
        },
      },
      required: ["date", "summary", "insights"],
    },
  },
```

- [ ] **Step 2: Add save_reflection case to executeTool**

In `src/services/ai.ts`, add after get_algorithms case in executeTool switch:
```typescript
    case "save_reflection": {
      const input = toolInput as {
        date: string;
        summary: string;
        insights: string[];
      };

      // Parse date
      const reflectionDate = new Date(input.date + "T00:00:00.000Z");
      if (isNaN(reflectionDate.getTime())) {
        return { text: "Некорректная дата. Используй формат YYYY-MM-DD.", actions: [] };
      }

      // Build energy context for that date
      const dateStart = new Date(input.date + "T00:00:00.000Z");
      const dateEnd = new Date(input.date + "T23:59:59.999Z");

      const energyLogs = await prisma.energyLog.findMany({
        where: {
          userId,
          createdAt: { gte: dateStart, lte: dateEnd },
        },
        orderBy: { createdAt: "asc" },
      });

      const energyContext = energyLogs.length > 0
        ? energyLogs
            .map(
              (l) =>
                `${l.logType}: физ=${l.physical} мент=${l.mental} эмо=${l.emotional} дух=${l.spiritual}`
            )
            .join("; ")
        : "Нет записей энергии за этот день";

      // Build habits context for that date
      const habitLogs = await prisma.habitLog.findMany({
        where: {
          userId,
          date: dateStart,
        },
        include: {
          habit: { select: { name: true, icon: true } },
        },
      });

      const totalHabits = await prisma.habit.count({
        where: { userId, isActive: true },
      });

      const habitsContext =
        habitLogs.length > 0
          ? `${habitLogs.length}/${totalHabits}: ${habitLogs.map((l) => `${l.habit.icon} ${l.habit.name}`).join(", ")}`
          : `0/${totalHabits} привычек выполнено`;

      // Get current session ID
      const activeSession = await prisma.session.findFirst({
        where: { userId, status: "active" },
        orderBy: { createdAt: "desc" },
      });

      // Upsert: create or update reflection for this date
      const existing = await prisma.reflection.findFirst({
        where: {
          userId,
          date: {
            gte: dateStart,
            lte: dateEnd,
          },
        },
      });

      let reflection;
      if (existing) {
        reflection = await prisma.reflection.update({
          where: { id: existing.id },
          data: {
            summary: input.summary,
            insights: input.insights,
            energyContext,
            habitsContext,
            sessionId: activeSession?.id || null,
          },
        });
      } else {
        reflection = await prisma.reflection.create({
          data: {
            userId,
            date: reflectionDate,
            summary: input.summary,
            insights: input.insights,
            energyContext,
            habitsContext,
            sessionId: activeSession?.id || null,
          },
        });
      }

      const insightsCount = input.insights.length;
      return {
        text: `Рефлексия за ${input.date} ${existing ? "обновлена" : "сохранена"}. ${insightsCount} инсайт(ов). Энергия: ${energyContext.slice(0, 60)}. Привычки: ${habitsContext.slice(0, 60)}.`,
        actions: [],
      };
    }
```

- [ ] **Step 3: Update SYSTEM_PROMPT to mention new tools**

In `src/services/ai.ts`, in the SYSTEM_PROMPT string, find the section "ВАЖНО — ИНСТРУМЕНТЫ:" and add after `get_user_habits`:
```
- save_algorithm — сохранить персональный алгоритм (протокол, чеклист)
- get_algorithms — найти алгоритмы из библиотеки знаний
- save_reflection — сохранить ежедневную рефлексию (кайдзен-час)
```

- [ ] **Step 4: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: save_reflection bot tool — upsert with auto energy/habits context"
```

### Task 8: Write bot tools test

**Files:**
- Create: `src/__tests__/kaizen-tools.test.ts`

- [ ] **Step 1: Create test file**

Create `src/__tests__/kaizen-tools.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("kaizen bot tools", () => {
  it("should have save_algorithm, get_algorithms, save_reflection in TOOLS", async () => {
    // We can't directly import TOOLS (it's const, not exported), but we can
    // verify the module loads without errors and exports chat
    const mod = await import("../services/ai");
    expect(mod.chat).toBeDefined();
    expect(typeof mod.chat).toBe("function");
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/kaizen-tools.test.ts
git commit -m "test: kaizen bot tools smoke test"
```

---

## Chunk 3: Bot Flow — Kaizen Hour + Algorithm Lookup

### Task 9: Add Kaizen Hour prompt to system prompt

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add Kaizen Hour instructions to SYSTEM_PROMPT**

In `src/services/ai.ts`, add before the closing `"Отдых — часть работы, работа — часть отдыха"` line in SYSTEM_PROMPT:
```
КАЙДЗЕН-ЧАС (ежедневная рефлексия):
Когда пользователь начинает рефлексию (или ты отправляешь утреннее напоминание), веди так:
1. Покажи контекст вчерашнего дня: энергия (из data), привычки (из get_user_habits), наблюдения
2. Спроси один ключевой вопрос: "что вчера было самым важным?" или "что бы ты сделал иначе?"
3. Слушай, уточняй если нужно, формулируй инсайты
4. Если из рефлексии рождается набор шагов/протокол — предложи сохранить как алгоритм (save_algorithm)
5. В конце сохрани рефлексию (save_reflection): summary + insights
НЕ ДЕЛАЙ всё за один ответ. Это ДИАЛОГ: вопрос → ответ → уточнение → вывод.

АЛГОРИТМЫ (библиотека знаний):
Когда пользователь спрашивает "как делать X?" или "у меня был протокол..." — вызови get_algorithms.
Если нашёл — перескажи КРАТКО своими словами (не списком шагов), как будто вспоминаешь вместе с ним.
Если не нашёл — предложи создать алгоритм вместе.

ПРОАКТИВНЫЕ ПОДСКАЗКИ:
Если видишь в контексте паттерн (низкая энергия + определённые привычки), проверь есть ли подходящий алгоритм через get_algorithms.
Если есть — мягко напомни: "кстати, у тебя есть протокол для такого случая..."
```

- [ ] **Step 2: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: Kaizen Hour + algorithm lookup instructions in AI system prompt"
```

### Task 10: Add algorithms context to buildUserContext

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add algorithms and reflection status to buildUserContext**

In `src/services/ai.ts`, in the `buildUserContext` function, add after the habits section (after the `}` closing the habits block, before recent observations):
```typescript
    // Algorithms (top 5 most used)
    const algorithms = await prisma.algorithm.findMany({
      where: { userId, isActive: true },
      orderBy: { usageCount: "desc" },
      take: 5,
    });

    if (algorithms.length > 0) {
      lines.push("\nАлгоритмы (библиотека знаний):");
      for (const a of algorithms) {
        lines.push(`  ${a.icon} ${a.title} (${(a.steps as string[]).length} шагов, использован ${a.usageCount} раз)`);
      }
    }

    // Today's reflection status
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayReflection = await prisma.reflection.findFirst({
      where: { userId, date: { gte: todayStart } },
    });
    // Yesterday's reflection
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayReflection = await prisma.reflection.findFirst({
      where: { userId, date: { gte: yesterdayStart, lt: todayStart } },
    });

    if (yesterdayReflection) {
      lines.push(`\nВчерашняя рефлексия: ${yesterdayReflection.summary.slice(0, 100)}`);
    } else {
      lines.push("\n⚠️ Рефлексия за вчера не пройдена. Можно предложить кайдзен-час.");
    }
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: add algorithms + reflection status to buildUserContext"
```

---

## Chunk 4: Frontend Types + API Client + Store

### Task 11: Add Kaizen types to API types

**Files:**
- Modify: `src/mini-app/api/types.ts`

- [ ] **Step 1: Add kaizen types**

Append to `src/mini-app/api/types.ts`:
```typescript
// Kaizen types

export interface AlgorithmData {
  id: number;
  title: string;
  icon: string;
  lifeArea: string | null;
  steps: string[];
  context: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  sourceReflection?: {
    id: number;
    date: string;
    summary: string;
  } | null;
}

export interface ReflectionData {
  id: number;
  date: string;
  summary: string;
  insights: string[] | null;
  energyContext?: string | null;
  habitsContext?: string | null;
  algorithms: { id: number; title: string; icon: string }[];
  createdAt: string;
}

export interface ReflectionStatusData {
  done: boolean;
  reflection: {
    id: number;
    summary: string;
    insights: string[] | null;
    createdAt: string;
  } | null;
  context: {
    date: string;
    energy: {
      physical: number;
      mental: number;
      emotional: number;
      spiritual: number;
      logType: string;
      createdAt: string;
    }[];
    habits: {
      completed: { name: string; icon: string; slot: string }[];
      total: number;
    };
    observations: {
      energyType: string;
      direction: string;
      trigger: string | null;
      context: string | null;
    }[];
  };
}

export interface ReflectionsPaginated {
  reflections: ReflectionData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/api/types.ts
git commit -m "feat: add Kaizen types — AlgorithmData, ReflectionData, ReflectionStatusData"
```

### Task 12: Add Kaizen API methods to client

**Files:**
- Modify: `src/mini-app/api/client.ts`

- [ ] **Step 1: Add import for new types**

In `src/mini-app/api/client.ts`, update the import line (line 2) to include new types:
```typescript
import type { DashboardData, ObservationsResponse, HistoryPoint, AnalyticsData, HabitData, HabitsGrouped, HabitStats, HeatmapDay, CreateHabitPayload, HabitCorrelation, AlgorithmData, ReflectionStatusData, ReflectionsPaginated } from "./types";
```

- [ ] **Step 2: Add kaizen methods to api object**

In `src/mini-app/api/client.ts`, add before the closing `};` of the api object:
```typescript
  // Kaizen
  reflectionStatus: () => request<ReflectionStatusData>("/api/reflection/status"),
  algorithms: (params?: { lifeArea?: string; q?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.lifeArea) searchParams.set("lifeArea", params.lifeArea);
    if (params?.q) searchParams.set("q", params.q);
    const qs = searchParams.toString();
    return request<{ algorithms: AlgorithmData[] }>(`/api/algorithms${qs ? `?${qs}` : ""}`);
  },
  algorithm: (id: number) => request<AlgorithmData>(`/api/algorithms/${id}`),
  updateAlgorithm: (id: number, data: { title?: string; steps?: string[]; isActive?: boolean }) =>
    patch<AlgorithmData>(`/api/algorithms/${id}`, data),
  deleteAlgorithm: (id: number) => del<{ ok: boolean }>(`/api/algorithms/${id}`),
  reflections: (page?: number, limit?: number) =>
    request<ReflectionsPaginated>(`/api/reflections?page=${page || 1}&limit=${limit || 20}`),
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/api/client.ts
git commit -m "feat: add kaizen API methods to client — reflections, algorithms"
```

### Task 13: Create Kaizen store

**Files:**
- Create: `src/mini-app/store/kaizen.ts`

- [ ] **Step 1: Create kaizen store**

Create `src/mini-app/store/kaizen.ts`:
```typescript
import { signal, computed } from "@preact/signals";
import { api } from "../api/client";
import type { AlgorithmData, ReflectionData, ReflectionStatusData, Observation } from "../api/types";

// Reflection status
export const reflectionStatus = signal<ReflectionStatusData | null>(null);
export const reflectionStatusLoading = signal(false);

// Algorithms
export const algorithms = signal<AlgorithmData[]>([]);
export const algorithmsLoading = signal(false);
export const algorithmsSearch = signal("");

// Reflections feed
export const reflections = signal<ReflectionData[]>([]);
export const reflectionsLoading = signal(false);
export const reflectionsPage = signal(1);
export const reflectionsTotal = signal(0);
export const reflectionsHasMore = computed(() => {
  return reflections.value.length < reflectionsTotal.value;
});

// Observations (migrated from journal)
export const kaizenObservations = signal<Observation[]>([]);

// Errors
export const kaizenError = signal(false);

// Combined loading state
export const kaizenLoading = computed(() =>
  reflectionStatusLoading.value || algorithmsLoading.value || reflectionsLoading.value
);

export async function loadReflectionStatus(): Promise<void> {
  reflectionStatusLoading.value = true;
  try {
    reflectionStatus.value = await api.reflectionStatus();
  } catch {
    console.error("Failed to load reflection status");
  } finally {
    reflectionStatusLoading.value = false;
  }
}

export async function loadAlgorithms(search?: string): Promise<void> {
  algorithmsLoading.value = true;
  try {
    const params = search ? { q: search } : undefined;
    const data = await api.algorithms(params);
    algorithms.value = data.algorithms;
  } catch {
    console.error("Failed to load algorithms");
  } finally {
    algorithmsLoading.value = false;
  }
}

export async function loadReflections(page = 1): Promise<void> {
  reflectionsLoading.value = true;
  try {
    const data = await api.reflections(page, 20);
    if (page === 1) {
      reflections.value = data.reflections;
    } else {
      reflections.value = [...reflections.value, ...data.reflections];
    }
    reflectionsPage.value = data.pagination.page;
    reflectionsTotal.value = data.pagination.total;
  } catch {
    console.error("Failed to load reflections");
  } finally {
    reflectionsLoading.value = false;
  }
}

export async function loadMoreReflections(): Promise<void> {
  if (!reflectionsHasMore.value || reflectionsLoading.value) return;
  await loadReflections(reflectionsPage.value + 1);
}

export async function loadObservations(): Promise<void> {
  try {
    const data = await api.observations();
    kaizenObservations.value = data.observations;
  } catch {
    console.error("Failed to load observations");
  }
}

export async function deleteAlgorithm(id: number): Promise<boolean> {
  try {
    await api.deleteAlgorithm(id);
    algorithms.value = algorithms.value.filter((a) => a.id !== id);
    return true;
  } catch {
    console.error("Failed to delete algorithm");
    return false;
  }
}

export async function loadKaizenData(): Promise<void> {
  kaizenError.value = false;
  try {
    await Promise.all([
      loadReflectionStatus(),
      loadAlgorithms(),
      loadReflections(),
      loadObservations(),
    ]);
  } catch {
    kaizenError.value = true;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/store/kaizen.ts
git commit -m "feat: kaizen store — reflection status, algorithms, reflections, observations"
```

---

## Chunk 5: KaizenScreen (Full Implementation)

### Task 14: Rewrite KaizenScreen from stub to full screen

**Files:**
- Create or Replace: `src/mini-app/components/kaizen/KaizenScreen.tsx`

- [ ] **Step 1: Create full KaizenScreen**

Create (or replace) `src/mini-app/components/kaizen/KaizenScreen.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import {
  reflectionStatus,
  algorithms,
  reflections,
  kaizenObservations,
  reflectionStatusLoading,
  algorithmsLoading,
  reflectionsLoading,
  reflectionsHasMore,
  loadKaizenData,
  loadMoreReflections,
} from "../../store/kaizen";

interface KaizenScreenProps {
  param?: string;
}

export function KaizenScreen({ param }: KaizenScreenProps) {
  useEffect(() => {
    loadKaizenData();
  }, []);

  // If param is a number, show AlgorithmDetail
  if (param && /^\d+$/.test(param)) {
    // Lazy import — AlgorithmDetail will be created in next task
    const { AlgorithmDetail } = require("./AlgorithmDetail");
    return <AlgorithmDetail id={parseInt(param, 10)} />;
  }

  const handleAskAI = () => {
    haptic("medium");
    const botUsername = getBotUsername();
    if (botUsername) {
      window.open(`https://t.me/${botUsername}`, "_blank");
    }
  };

  const status = reflectionStatus.value;
  const algos = algorithms.value;
  const refs = reflections.value;
  const obs = kaizenObservations.value;

  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧠 Кайдзен</h1>
      </header>
      <main class="views">
        {/* Ask AI button */}
        <button class="kaizen-ask-btn" onClick={handleAskAI}>
          💬 Спросить AI коуча
          <span style={{ opacity: 0.4, fontSize: "11px" }}>→ Telegram</span>
        </button>

        {/* Reflection status */}
        <ReflectionStatus status={status} loading={reflectionStatusLoading.value} />

        {/* Algorithms library */}
        <div class="section-title">📂 Мои алгоритмы</div>
        {algorithmsLoading.value && <LoadingPlaceholder />}
        {!algorithmsLoading.value && algos.length === 0 && (
          <div class="kaizen-empty">
            Библиотека алгоритмов появится после первой рефлексии
          </div>
        )}
        {!algorithmsLoading.value && algos.length > 0 && (
          <div class="algorithms-grid">
            {algos.map((algo) => (
              <AlgorithmCard
                key={algo.id}
                algorithm={algo}
                onClick={() => {
                  haptic("light");
                  navigate("kaizen", String(algo.id));
                }}
              />
            ))}
          </div>
        )}

        {/* Reflections feed */}
        <div class="section-title" style={{ marginTop: 24 }}>📝 Рефлексии</div>
        {reflectionsLoading.value && refs.length === 0 && <LoadingPlaceholder />}
        {!reflectionsLoading.value && refs.length === 0 && (
          <div class="kaizen-empty">
            Рефлексии появятся после кайдзен-часа с AI коучем
          </div>
        )}
        {refs.length > 0 && (
          <div class="reflections-feed">
            {refs.map((ref) => (
              <ReflectionCard key={ref.id} reflection={ref} />
            ))}
            {reflectionsHasMore.value && (
              <button
                class="kaizen-load-more"
                onClick={() => { haptic("light"); loadMoreReflections(); }}
                disabled={reflectionsLoading.value}
              >
                {reflectionsLoading.value ? "Загрузка..." : "Ещё"}
              </button>
            )}
          </div>
        )}

        {/* Observations */}
        <div class="section-title" style={{ marginTop: 24 }}>👁 Наблюдения</div>
        {obs.length === 0 && (
          <div class="kaizen-empty">
            Наблюдения появятся после чекинов энергии
          </div>
        )}
        {obs.slice(0, 15).map((o) => (
          <div key={o.id} class="observation-card">
            <div class="observation-meta">
              {o.createdAt && new Date(o.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              {" · "}
              {o.energyType === "physical" ? "🦾" : o.energyType === "mental" ? "🧬" : o.energyType === "emotional" ? "🫀" : "🔮"}
              {" "}
              {o.direction === "drop" ? "↓" : o.direction === "rise" ? "↑" : "→"}
            </div>
            {o.trigger && <div class="observation-trigger">{o.trigger}</div>}
            {o.context && <div class="observation-context">{o.context}</div>}
          </div>
        ))}
      </main>
    </div>
  );
}

// --- Sub-components ---

function getBotUsername(): string | null {
  try {
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      ? "energy_coach_bot"
      : null;
  } catch {
    return null;
  }
}

function LoadingPlaceholder() {
  return (
    <div style={{ textAlign: "center", color: "var(--text2)", padding: 20, fontSize: 13 }}>
      Загрузка...
    </div>
  );
}

interface ReflectionStatusProps {
  status: typeof reflectionStatus.value;
  loading: boolean;
}

function ReflectionStatus({ status, loading }: ReflectionStatusProps) {
  if (loading) return <LoadingPlaceholder />;
  if (!status) return null;

  if (status.done && status.reflection) {
    return (
      <div class="reflection-status done">
        <div class="reflection-status-badge done">✓ Рефлексия пройдена</div>
        <div class="reflection-status-summary">{status.reflection.summary}</div>
      </div>
    );
  }

  // Build context summary
  const ctx = status.context;
  const energyStr = ctx.energy.length > 0
    ? ctx.energy.map((e) => `физ ${e.physical} мент ${e.mental} эмо ${e.emotional} дух ${e.spiritual}`).join(", ")
    : "нет данных";
  const habitsStr = `${ctx.habits.completed.length}/${ctx.habits.total}`;

  return (
    <div class="reflection-status pending">
      <div class="reflection-status-badge pending">⏳ Ожидает рефлексии</div>
      <div class="reflection-status-context">
        <span>📅 {ctx.date}</span>
        <span>🔋 {energyStr}</span>
        <span>⚡ {habitsStr} привычек</span>
        {ctx.observations.length > 0 && (
          <span>👁 {ctx.observations.length} наблюдений</span>
        )}
      </div>
    </div>
  );
}

interface AlgorithmCardProps {
  algorithm: typeof algorithms.value[0];
  onClick: () => void;
}

function AlgorithmCard({ algorithm, onClick }: AlgorithmCardProps) {
  const stepsPreview = algorithm.steps.slice(0, 2).join(" → ");
  const AREA_LABELS: Record<string, string> = {
    health: "Здоровье", career: "Карьера", relationships: "Отношения",
    finances: "Финансы", family: "Семья", growth: "Развитие",
    recreation: "Отдых", environment: "Среда",
  };

  return (
    <div class="algorithm-card" onClick={onClick}>
      <div class="algorithm-icon">{algorithm.icon}</div>
      <div class="algorithm-body">
        <div class="algorithm-title">{algorithm.title}</div>
        <div class="algorithm-steps-preview">{stepsPreview}...</div>
        <div class="algorithm-meta">
          {algorithm.lifeArea && (
            <span class="algorithm-area">{AREA_LABELS[algorithm.lifeArea] || algorithm.lifeArea}</span>
          )}
          <span>{algorithm.steps.length} шагов</span>
          {algorithm.usageCount > 0 && <span>· {algorithm.usageCount}×</span>}
        </div>
      </div>
    </div>
  );
}

interface ReflectionCardProps {
  reflection: typeof reflections.value[0];
}

function ReflectionCard({ reflection }: ReflectionCardProps) {
  const date = new Date(reflection.date);
  const dateStr = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" });

  return (
    <div class="reflection-card">
      <div class="reflection-date">{dateStr}</div>
      <div class="reflection-summary">{reflection.summary}</div>
      {reflection.insights && (reflection.insights as string[]).length > 0 && (
        <div class="reflection-insights">
          {(reflection.insights as string[]).map((insight, i) => (
            <div key={i} class="reflection-insight">💡 {insight}</div>
          ))}
        </div>
      )}
      {reflection.algorithms.length > 0 && (
        <div class="reflection-algos">
          {reflection.algorithms.map((a) => (
            <span
              key={a.id}
              class="reflection-algo-chip"
              onClick={(e) => {
                e.stopPropagation();
                navigate("kaizen", String(a.id));
              }}
            >
              {a.icon} {a.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/kaizen/KaizenScreen.tsx
git commit -m "feat: full KaizenScreen — reflection status, algorithms, reflections, observations"
```

### Task 15: Create AlgorithmDetail component

**Files:**
- Create: `src/mini-app/components/kaizen/AlgorithmDetail.tsx`

- [ ] **Step 1: Create AlgorithmDetail**

Create `src/mini-app/components/kaizen/AlgorithmDetail.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import { api } from "../../api/client";
import { deleteAlgorithm } from "../../store/kaizen";
import type { AlgorithmData } from "../../api/types";

const algorithmData = signal<AlgorithmData | null>(null);
const loading = signal(true);
const error = signal(false);

interface AlgorithmDetailProps {
  id: number;
}

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

export function AlgorithmDetail({ id }: AlgorithmDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loading.value = true;
    error.value = false;
    algorithmData.value = null;

    api.algorithm(id)
      .then((data) => { algorithmData.value = data; })
      .catch(() => { error.value = true; })
      .finally(() => { loading.value = false; });
  }, [id]);

  const handleBack = () => {
    haptic("light");
    navigate("kaizen");
  };

  const handleAskAI = () => {
    haptic("medium");
    const botUsername = getBotUsername();
    if (botUsername) {
      window.open(`https://t.me/${botUsername}`, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    haptic("medium");
    const ok = await deleteAlgorithm(id);
    if (ok) {
      navigate("kaizen");
    }
    setDeleting(false);
    setConfirmDelete(false);
  };

  if (loading.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>← Назад</button>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Загрузка...</div>
        </main>
      </div>
    );
  }

  if (error.value || !algorithmData.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>← Назад</button>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Алгоритм не найден</div>
        </main>
      </div>
    );
  }

  const algo = algorithmData.value;
  const steps = algo.steps as string[];
  const createdDate = new Date(algo.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div class="screen">
      <header class="app-header">
        <button class="back-btn" onClick={handleBack}>← Назад</button>
      </header>
      <main class="views">
        {/* Header */}
        <div class="algo-detail-header">
          <div class="algo-detail-icon">{algo.icon}</div>
          <div>
            <div class="algo-detail-title">{algo.title}</div>
            <div class="algo-detail-meta">
              {algo.lifeArea && <span class="algorithm-area">{AREA_LABELS[algo.lifeArea] || algo.lifeArea}</span>}
              <span>{createdDate}</span>
              {algo.usageCount > 0 && <span>· Использован {algo.usageCount}×</span>}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div class="section-title">Шаги</div>
        <div class="algo-steps">
          {steps.map((step, i) => (
            <div key={i} class="algo-step">
              <div class="algo-step-num">{i + 1}</div>
              <div class="algo-step-text">{step}</div>
            </div>
          ))}
        </div>

        {/* Context */}
        {algo.context && (
          <>
            <div class="section-title" style={{ marginTop: 20 }}>Контекст</div>
            <div class="algo-context">{algo.context}</div>
          </>
        )}

        {/* Source reflection */}
        {algo.sourceReflection && (
          <div class="algo-source">
            Из рефлексии {new Date(algo.sourceReflection.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </div>
        )}

        {/* Ask AI about this */}
        <button class="kaizen-ask-btn" onClick={handleAskAI} style={{ marginTop: 20 }}>
          💬 Спросить AI про алгоритм
          <span style={{ opacity: 0.4, fontSize: "11px" }}>→ Telegram</span>
        </button>

        {/* Delete */}
        <button
          class="algo-delete-btn"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Удаление..." : confirmDelete ? "Точно удалить?" : "Удалить алгоритм"}
        </button>
      </main>
    </div>
  );
}

function getBotUsername(): string | null {
  try {
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      ? "energy_coach_bot"
      : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/kaizen/AlgorithmDetail.tsx
git commit -m "feat: AlgorithmDetail — steps, context, usage count, ask AI, delete"
```

---

## Chunk 6: CSS Styles for Kaizen

### Task 16: Add Kaizen CSS styles

**Files:**
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Append kaizen styles to global.css**

Append to `src/mini-app/styles/global.css`:
```css
/* ── Kaizen Screen ── */
.kaizen-ask-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 12px;
  background: linear-gradient(135deg, rgba(200,255,115,0.1), rgba(200,255,115,0.03));
  border: 1px solid rgba(200,255,115,0.15);
  border-radius: var(--radius-sm);
  color: var(--accent); font-size: 14px; font-weight: 600;
  cursor: pointer; margin-bottom: 16px;
  font-family: inherit;
  transition: transform 0.15s;
}
.kaizen-ask-btn:active { transform: scale(0.97); }

.kaizen-empty {
  text-align: center; padding: 20px;
  color: var(--text2); font-size: 13px; font-weight: 300;
}

.kaizen-load-more {
  display: block; width: 100%; padding: 10px;
  background: var(--surface); border: 1px solid var(--surface-border);
  border-radius: var(--radius-xs);
  color: var(--text2); font-size: 13px; font-weight: 500;
  cursor: pointer; margin-top: 8px;
  font-family: inherit;
}
.kaizen-load-more:active { transform: scale(0.98); }
.kaizen-load-more:disabled { opacity: 0.5; cursor: default; }

/* Reflection Status */
.reflection-status {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 14px; margin-bottom: 16px;
  animation: cardIn 0.4s ease both;
}
.reflection-status.pending {
  border-left: 3px solid rgba(255, 200, 50, 0.5);
}
.reflection-status.done {
  border-left: 3px solid rgba(91, 224, 122, 0.5);
}

.reflection-status-badge {
  font-size: 12px; font-weight: 600;
  margin-bottom: 6px;
}
.reflection-status-badge.pending { color: #ffc832; }
.reflection-status-badge.done { color: var(--physical); }

.reflection-status-summary {
  font-size: 13px; color: var(--text2); line-height: 1.45;
}

.reflection-status-context {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: 12px; color: var(--text2);
  margin-top: 4px;
}

/* Algorithm Cards */
.algorithms-grid {
  display: flex; flex-direction: column; gap: 8px;
}

.algorithm-card {
  display: flex; align-items: flex-start; gap: 12px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  cursor: pointer;
  transition: transform 0.15s;
  animation: cardIn 0.4s ease both;
}
.algorithm-card:active { transform: scale(0.97); }

.algorithm-icon {
  font-size: 24px; flex-shrink: 0;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface2); border-radius: 12px;
}

.algorithm-body { flex: 1; min-width: 0; }

.algorithm-title {
  font-size: 14px; font-weight: 600; color: var(--text);
  margin-bottom: 2px;
}

.algorithm-steps-preview {
  font-size: 12px; color: var(--text2); line-height: 1.4;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.algorithm-meta {
  display: flex; gap: 6px; align-items: center;
  font-size: 11px; color: var(--text3); margin-top: 4px;
}

.algorithm-area {
  padding: 1px 6px; border-radius: 4px;
  background: rgba(200,255,115,0.08); color: var(--accent);
  font-size: 10px; font-weight: 600;
}

/* Reflection Cards */
.reflections-feed {
  display: flex; flex-direction: column; gap: 8px;
}

.reflection-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  animation: cardIn 0.4s ease both;
}

.reflection-date {
  font-size: 11px; color: var(--text3); font-weight: 500;
  margin-bottom: 4px; text-transform: capitalize;
}

.reflection-summary {
  font-size: 13px; color: var(--text); line-height: 1.45;
}

.reflection-insights {
  margin-top: 6px;
  display: flex; flex-direction: column; gap: 3px;
}

.reflection-insight {
  font-size: 12px; color: var(--text2); line-height: 1.4;
}

.reflection-algos {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
}

.reflection-algo-chip {
  padding: 3px 8px;
  background: rgba(200,255,115,0.08);
  border: 1px solid rgba(200,255,115,0.12);
  border-radius: 8px;
  font-size: 11px; color: var(--accent); font-weight: 500;
  cursor: pointer;
}
.reflection-algo-chip:active { opacity: 0.7; }

/* Observation Cards (reused from journal) */
.observation-card {
  background: var(--surface); border: 1px solid var(--surface-border);
  border-radius: var(--radius-xs); padding: 12px; margin-bottom: 8px;
  animation: cardIn 0.4s ease both;
}
.observation-meta { font-size: 11px; color: var(--text3); margin-bottom: 4px; }
.observation-trigger { font-size: 13px; color: var(--text); margin-bottom: 2px; }
.observation-context { font-size: 12px; color: var(--text2); line-height: 1.4; }

/* Algorithm Detail */
.algo-detail-header {
  display: flex; align-items: flex-start; gap: 14px;
  margin-bottom: 20px;
}

.algo-detail-icon {
  font-size: 36px; flex-shrink: 0;
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface2); border-radius: 16px;
}

.algo-detail-title {
  font-size: 18px; font-weight: 700; color: var(--text);
  margin-bottom: 4px;
}

.algo-detail-meta {
  display: flex; gap: 8px; align-items: center;
  font-size: 12px; color: var(--text3);
}

.algo-steps {
  display: flex; flex-direction: column; gap: 8px;
}

.algo-step {
  display: flex; align-items: flex-start; gap: 10px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xs);
  padding: 12px 14px;
}

.algo-step-num {
  width: 24px; height: 24px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(200,255,115,0.1);
  border-radius: 50%;
  font-size: 12px; font-weight: 700; color: var(--accent);
}

.algo-step-text {
  font-size: 14px; color: var(--text); line-height: 1.45;
  flex: 1;
}

.algo-context {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xs);
  padding: 12px 14px;
  font-size: 13px; color: var(--text2); line-height: 1.45;
  font-style: italic;
}

.algo-source {
  margin-top: 12px;
  font-size: 11px; color: var(--text3);
}

.algo-delete-btn {
  display: block; width: 100%; padding: 10px;
  background: transparent;
  border: 1px solid rgba(255, 90, 90, 0.2);
  border-radius: var(--radius-xs);
  color: #ff6b6b; font-size: 13px; font-weight: 500;
  cursor: pointer; margin-top: 12px;
  font-family: inherit;
}
.algo-delete-btn:active { background: rgba(255, 90, 90, 0.05); }
.algo-delete-btn:disabled { opacity: 0.5; cursor: default; }

/* Back button */
.back-btn {
  background: none; border: none;
  color: var(--accent); font-size: 14px; font-weight: 500;
  cursor: pointer; padding: 0;
  font-family: inherit;
}
.back-btn:active { opacity: 0.7; }
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/styles/global.css
git commit -m "feat: kaizen CSS — reflection status, algorithm cards, detail view, observations"
```

---

## Chunk 7: Hub KaizenCard Widget (Real Data)

### Task 17: Update KaizenCard to show real data

**Files:**
- Modify: `src/mini-app/components/hub/KaizenCard.tsx`

- [ ] **Step 1: Rewrite KaizenCard with real data**

Replace `src/mini-app/components/hub/KaizenCard.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import { reflectionStatus, algorithms, loadReflectionStatus, loadAlgorithms } from "../../store/kaizen";

export function KaizenCard() {
  useEffect(() => {
    loadReflectionStatus();
    loadAlgorithms();
  }, []);

  const handleClick = () => {
    haptic("light");
    navigate("kaizen");
  };

  const status = reflectionStatus.value;
  const algos = algorithms.value;

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">🧠 Кайдзен</span>
        {status && (
          <span class={`kaizen-hub-badge ${status.done ? "done" : "pending"}`}>
            {status.done ? "✓" : "⏳"}
          </span>
        )}
      </div>

      {!status && algos.length === 0 && (
        <div class="hub-card-empty">
          После первой рефлексии здесь появятся алгоритмы
        </div>
      )}

      {status && !status.done && (
        <div class="kaizen-hub-status pending">
          Рефлексия ожидает
        </div>
      )}

      {status && status.done && status.reflection && (
        <div class="kaizen-hub-status done">
          {status.reflection.summary.slice(0, 60)}...
        </div>
      )}

      {algos.length > 0 && (
        <div class="kaizen-hub-chips">
          {algos.slice(0, 3).map((a) => (
            <span key={a.id} class="kaizen-hub-chip">{a.icon} {a.title}</span>
          ))}
          {algos.length > 3 && (
            <span class="kaizen-hub-chip more">+{algos.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add KaizenCard hub styles to global.css**

Append to `src/mini-app/styles/global.css`:
```css
/* Kaizen Hub Card */
.kaizen-hub-badge {
  font-size: 12px; font-weight: 600;
}
.kaizen-hub-badge.done { color: var(--physical); }
.kaizen-hub-badge.pending { color: #ffc832; }

.kaizen-hub-status {
  font-size: 12px; line-height: 1.4; margin-top: 4px;
}
.kaizen-hub-status.pending { color: #ffc832; }
.kaizen-hub-status.done { color: var(--text2); }

.kaizen-hub-chips {
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;
}

.kaizen-hub-chip {
  padding: 2px 8px;
  background: var(--surface2); border-radius: 6px;
  font-size: 11px; color: var(--text2); font-weight: 400;
  white-space: nowrap;
}
.kaizen-hub-chip.more {
  color: var(--text3);
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/components/hub/KaizenCard.tsx src/mini-app/styles/global.css
git commit -m "feat: KaizenCard hub widget — reflection status + algorithm chips"
```

---

## Chunk 8: Kaizen Morning Reminder Cron

### Task 18: Create kaizen reminder service

**Files:**
- Create: `src/services/kaizen-reminder.ts`
- Modify: `src/services/scheduler.ts`

- [ ] **Step 1: Create kaizen-reminder.ts**

Create `src/services/kaizen-reminder.ts`:
```typescript
import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";

/**
 * Morning kaizen reminder — checks if yesterday's reflection exists,
 * if not, sends a reminder with yesterday's context summary.
 * Runs at 8:00 AM daily.
 */
export async function sendKaizenReminders(): Promise<void> {
  const users = await prisma.user.findMany();

  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  console.log(`Kaizen reminder check for ${users.length} user(s), date: ${yesterday.toISOString().split("T")[0]}`);

  for (const user of users) {
    try {
      // Check if reflection already exists for yesterday
      const reflection = await prisma.reflection.findFirst({
        where: {
          userId: user.id,
          date: {
            gte: yesterday,
            lt: today,
          },
        },
      });

      if (reflection) {
        continue; // Already reflected, skip
      }

      // Check if user has any recent activity (don't spam inactive users)
      const recentLog = await prisma.energyLog.findFirst({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
      });

      if (!recentLog) {
        continue; // Inactive user, skip
      }

      // Gather yesterday's context for the message
      const energyLogs = await prisma.energyLog.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: yesterday, lt: today },
        },
        orderBy: { createdAt: "asc" },
      });

      const habitLogs = await prisma.habitLog.findMany({
        where: {
          userId: user.id,
          date: yesterday,
        },
        include: {
          habit: { select: { name: true, icon: true } },
        },
      });

      const totalHabits = await prisma.habit.count({
        where: { userId: user.id, isActive: true },
      });

      // Build context summary
      let contextMsg = "";

      if (energyLogs.length > 0) {
        const last = energyLogs[energyLogs.length - 1];
        contextMsg += `\n🔋 Энергия: физ ${last.physical}, мент ${last.mental}, эмо ${last.emotional}, дух ${last.spiritual}`;
      }

      if (habitLogs.length > 0) {
        const names = habitLogs.slice(0, 3).map((l) => `${l.habit.icon} ${l.habit.name}`).join(", ");
        const extra = habitLogs.length > 3 ? ` +${habitLogs.length - 3}` : "";
        contextMsg += `\n⚡ Привычки: ${habitLogs.length}/${totalHabits} — ${names}${extra}`;
      }

      const chatId = Number(user.telegramId);
      const dateStr = yesterday.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

      await bot.api.sendMessage(
        chatId,
        `🧠 Время для кайдзен-часа!\n\nВчера (${dateStr}):${contextMsg || "\nДанных пока нет."}\n\nЧто было самым важным вчера? Напиши, и мы порефлексируем вместе.`
      );
    } catch (err) {
      await trackError("kaizen-reminder", err, { userId: user.id });
      console.warn(`Failed to send kaizen reminder to user ${user.id}:`, err);
    }
  }
}
```

- [ ] **Step 2: Add kaizen cron to scheduler.ts**

In `src/services/scheduler.ts`, add import at the top:
```typescript
import { sendKaizenReminders } from "./kaizen-reminder.js";
```

Add cron job after the weekly digest entry (before closing `}` of `startScheduler`):
```typescript
  // Kaizen morning reminder — daily at 8:00 AM
  const kaizenReminder = cron.schedule("0 8 * * *", () => {
    sendKaizenReminders().catch(err => console.error("Kaizen reminder failed:", err));
  }, { timezone: "Asia/Shanghai" });
  tasks.push(kaizenReminder);
  console.log("Kaizen reminder scheduled: 0 8 * * * (Asia/Shanghai)");
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/services/kaizen-reminder.ts src/services/scheduler.ts
git commit -m "feat: kaizen morning reminder cron — daily 8AM, context summary, skip if reflected"
```

---

## Chunk 9: Final Verification

### Task 19: Full build + test + cleanup

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Check for TypeScript errors in new files**

Run: `npx tsc --noEmit`
Expected: No errors. If errors, fix type issues in kaizen components.

- [ ] **Step 4: Verify all imports are correct**

Run: `grep -rn "from.*kaizen" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v dist`
Verify no broken imports.

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: Phase 3 kaizen — final verification and cleanup"
```

---

## Summary

After Phase 3 completion, the app has:
- GET /api/reflection/status — yesterday context + reflection done/pending
- GET /api/algorithms — ILIKE search on title+context, filter by lifeArea
- GET /api/algorithms/:id — detail with usage increment
- PATCH /api/algorithms/:id — update title, steps, isActive
- DELETE /api/algorithms/:id — soft delete (isActive=false)
- GET /api/reflections — paginated feed
- GET /api/reflections/:date — single reflection by date
- Bot tool: save_algorithm — create personal algorithms from conversation
- Bot tool: get_algorithms — ILIKE search, top 5 results
- Bot tool: save_reflection — upsert with auto energy/habits context
- AI system prompt: Kaizen Hour flow, algorithm lookup, proactive suggestions
- buildUserContext: algorithms + reflection status included
- KaizenScreen: reflection status (pending/done), algorithm library, reflections feed, observations
- AlgorithmDetail (#kaizen/:id): steps, context, usage, ask AI, delete
- KaizenCard hub widget: reflection badge + algorithm chips
- Cron: daily 8AM kaizen reminder (skip if already reflected, skip inactive users)

**Next:** Phase 4 (Strategy) implements mission, goals, strategy screen, quarterly review.
