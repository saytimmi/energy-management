# Phase 7: Smart Bot Awareness — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bot sees what's empty/stale and organically guides user to fill gaps. Notifications don't spam — they help. Morning messages merge into one brief. All user-facing crons become timezone-aware. Vacation mode pauses everything. Users control notification preferences from Mini App.

**Architecture:** New awareness service detects data gaps. Integrate into buildUserContext(). Merge 3 morning crons into one sendMorningBrief(). Convert hardcoded timezone crons to hourly-poll pattern. Add vacation mode (DB + bot tool + Mini App banner). Settings screen with notification preferences.

**Tech Stack:** Preact + @preact/signals, Express, Prisma, grammy, node-cron, Telegram Mini App SDK

**Spec:** `docs/superpowers/specs/2026-03-24-v2-improvements-design.md` (sections 7.1–7.6)

**Assumes Phase 6 is complete:** in-app energy checkin, balance rate overlay, energy-analysis service, bot username config, data sync, habit card single-tap.

---

## File Structure

### New files:
- `src/services/awareness.ts` — gap detection + prioritization
- `src/services/morning-brief.ts` — merged morning message (habits + kaizen + nudge + awareness)
- `src/api/settings.ts` — GET/PUT /api/settings
- `src/mini-app/components/settings/SettingsScreen.tsx` — notification preferences, vacation, timezone
- `src/mini-app/store/settings.ts` — settings signal store
- `src/__tests__/awareness.test.ts` — tests for awareness service
- `src/__tests__/morning-brief.test.ts` — tests for morning brief
- `src/__tests__/settings-api.test.ts` — tests for settings API
- `src/__tests__/vacation.test.ts` — tests for vacation mode

### Modified files:
- `prisma/schema.prisma` — add vacationUntil, vacationReason, notificationPrefs to User
- `src/services/ai.ts` — add awareness section to buildUserContext(), add set_vacation_mode tool
- `src/services/scheduler.ts` — remove 3 morning crons, add morning brief hourly, convert remaining to hourly-poll
- `src/services/smart-nudges.ts` — export collectNudges for use in morning brief
- `src/services/kaizen-reminder.ts` — export buildKaizenContext for use in morning brief
- `src/services/habit-cron.ts` — export buildRoutineReminderText, make sendRoutineReminders timezone-aware
- `src/services/balance-cron.ts` — make timezone-aware
- `src/services/strategy-cron.ts` — make timezone-aware
- `src/services/weekly-digest.ts` — make timezone-aware
- `src/services/checkin-sender.ts` — add vacation check
- `src/server.ts` — register settings routes
- `src/mini-app/router.ts` — add "settings" route
- `src/mini-app/app.tsx` — add SettingsScreen to route map
- `src/mini-app/api/client.ts` — add settings API methods
- `src/mini-app/api/types.ts` — add settings types
- `src/mini-app/components/hub/Hub.tsx` — add settings gear icon + vacation banner
- `src/mini-app/components/shared/BottomNav.tsx` — (optional) settings access
- `src/mini-app/styles/global.css` — settings screen styles

---

## Task 1: DB Migration — Vacation & Notification Preferences

Add vacationUntil, vacationReason, notificationPrefs to User model.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, add to the User model (after the `updatedAt` field):

```prisma
model User {
  id                Int             @id @default(autoincrement())
  telegramId        BigInt          @unique
  firstName         String
  lastName          String?
  username          String?
  timezone          String          @default("Asia/Shanghai")
  vacationUntil     DateTime?
  vacationReason    String?
  notificationPrefs Json?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  energyLogs        EnergyLog[]
  messages          Message[]
  sessions          Session[]
  observations      Observation[]
  habits            Habit[]
  habitLogs         HabitLog[]
  balanceRatings    BalanceRating[]
  mission           Mission?
  balanceGoals      BalanceGoal[]
  goals             Goal[]
  algorithms        Algorithm[]
  reflections       Reflection[]
}
```

- [ ] **Step 2: Generate and run migration**

```bash
npx prisma migrate dev --name add-vacation-and-notification-prefs
```

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add vacationUntil, vacationReason, notificationPrefs to User"
```

---

## Task 2: Awareness Service

Detect what's empty/stale for a user, return prioritized list of gaps.

**Files:**
- Create: `src/__tests__/awareness.test.ts`
- Create: `src/services/awareness.ts`

- [ ] **Step 1: Write tests for awareness service**

Create `src/__tests__/awareness.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  default: {
    energyLog: { findFirst: vi.fn(), count: vi.fn() },
    habit: { findMany: vi.fn(), count: vi.fn() },
    balanceRating: { findFirst: vi.fn() },
    mission: { findUnique: vi.fn() },
    goal: { findMany: vi.fn() },
    balanceGoal: { findMany: vi.fn() },
    reflection: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from "../db.js";
import { getAwarenessGaps, type AwarenessGap } from "../services/awareness.js";

describe("awareness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: everything empty
    (prisma.energyLog.findFirst as any).mockResolvedValue(null);
    (prisma.energyLog.count as any).mockResolvedValue(0);
    (prisma.habit.findMany as any).mockResolvedValue([]);
    (prisma.habit.count as any).mockResolvedValue(0);
    (prisma.balanceRating.findFirst as any).mockResolvedValue(null);
    (prisma.mission.findUnique as any).mockResolvedValue(null);
    (prisma.goal.findMany as any).mockResolvedValue([]);
    (prisma.balanceGoal.findMany as any).mockResolvedValue([]);
    (prisma.reflection.findFirst as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue({ id: 1, createdAt: new Date() });
  });

  it("detects no_energy gap when no energy logs exist", async () => {
    const gaps = await getAwarenessGaps(1);
    const noEnergy = gaps.find(g => g.type === "no_energy");
    expect(noEnergy).toBeDefined();
    expect(noEnergy!.priority).toBe(100);
  });

  it("detects no_habits gap when user has 0 habits", async () => {
    // Has energy but no habits
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(3);
    const gaps = await getAwarenessGaps(1);
    const noHabits = gaps.find(g => g.type === "no_habits");
    expect(noHabits).toBeDefined();
    expect(noHabits!.priority).toBe(90);
  });

  it("detects stale_balance when ratings are older than 14 days", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(5);
    (prisma.habit.count as any).mockResolvedValue(3);
    const staleDate = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000);
    (prisma.balanceRating.findFirst as any).mockResolvedValue({ id: 1, createdAt: staleDate });
    const gaps = await getAwarenessGaps(1);
    const stale = gaps.find(g => g.type === "stale_balance");
    expect(stale).toBeDefined();
    expect(stale!.priority).toBe(70);
  });

  it("detects no_reflection when yesterday has no reflection", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(5);
    (prisma.habit.count as any).mockResolvedValue(3);
    (prisma.balanceRating.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.reflection.findFirst as any).mockResolvedValue(null);
    const gaps = await getAwarenessGaps(1);
    const noRefl = gaps.find(g => g.type === "no_reflection");
    expect(noRefl).toBeDefined();
  });

  it("returns gaps sorted by priority descending", async () => {
    const gaps = await getAwarenessGaps(1);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].priority).toBeGreaterThanOrEqual(gaps[i].priority);
    }
  });

  it("detects empty_meaning when habits have no whyToday", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(5);
    (prisma.habit.count as any).mockResolvedValue(2);
    (prisma.habit.findMany as any).mockResolvedValue([
      { id: 1, name: "Test", whyToday: null, whyIdentity: null, type: "build" },
    ]);
    (prisma.balanceRating.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    const gaps = await getAwarenessGaps(1);
    const empty = gaps.find(g => g.type === "empty_meaning");
    expect(empty).toBeDefined();
  });

  it("detects goal_without_habits", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(5);
    (prisma.habit.count as any).mockResolvedValue(1);
    (prisma.habit.findMany as any).mockResolvedValue([
      { id: 1, name: "Test", lifeArea: "career", whyToday: "x", type: "build" },
    ]);
    (prisma.balanceRating.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.goal.findMany as any).mockResolvedValue([
      { id: 1, lifeArea: "health", title: "Run", status: "active" },
    ]);
    const gaps = await getAwarenessGaps(1);
    const gwh = gaps.find(g => g.type === "goal_without_habits");
    expect(gwh).toBeDefined();
    expect(gwh!.area).toBe("health");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/awareness.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create awareness.ts**

Create `src/services/awareness.ts`:

```typescript
import prisma from "../db.js";

export interface AwarenessGap {
  type:
    | "no_energy"
    | "no_balance"
    | "stale_balance"
    | "no_habits"
    | "no_mission"
    | "no_goals"
    | "no_reflection"
    | "empty_meaning"
    | "no_focus_areas"
    | "goal_without_habits"
    | "low_area_no_goal";
  priority: number;
  area?: string;
  suggestion: string;
  triggerContext?: string;
}

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

/**
 * Analyze user data completeness and return prioritized list of gaps.
 * Rules:
 * - Max 1 gap suggested per conversation
 * - Only suggest when contextually appropriate
 * - Bot remembers what was already suggested (via session)
 */
export async function getAwarenessGaps(userId: number): Promise<AwarenessGap[]> {
  const gaps: AwarenessGap[] = [];

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return gaps;

  const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // 1. no_energy (100) — no checkins ever
  const latestEnergy = await prisma.energyLog.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestEnergy) {
    gaps.push({
      type: "no_energy",
      priority: 100,
      suggestion: "расскажи как ты себя чувствуешь — оценим энергию по 4 параметрам",
      triggerContext: "always",
    });
  }

  // 2. no_habits (90) — 0 habits
  const habitCount = await prisma.habit.count({
    where: { userId, isActive: true },
  });
  if (habitCount === 0 && latestEnergy) {
    gaps.push({
      type: "no_habits",
      priority: 90,
      suggestion: "у тебя пока нет привычек. давай создадим первую — что хочешь делать каждый день?",
      triggerContext: "after_checkin",
    });
  }

  // 3. no_balance (80) — 0 balance ratings, only after 3+ days
  const latestBalance = await prisma.balanceRating.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestBalance && accountAgeDays >= 3) {
    gaps.push({
      type: "no_balance",
      priority: 80,
      suggestion: "ты ещё не оценивал баланс жизни. это 8 быстрых вопросов — даст полную картину",
      triggerContext: "end_of_conversation",
    });
  }

  // 4. stale_balance (70) — ratings older than 14 days
  if (latestBalance) {
    const daysSince = Math.floor((Date.now() - latestBalance.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 14) {
      gaps.push({
        type: "stale_balance",
        priority: 70,
        suggestion: `баланс жизни не обновлялся ${daysSince} дней. обновим? быстро 8 вопросов`,
        triggerContext: "end_of_conversation",
      });
    }
  }

  // 5. no_mission (60) — no mission after 2+ weeks
  const mission = await prisma.mission.findUnique({ where: { userId } });
  if (!mission?.statement && accountAgeDays >= 14) {
    gaps.push({
      type: "no_mission",
      priority: 60,
      suggestion: "у тебя нет сформулированной миссии. это 3 простых вопроса — за 5 минут определим направление",
      triggerContext: "reflection",
    });
  }

  // 6. no_goals (55) — no active goals, after mission or 3+ weeks
  const activeGoals = await prisma.goal.findMany({
    where: { userId, status: "active" },
  });
  if (activeGoals.length === 0 && (mission?.statement || accountAgeDays >= 21)) {
    gaps.push({
      type: "no_goals",
      priority: 55,
      suggestion: "пока нет конкретных целей. давай поставим хотя бы одну на этот квартал?",
      triggerContext: "after_mission",
    });
  }

  // 7. no_reflection — yesterday not reflected
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterdayReflection = await prisma.reflection.findFirst({
    where: { userId, date: { gte: yesterday, lt: today } },
  });
  if (!yesterdayReflection && latestEnergy) {
    gaps.push({
      type: "no_reflection",
      priority: 52,
      suggestion: "рефлексия за вчера не пройдена. расскажи что было самым важным?",
      triggerContext: "morning",
    });
  }

  // 8. empty_meaning (50) — build habits without meaning
  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true },
  });
  const habitsWithoutMeaning = habits.filter(
    h => h.type === "build" && !h.whyToday && !h.whyIdentity
  );
  if (habitsWithoutMeaning.length > 0) {
    const first = habitsWithoutMeaning[0];
    gaps.push({
      type: "empty_meaning",
      priority: 50,
      suggestion: `привычка "${first.name}" без смысла — зачем тебе ${first.name}?`,
      triggerContext: "reflection",
    });
  }

  // 9. goal_without_habits (45) — goal exists but no habits for its lifeArea
  for (const goal of activeGoals) {
    const areaHabits = habits.filter(h => h.lifeArea === goal.lifeArea);
    if (areaHabits.length === 0) {
      const label = AREA_LABELS[goal.lifeArea] || goal.lifeArea;
      gaps.push({
        type: "goal_without_habits",
        priority: 45,
        area: goal.lifeArea,
        suggestion: `цель "${goal.title}" (${label}) есть, но привычек для неё нет. создадим?`,
        triggerContext: "after_goals",
      });
      break; // one per call
    }
  }

  // 10. no_focus_areas (40) — balance rated but no focus chosen
  const balanceGoals = await prisma.balanceGoal.findMany({ where: { userId } });
  const hasFocus = balanceGoals.some(bg => bg.isFocus);
  if (latestBalance && !hasFocus) {
    gaps.push({
      type: "no_focus_areas",
      priority: 40,
      suggestion: "баланс оценён, но фокус-сферы не выбраны. какие 2-3 сферы хочешь подтянуть?",
      triggerContext: "after_balance",
    });
  }

  // 11. low_area_no_goal (35) — area scored <=4 with no goal
  if (latestBalance) {
    const areas = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
    for (const area of areas) {
      const rating = await prisma.balanceRating.findFirst({
        where: { userId, area },
        orderBy: { createdAt: "desc" },
      });
      if (rating && rating.score <= 4) {
        const hasGoal = activeGoals.some(g => g.lifeArea === area);
        if (!hasGoal) {
          const label = AREA_LABELS[area] || area;
          gaps.push({
            type: "low_area_no_goal",
            priority: 35,
            area,
            suggestion: `${label} на ${rating.score}/10 — может поставим цель для улучшения?`,
            triggerContext: "after_balance",
          });
          break; // one per call
        }
      }
    }
  }

  // Sort by priority descending
  gaps.sort((a, b) => b.priority - a.priority);

  return gaps;
}

/**
 * Get top awareness gap formatted for AI context.
 * Returns null if no gaps or user is on vacation.
 */
export async function getAwarenessContext(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Skip if on vacation
  if (user.vacationUntil && user.vacationUntil > new Date()) {
    return null;
  }

  const gaps = await getAwarenessGaps(userId);
  if (gaps.length === 0) return null;

  const lines: string[] = ["ПРОБЕЛЫ В ДАННЫХ (предложи заполнить когда уместно, НЕ в первом сообщении, а в конце разговора или при уместном моменте):"];

  // Show top 3 gaps max
  for (const gap of gaps.slice(0, 3)) {
    lines.push(`- ${gap.suggestion}`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/awareness.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/awareness.ts src/__tests__/awareness.test.ts
git commit -m "feat: awareness service — detect data gaps with prioritization"
```

---

## Task 3: Integrate Awareness into buildUserContext()

Add awareness gaps section to the AI context so the bot knows what to suggest.

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add import for awareness**

In `src/services/ai.ts`, add import at the top (after other service imports):

```typescript
import { getAwarenessContext } from "./awareness.js";
```

- [ ] **Step 2: Add awareness section to buildUserContext()**

In `src/services/ai.ts`, inside `buildUserContext()`, after the "Recent sessions" block (around line 1600, before the `return lines.length > 0` line), add:

```typescript
    // Awareness gaps — what's empty/stale
    try {
      const awarenessContext = await getAwarenessContext(userId);
      if (awarenessContext) {
        lines.push("\n" + awarenessContext);
      }
    } catch {}
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: integrate awareness gaps into buildUserContext()"
```

---

## Task 4: Vacation Mode — Bot Tool

Add set_vacation_mode tool so the bot can pause everything.

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: Add set_vacation_mode tool definition**

In `src/services/ai.ts`, add to the `TOOLS` array (after the `set_timezone` tool definition, around line 145):

```typescript
  {
    name: "set_vacation_mode",
    description: `Включить/выключить режим паузы (отпуск, болезнь, перегрузка). Все привычки замораживаются, уведомления отключаются.

Примеры:
- "я заболел" → enabled: true, reason: "болезнь"
- "в отпуске на неделю" → enabled: true, days: 7, reason: "отпуск"
- "устал от всего, пауза" → enabled: true, days: 3, reason: "перегрузка"
- "я вернулся" / "конец паузы" → enabled: false`,
    input_schema: {
      type: "object" as const,
      properties: {
        enabled: { type: "boolean", description: "true = включить паузу, false = выключить" },
        days: { type: "number", description: "На сколько дней (auto-resume). Если не указано — бессрочно до ручного выключения." },
        reason: { type: "string", description: "Причина: болезнь, отпуск, перегрузка" },
      },
      required: ["enabled"],
    },
  },
```

- [ ] **Step 2: Add set_vacation_mode handler in executeTool**

In `src/services/ai.ts`, inside the `executeTool` switch statement (after the `set_timezone` case, around line 657), add:

```typescript
    case "set_vacation_mode": {
      const input = toolInput as { enabled: boolean; days?: number; reason?: string };

      if (input.enabled) {
        const vacationUntil = input.days
          ? new Date(Date.now() + input.days * 24 * 60 * 60 * 1000)
          : null;

        // Pause all active habits
        await prisma.habit.updateMany({
          where: { userId, isActive: true, pausedAt: null },
          data: {
            pausedAt: new Date(),
            pausedUntil: vacationUntil,
          },
        });

        // Set vacation on user
        await prisma.user.update({
          where: { id: userId },
          data: {
            vacationUntil,
            vacationReason: input.reason || "пауза",
          },
        });

        const untilText = vacationUntil
          ? `до ${vacationUntil.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
          : "до ручного выключения";
        const reasonText = input.reason || "пауза";

        return {
          text: `Режим паузы включён (${reasonText}) ${untilText}. Все привычки заморожены, уведомления отключены. Стрики не пострадают.`,
          actions: [],
        };
      } else {
        // Disable vacation
        await prisma.user.update({
          where: { id: userId },
          data: { vacationUntil: null, vacationReason: null },
        });

        // Resume all habits that were paused for vacation
        await prisma.habit.updateMany({
          where: { userId, isActive: true, pausedAt: { not: null } },
          data: { pausedAt: null, pausedUntil: null },
        });

        return {
          text: "С возвращением! Пауза снята, привычки разморожены. Как ты себя чувствуешь?",
          actions: [],
        };
      }
    }
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: set_vacation_mode bot tool — global pause for habits + notifications"
```

---

## Task 5: Vacation Check in All Notification Senders

Every cron that sends messages to users must skip users on vacation.

**Files:**
- Modify: `src/services/checkin-sender.ts`
- Modify: `src/services/smart-nudges.ts`
- Modify: `src/services/kaizen-reminder.ts`
- Modify: `src/services/balance-cron.ts`
- Modify: `src/services/strategy-cron.ts`
- Modify: `src/services/weekly-digest.ts`
- Modify: `src/services/habit-cron.ts`

- [ ] **Step 1: Add vacation check helper**

Create a shared helper. In `src/services/awareness.ts`, add at the bottom:

```typescript
/**
 * Check if user is currently on vacation.
 */
export function isOnVacation(user: { vacationUntil: Date | null }): boolean {
  return !!(user.vacationUntil && user.vacationUntil > new Date());
}
```

- [ ] **Step 2: Add vacation check to checkin-sender.ts**

In `src/services/checkin-sender.ts`, add import:
```typescript
import { isOnVacation } from "./awareness.js";
```

In `sendScheduledCheckins()`, after `const tz = user.timezone || "Asia/Shanghai";`, add:
```typescript
      // Skip users on vacation
      if (isOnVacation(user as any)) continue;
```

- [ ] **Step 3: Add vacation check to smart-nudges.ts**

In `src/services/smart-nudges.ts`, add import:
```typescript
import { isOnVacation } from "./awareness.js";
```

In `sendDailyNudges()`, inside the for loop, at the start of the try block, add:
```typescript
      if (isOnVacation(user as any)) continue;
```

- [ ] **Step 4: Add vacation check to kaizen-reminder.ts**

In `src/services/kaizen-reminder.ts`, add import:
```typescript
import { isOnVacation } from "./awareness.js";
```

In `sendKaizenReminders()`, inside the for loop, at the start of the try block, add:
```typescript
      if (isOnVacation(user as any)) continue;
```

- [ ] **Step 5: Add vacation check to balance-cron.ts**

In `src/services/balance-cron.ts`, add import:
```typescript
import { isOnVacation } from "./awareness.js";
```

In `checkBalanceAssessment()`, inside the for loop, at the start of the try block, add:
```typescript
      if (isOnVacation(user as any)) continue;
```

- [ ] **Step 6: Add vacation check to strategy-cron.ts**

In `src/services/strategy-cron.ts`, add import:
```typescript
import { isOnVacation } from "./awareness.js";
```

In both `sendQuarterlyReview()` and `sendMissionReview()`, inside the for loops, at the start of the try block, add:
```typescript
      if (isOnVacation(user as any)) continue;
```

- [ ] **Step 7: Add vacation check to weekly-digest.ts**

In `src/services/weekly-digest.ts`, add import:
```typescript
import { isOnVacation } from "./awareness.js";
```

In `sendWeeklyDigest()`, inside the for loop, at the start of the try block (after getting user), add:
```typescript
      if (isOnVacation(user as any)) continue;
```

- [ ] **Step 8: Add vacation check to habit-cron.ts**

In `src/services/habit-cron.ts`, add import:
```typescript
import { isOnVacation } from "./awareness.js";
```

In `sendRoutineReminders()`, inside the for loop, at the start of the try block, add:
```typescript
      if (isOnVacation(user as any)) continue;
```

- [ ] **Step 9: Run build and tests**

Run: `npm run build && npx vitest run`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add src/services/checkin-sender.ts src/services/smart-nudges.ts src/services/kaizen-reminder.ts src/services/balance-cron.ts src/services/strategy-cron.ts src/services/weekly-digest.ts src/services/habit-cron.ts src/services/awareness.ts
git commit -m "feat: skip all notifications for users on vacation"
```

---

## Task 6: Morning Brief Service

Merge 3 morning crons (habits 7:30, kaizen 8:00, nudge 9:00) into one `sendMorningBrief()`.

**Files:**
- Create: `src/services/morning-brief.ts`
- Create: `src/__tests__/morning-brief.test.ts`

- [ ] **Step 1: Export helpers from existing services**

In `src/services/smart-nudges.ts`, make `collectNudges` exported (it's already a named function, just ensure export):
```typescript
// Change:
async function collectNudges(userId: number): Promise<Nudge[]> {
// To:
export async function collectNudges(userId: number): Promise<Nudge[]> {
```

Also export the `Nudge` interface:
```typescript
export interface Nudge {
```

In `src/services/kaizen-reminder.ts`, extract the context builder into a separate exported function. Add before `sendKaizenReminders`:

```typescript
/**
 * Build kaizen context summary for a user's yesterday.
 * Returns { needed: boolean, contextMsg: string, dateStr: string }
 */
export async function buildKaizenContext(userId: number): Promise<{
  needed: boolean;
  contextMsg: string;
  dateStr: string;
}> {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // Check if reflection already exists for yesterday
  const reflection = await prisma.reflection.findFirst({
    where: { userId, date: { gte: yesterday, lt: today } },
  });

  if (reflection) {
    return { needed: false, contextMsg: "", dateStr: "" };
  }

  // Check if user has any recent activity
  const recentLog = await prisma.energyLog.findFirst({
    where: { userId, createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
  });

  if (!recentLog) {
    return { needed: false, contextMsg: "", dateStr: "" };
  }

  // Gather yesterday's context
  const energyLogs = await prisma.energyLog.findMany({
    where: { userId, createdAt: { gte: yesterday, lt: today } },
    orderBy: { createdAt: "asc" },
  });

  const habitLogs = await prisma.habitLog.findMany({
    where: { userId, date: yesterday },
    include: { habit: { select: { name: true, icon: true } } },
  });

  const totalHabits = await prisma.habit.count({
    where: { userId, isActive: true },
  });

  let contextMsg = "";
  if (energyLogs.length > 0) {
    const last = energyLogs[energyLogs.length - 1];
    contextMsg += `\n  🔋 Энергия: физ ${last.physical}, мент ${last.mental}, эмо ${last.emotional}, дух ${last.spiritual}`;
  }

  if (habitLogs.length > 0) {
    const names = habitLogs.slice(0, 3).map((l) => `${l.habit.icon} ${l.habit.name}`).join(", ");
    const extra = habitLogs.length > 3 ? ` +${habitLogs.length - 3}` : "";
    contextMsg += `\n  ⚡ Привычки: ${habitLogs.length}/${totalHabits} — ${names}${extra}`;
  }

  const dateStr = yesterday.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

  return { needed: true, contextMsg: contextMsg || "\n  Данных нет.", dateStr };
}
```

- [ ] **Step 2: Write tests for morning brief**

Create `src/__tests__/morning-brief.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  default: {
    user: { findMany: vi.fn() },
    habit: { findMany: vi.fn(), count: vi.fn() },
    habitLog: { findMany: vi.fn(), findFirst: vi.fn() },
    energyLog: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    reflection: { findFirst: vi.fn() },
    goal: { findMany: vi.fn() },
    balanceGoal: { findMany: vi.fn() },
    balanceRating: { findFirst: vi.fn() },
    mission: { findUnique: vi.fn() },
  },
}));

vi.mock("../bot.js", () => ({
  bot: { api: { sendMessage: vi.fn().mockResolvedValue({}) } },
}));

vi.mock("./monitor.js", () => ({
  trackError: vi.fn(),
}));

import { buildMorningBriefText } from "../services/morning-brief.js";

describe("morning-brief", () => {
  it("buildMorningBriefText returns combined message", async () => {
    const text = await buildMorningBriefText({
      morningHabits: [
        { icon: "🧘", name: "Медитация" },
        { icon: "🏃", name: "Зарядка" },
      ],
      kaizenNeeded: true,
      kaizenDateStr: "23 марта, понедельник",
      topNudge: null,
      topGap: null,
    });

    expect(text).toContain("Доброе утро");
    expect(text).toContain("🧘 Медитация");
    expect(text).toContain("🏃 Зарядка");
    expect(text).toContain("Рефлексия");
  });

  it("includes nudge when present", async () => {
    const text = await buildMorningBriefText({
      morningHabits: [],
      kaizenNeeded: false,
      kaizenDateStr: "",
      topNudge: "🔥 стрик на грани!",
      topGap: null,
    });

    expect(text).toContain("стрик на грани");
  });

  it("includes awareness gap when present", async () => {
    const text = await buildMorningBriefText({
      morningHabits: [],
      kaizenNeeded: false,
      kaizenDateStr: "",
      topNudge: null,
      topGap: "баланс жизни не обновлялся 18 дней",
    });

    expect(text).toContain("баланс жизни");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/morning-brief.test.ts`
Expected: FAIL

- [ ] **Step 4: Create morning-brief.ts**

Create `src/services/morning-brief.ts`:

```typescript
import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";
import { collectNudges } from "./smart-nudges.js";
import { buildKaizenContext } from "./kaizen-reminder.js";
import { getAwarenessGaps, isOnVacation } from "./awareness.js";
import { InlineKeyboard } from "grammy";

interface MorningBriefInput {
  morningHabits: Array<{ icon: string; name: string }>;
  kaizenNeeded: boolean;
  kaizenDateStr: string;
  topNudge: string | null;
  topGap: string | null;
}

/**
 * Build the text of the morning brief message.
 * Pure function — easy to test.
 */
export async function buildMorningBriefText(input: MorningBriefInput): Promise<string> {
  const lines: string[] = ["☀️ Доброе утро!\n"];

  // Morning habits
  if (input.morningHabits.length > 0) {
    const habitList = input.morningHabits.map(h => `${h.icon} ${h.name}`).join(", ");
    lines.push(`⚡ Утренняя рутина: ${habitList}`);
  }

  // Kaizen reminder
  if (input.kaizenNeeded) {
    lines.push(`\n🧠 Рефлексия за ${input.kaizenDateStr} не пройдена`);
  }

  // Smart nudge (if any and different from awareness gap)
  if (input.topNudge) {
    lines.push(`\n${input.topNudge}`);
  }

  // Awareness gap (max 1, only if no nudge or different topic)
  if (input.topGap && !input.topNudge) {
    lines.push(`\n💡 ${input.topGap}`);
  }

  return lines.join("\n");
}

/**
 * Get local hour for a user's timezone.
 */
function getUserLocalHour(timezone: string): number {
  return parseInt(
    new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: timezone }),
    10,
  );
}

/**
 * Get notification prefs with defaults.
 */
interface NotificationPrefs {
  morningBrief: boolean;
  morningTime: string;
  afternoonReminder: boolean;
  eveningReminder: boolean;
  weeklyDigest: boolean;
  balanceReminder: boolean;
  balanceIntervalDays: number;
}

export function getNotificationPrefs(raw: unknown): NotificationPrefs {
  const defaults: NotificationPrefs = {
    morningBrief: true,
    morningTime: "08:00",
    afternoonReminder: true,
    eveningReminder: true,
    weeklyDigest: true,
    balanceReminder: true,
    balanceIntervalDays: 14,
  };
  if (!raw || typeof raw !== "object") return defaults;
  return { ...defaults, ...(raw as Partial<NotificationPrefs>) };
}

/**
 * Main entry: send morning brief to all users where local time matches their morningTime.
 * Called every hour from scheduler.
 */
export async function sendMorningBrief(): Promise<void> {
  const users = await prisma.user.findMany();
  console.log(`[morning-brief] Checking ${users.length} user(s)`);

  for (const user of users) {
    try {
      // Skip vacation
      if (isOnVacation(user as any)) continue;

      const tz = user.timezone || "Asia/Shanghai";
      const localHour = getUserLocalHour(tz);
      const prefs = getNotificationPrefs(user.notificationPrefs);

      // Check if morning brief is enabled and it's the right hour
      if (!prefs.morningBrief) continue;
      const targetHour = parseInt(prefs.morningTime.split(":")[0], 10) || 8;
      if (localHour !== targetHour) continue;

      // Gather morning habits
      const morningHabits = await prisma.habit.findMany({
        where: { userId: user.id, isActive: true, routineSlot: "morning", pausedAt: null },
        select: { icon: true, name: true },
        orderBy: { sortOrder: "asc" },
      });

      // Kaizen check
      const kaizenCtx = await buildKaizenContext(user.id);

      // Smart nudge (top 1)
      let topNudge: string | null = null;
      try {
        const nudges = await collectNudges(user.id);
        if (nudges.length > 0) {
          nudges.sort((a, b) => b.priority - a.priority);
          topNudge = nudges[0].text;
        }
      } catch {}

      // Awareness gap (top 1)
      let topGap: string | null = null;
      try {
        const gaps = await getAwarenessGaps(user.id);
        if (gaps.length > 0) {
          topGap = gaps[0].suggestion;
        }
      } catch {}

      // Build message
      const text = await buildMorningBriefText({
        morningHabits,
        kaizenNeeded: kaizenCtx.needed,
        kaizenDateStr: kaizenCtx.dateStr,
        topNudge,
        topGap,
      });

      // Build keyboard
      const kb = new InlineKeyboard();
      if (morningHabits.length > 0) {
        kb.webApp("▶ Начать рутину", `${process.env.WEBAPP_URL || "https://energy-management-production.up.railway.app"}#habits`);
        kb.row();
      }
      if (kaizenCtx.needed) {
        kb.text("💬 Начать рефлексию", "kaizen_start");
      }

      const chatId = Number(user.telegramId);
      await bot.api.sendMessage(chatId, text, {
        ...(kb.inline_keyboard.length > 0 ? { reply_markup: kb } : {}),
      });

      console.log(`[morning-brief] Sent to user ${user.id} (tz: ${tz})`);
    } catch (err) {
      await trackError("morning-brief", err, { userId: user.id });
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/__tests__/morning-brief.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/morning-brief.ts src/__tests__/morning-brief.test.ts src/services/smart-nudges.ts src/services/kaizen-reminder.ts
git commit -m "feat: morning brief — merged morning message with habits, kaizen, nudge, awareness"
```

---

## Task 7: Fix Timezone Hardcoding — All Crons Timezone-Aware

Convert all hardcoded `{ timezone: "Asia/Shanghai" }` crons to hourly-poll pattern.

**Files:**
- Modify: `src/services/scheduler.ts`
- Modify: `src/services/habit-cron.ts`
- Modify: `src/services/balance-cron.ts`
- Modify: `src/services/strategy-cron.ts`
- Modify: `src/services/weekly-digest.ts`

- [ ] **Step 1: Create timezone-aware wrapper in habit-cron.ts**

In `src/services/habit-cron.ts`, add a new exported function for timezone-aware routine reminders:

```typescript
/**
 * Timezone-aware routine reminder sender.
 * Called every hour — checks each user's local time.
 * Morning: 7:30 → localHour 7 (closest hour check)
 * Afternoon: 13:00 → localHour 13
 * Evening: 20:30 → localHour 20 (closest hour check)
 */
export async function sendTimezoneAwareRoutineReminders(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      habits: {
        some: { isActive: true, pausedAt: null },
      },
    },
  });

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;

      const tz = user.timezone || "Asia/Shanghai";
      const localHour = parseInt(
        new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }),
        10,
      );

      const prefs = getNotificationPrefs(user.notificationPrefs);

      // Afternoon: 13:00 local
      if (localHour === 13 && prefs.afternoonReminder) {
        await sendRoutineReminder(Number(user.telegramId), user.id, "afternoon");
      }

      // Evening: 20:00 local (shifted from 20:30 since we check hourly)
      if (localHour === 20 && prefs.eveningReminder) {
        await sendRoutineReminder(Number(user.telegramId), user.id, "evening");
      }
    } catch (err) {
      console.error(`[habit-cron] Timezone-aware reminder failed for user ${user.id}:`, err);
    }
  }
}
```

Add imports at the top of `src/services/habit-cron.ts`:
```typescript
import { isOnVacation } from "./awareness.js";
import { getNotificationPrefs } from "./morning-brief.js";
```

Note: `sendRoutineReminder` (singular, the per-user function) should already exist in this file as a non-exported function. Keep it as-is.

- [ ] **Step 2: Make balance-cron.ts timezone-aware**

Replace `src/services/balance-cron.ts` content:

```typescript
import prisma from "../db.js";
import { bot } from "../bot.js";
import { trackError } from "./monitor.js";
import { isOnVacation } from "./awareness.js";
import { getNotificationPrefs } from "./morning-brief.js";

/**
 * Timezone-aware balance assessment check.
 * Called every hour — sends reminder at 10:00 local time if >=N days since last.
 */
export async function checkBalanceAssessment(): Promise<void> {
  const users = await prisma.user.findMany();

  for (const user of users) {
    try {
      if (isOnVacation(user as any)) continue;

      const tz = user.timezone || "Asia/Shanghai";
      const localHour = parseInt(
        new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }),
        10,
      );

      if (localHour !== 10) continue;

      const prefs = getNotificationPrefs(user.notificationPrefs);
      if (!prefs.balanceReminder) continue;

      const lastRating = await prisma.balanceRating.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      const daysSinceLastAssessment = lastRating
        ? Math.floor((Date.now() - lastRating.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;

      if (daysSinceLastAssessment >= prefs.balanceIntervalDays) {
        const chatId = Number(user.telegramId);

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

- [ ] **Step 3: Make strategy-cron.ts timezone-aware**

In `src/services/strategy-cron.ts`, add imports:
```typescript
import { isOnVacation } from "./awareness.js";
```

In `sendQuarterlyReview()`, change the function to check local time. After `for (const user of users) {`, inside the try block, add at the start:

```typescript
      if (isOnVacation(user as any)) continue;

      const tz = user.timezone || "Asia/Shanghai";
      const localHour = parseInt(
        new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }),
        10,
      );
      if (localHour !== 10) continue;
```

Apply the same pattern to `sendMissionReview()`.

- [ ] **Step 4: Make weekly-digest.ts timezone-aware**

In `src/services/weekly-digest.ts`, add imports:
```typescript
import { isOnVacation } from "./awareness.js";
import { getNotificationPrefs } from "./morning-brief.js";
```

In the main loop of `sendWeeklyDigest()`, add at the start of each user's try block:

```typescript
      if (isOnVacation(user as any)) continue;

      const tz = user.timezone || "Asia/Shanghai";
      const localHour = parseInt(
        new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }),
        10,
      );
      if (localHour !== 20) continue;

      // Check day — only Sunday
      const localDay = parseInt(
        new Date().toLocaleString("en-US", { weekday: "numeric", timeZone: tz }),
        10,
      );
      if (localDay !== 1) continue; // 1 = Sunday in toLocaleString weekday numeric

      const prefs = getNotificationPrefs(user.notificationPrefs);
      if (!prefs.weeklyDigest) continue;
```

Note: `toLocaleString` with `weekday: "numeric"` returns 1=Sunday through 7=Saturday. Verify this matches the existing behavior (Sunday at 20:00).

- [ ] **Step 5: Rewrite scheduler.ts — remove hardcoded, add hourly polls**

Replace `src/services/scheduler.ts`:

```typescript
import cron, { type ScheduledTask } from "node-cron";
import { sendScheduledCheckins } from "./checkin-sender.js";
import { runDailyHabitCron, runWeeklyHabitReset } from "./habit-cron.js";
import { sendTimezoneAwareRoutineReminders } from "./habit-cron.js";
import { sendWeeklyDigest } from "./weekly-digest.js";
import { checkBalanceAssessment } from "./balance-cron.js";
import { sendQuarterlyReview, sendMissionReview } from "./strategy-cron.js";
import { sendMorningBrief } from "./morning-brief.js";

const tasks: ScheduledTask[] = [];

export function startScheduler(): void {
  console.log("Scheduler started");

  // Heartbeat every 15 min
  const heartbeat = cron.schedule("*/15 * * * *", () => {
    console.log(`Scheduler heartbeat: ${new Date().toISOString()}`);
  });
  tasks.push(heartbeat);

  // === HOURLY TIMEZONE-AWARE JOBS (all run at :00 every hour) ===

  // Energy checkins — already timezone-aware (9:00 / 21:00 local)
  const checkins = cron.schedule("0 * * * *", () => {
    sendScheduledCheckins().catch(err => console.error("Scheduled checkin failed:", err));
  });
  tasks.push(checkins);
  console.log("Timezone-aware checkins scheduled: every hour at :00");

  // Morning brief — replaces separate morning habits (7:30), kaizen (8:00), nudge (9:00)
  // Sends at user's configured morningTime (default 8:00 local)
  const morningBrief = cron.schedule("0 * * * *", () => {
    sendMorningBrief().catch(err => console.error("Morning brief failed:", err));
  });
  tasks.push(morningBrief);
  console.log("Morning brief scheduled: every hour at :00 (timezone-aware)");

  // Afternoon + evening habit reminders — timezone-aware (13:00 / 20:00 local)
  const routineReminders = cron.schedule("0 * * * *", () => {
    sendTimezoneAwareRoutineReminders().catch(err => console.error("Routine reminder failed:", err));
  });
  tasks.push(routineReminders);
  console.log("Routine reminders scheduled: every hour at :00 (timezone-aware)");

  // Weekly digest — Sunday 20:00 local
  const weeklyDigest = cron.schedule("0 * * * *", () => {
    sendWeeklyDigest().catch(err => console.error("Weekly digest failed:", err));
  });
  tasks.push(weeklyDigest);
  console.log("Weekly digest scheduled: every hour at :00 (timezone-aware, Sun 20:00 local)");

  // Balance check — daily 10:00 local
  const balanceCheck = cron.schedule("0 * * * *", () => {
    checkBalanceAssessment().catch(err => console.error("Balance assessment check failed:", err));
  });
  tasks.push(balanceCheck);
  console.log("Balance assessment check scheduled: every hour at :00 (timezone-aware)");

  // Quarterly review — 1st of quarter months, 10:00 local
  const quarterlyReview = cron.schedule("0 * 1 1,4,7,10 *", () => {
    sendQuarterlyReview().catch(err => console.error("Quarterly review failed:", err));
  });
  tasks.push(quarterlyReview);
  console.log("Quarterly review scheduled: hourly on 1st of Q months (timezone-aware)");

  // Yearly mission review — January 1st, 10:00 local
  const yearlyReview = cron.schedule("0 * 1 1 *", () => {
    sendMissionReview().catch(err => console.error("Mission review failed:", err));
  });
  tasks.push(yearlyReview);
  console.log("Yearly mission review scheduled: hourly on Jan 1 (timezone-aware)");

  // === UTC-BASED JOBS (no user timezone needed) ===

  // Daily habit maintenance at midnight UTC
  const habitDaily = cron.schedule("0 0 * * *", () => {
    runDailyHabitCron().catch(err => console.error("Daily habit cron failed:", err));
  });
  tasks.push(habitDaily);
  console.log("Daily habit cron scheduled: 0 0 * * *");

  // Weekly freeze reset Monday midnight UTC
  const habitWeekly = cron.schedule("0 0 * * 1", () => {
    runWeeklyHabitReset().catch(err => console.error("Weekly habit reset failed:", err));
  });
  tasks.push(habitWeekly);
  console.log("Weekly habit reset scheduled: 0 0 * * 1");
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  console.log("Scheduler stopped");
}
```

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add src/services/scheduler.ts src/services/habit-cron.ts src/services/balance-cron.ts src/services/strategy-cron.ts src/services/weekly-digest.ts
git commit -m "feat: all user-facing crons timezone-aware — hourly poll pattern"
```

---

## Task 8: Settings API

Create GET/PUT /api/settings for notification preferences, vacation, and timezone.

**Files:**
- Create: `src/api/settings.ts`
- Create: `src/__tests__/settings-api.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write tests for settings API**

Create `src/__tests__/settings-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  default: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        timezone: "Asia/Shanghai",
        vacationUntil: null,
        vacationReason: null,
        notificationPrefs: null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    habit: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

import prisma from "../db.js";
import { getSettings, updateSettings } from "../api/settings.js";

describe("settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default notification prefs when none set", async () => {
    const result = await getSettings(1);
    expect(result.timezone).toBe("Asia/Shanghai");
    expect(result.notificationPrefs.morningBrief).toBe(true);
    expect(result.notificationPrefs.morningTime).toBe("08:00");
    expect(result.vacationUntil).toBeNull();
  });

  it("updates timezone", async () => {
    await updateSettings(1, { timezone: "Europe/Moscow" });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ timezone: "Europe/Moscow" }),
      }),
    );
  });

  it("validates timezone", async () => {
    await expect(updateSettings(1, { timezone: "Invalid/Zone" })).rejects.toThrow();
  });

  it("sets vacation mode", async () => {
    await updateSettings(1, { vacationUntil: "2026-04-01T00:00:00Z", vacationReason: "отпуск" });
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.habit.updateMany).toHaveBeenCalled();
  });

  it("clears vacation mode", async () => {
    await updateSettings(1, { vacationUntil: null });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vacationUntil: null, vacationReason: null }),
      }),
    );
  });

  it("updates notification prefs", async () => {
    await updateSettings(1, {
      notificationPrefs: { morningBrief: false, morningTime: "07:00" },
    });
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/settings-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Create settings API**

Create `src/api/settings.ts`:

```typescript
import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { getNotificationPrefs } from "../services/morning-brief.js";

interface SettingsResponse {
  timezone: string;
  vacationUntil: string | null;
  vacationReason: string | null;
  notificationPrefs: {
    morningBrief: boolean;
    morningTime: string;
    afternoonReminder: boolean;
    eveningReminder: boolean;
    weeklyDigest: boolean;
    balanceReminder: boolean;
    balanceIntervalDays: number;
  };
}

export async function getSettings(userId: number): Promise<SettingsResponse> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const prefs = getNotificationPrefs(user.notificationPrefs);

  return {
    timezone: user.timezone,
    vacationUntil: user.vacationUntil?.toISOString() ?? null,
    vacationReason: user.vacationReason ?? null,
    notificationPrefs: prefs,
  };
}

interface UpdateSettingsInput {
  timezone?: string;
  vacationUntil?: string | null;
  vacationReason?: string;
  notificationPrefs?: Partial<{
    morningBrief: boolean;
    morningTime: string;
    afternoonReminder: boolean;
    eveningReminder: boolean;
    weeklyDigest: boolean;
    balanceReminder: boolean;
    balanceIntervalDays: number;
  }>;
}

export async function updateSettings(userId: number, input: UpdateSettingsInput): Promise<void> {
  const data: Record<string, unknown> = {};

  // Timezone
  if (input.timezone !== undefined) {
    try {
      new Date().toLocaleString("en-US", { timeZone: input.timezone });
    } catch {
      throw new Error(`Invalid timezone: ${input.timezone}`);
    }
    data.timezone = input.timezone;
  }

  // Vacation
  if (input.vacationUntil !== undefined) {
    if (input.vacationUntil === null) {
      data.vacationUntil = null;
      data.vacationReason = null;

      // Resume habits
      await prisma.habit.updateMany({
        where: { userId, isActive: true, pausedAt: { not: null } },
        data: { pausedAt: null, pausedUntil: null },
      });
    } else {
      const date = new Date(input.vacationUntil);
      if (isNaN(date.getTime())) throw new Error("Invalid vacationUntil date");
      data.vacationUntil = date;
      data.vacationReason = input.vacationReason || "пауза";

      // Pause all habits
      await prisma.habit.updateMany({
        where: { userId, isActive: true, pausedAt: null },
        data: {
          pausedAt: new Date(),
          pausedUntil: date,
        },
      });
    }
  } else if (input.vacationReason !== undefined) {
    data.vacationReason = input.vacationReason;
  }

  // Notification prefs — merge with existing
  if (input.notificationPrefs !== undefined) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const existing = getNotificationPrefs(user?.notificationPrefs);
    data.notificationPrefs = { ...existing, ...input.notificationPrefs };
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: userId }, data });
  }
}

export function settingsRoute(router: Router): void {
  router.get("/settings", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    try {
      const settings = await getSettings(userId);
      res.json(settings);
    } catch (err: any) {
      console.error("Settings GET error:", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  router.put("/settings", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    try {
      await updateSettings(userId, req.body);
      const settings = await getSettings(userId);
      res.json(settings);
    } catch (err: any) {
      if (err.message?.includes("Invalid")) {
        res.status(400).json({ error: err.message });
      } else {
        console.error("Settings PUT error:", err);
        res.status(500).json({ error: err.message || "internal_error" });
      }
    }
  });
}
```

- [ ] **Step 4: Register in server.ts**

In `src/server.ts`, add import:
```typescript
import { settingsRoute } from "./api/settings.js";
```

Add route registration after `strategyRoute(authedRouter);`:
```typescript
  settingsRoute(authedRouter);
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/__tests__/settings-api.test.ts`
Expected: PASS

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/api/settings.ts src/__tests__/settings-api.test.ts src/server.ts
git commit -m "feat: GET/PUT /api/settings — timezone, vacation, notification prefs"
```

---

## Task 9: Mini App — Settings Store + API Client

Add settings types, API methods, and signal store.

**Files:**
- Modify: `src/mini-app/api/types.ts`
- Modify: `src/mini-app/api/client.ts`
- Create: `src/mini-app/store/settings.ts`

- [ ] **Step 1: Add settings types**

In `src/mini-app/api/types.ts`, add at the end:

```typescript
// --- Settings ---

export interface NotificationPrefs {
  morningBrief: boolean;
  morningTime: string;
  afternoonReminder: boolean;
  eveningReminder: boolean;
  weeklyDigest: boolean;
  balanceReminder: boolean;
  balanceIntervalDays: number;
}

export interface SettingsResponse {
  timezone: string;
  vacationUntil: string | null;
  vacationReason: string | null;
  notificationPrefs: NotificationPrefs;
}
```

- [ ] **Step 2: Add settings API methods**

In `src/mini-app/api/client.ts`, add to the `api` object:

```typescript
// Settings
getSettings: () => request<SettingsResponse>("/api/settings"),
updateSettings: (data: Partial<{
  timezone: string;
  vacationUntil: string | null;
  vacationReason: string;
  notificationPrefs: Partial<NotificationPrefs>;
}>) => put<SettingsResponse>("/api/settings", data),
```

Add `SettingsResponse` and `NotificationPrefs` to the import from types. If there's no `put` helper, add one:

```typescript
async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(base + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `tma ${getInitData()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Create settings store**

Create `src/mini-app/store/settings.ts`:

```typescript
import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { SettingsResponse, NotificationPrefs } from "../api/types";

export const settings = signal<SettingsResponse | null>(null);
export const settingsLoading = signal(false);
export const settingsError = signal(false);

export async function loadSettings(): Promise<void> {
  settingsLoading.value = true;
  settingsError.value = false;
  try {
    settings.value = await api.getSettings();
  } catch (err) {
    console.error("Failed to load settings:", err);
    settingsError.value = true;
  } finally {
    settingsLoading.value = false;
  }
}

export async function saveSettings(data: Partial<{
  timezone: string;
  vacationUntil: string | null;
  vacationReason: string;
  notificationPrefs: Partial<NotificationPrefs>;
}>): Promise<boolean> {
  try {
    settings.value = await api.updateSettings(data);
    return true;
  } catch (err) {
    console.error("Failed to save settings:", err);
    return false;
  }
}

export function isOnVacation(): boolean {
  if (!settings.value?.vacationUntil) return false;
  return new Date(settings.value.vacationUntil) > new Date();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/api/types.ts src/mini-app/api/client.ts src/mini-app/store/settings.ts
git commit -m "feat: settings store + API client for Mini App"
```

---

## Task 10: Mini App — Settings Screen

Build the settings screen with notification preferences, vacation toggle, and timezone.

**Files:**
- Create: `src/mini-app/components/settings/SettingsScreen.tsx`
- Modify: `src/mini-app/router.ts`
- Modify: `src/mini-app/app.tsx`
- Modify: `src/mini-app/components/hub/Hub.tsx`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Add "settings" route**

In `src/mini-app/router.ts`, update:

```typescript
export type Route = "hub" | "energy" | "habits" | "balance" | "kaizen" | "settings";

const VALID_ROUTES: Route[] = ["hub", "energy", "habits", "balance", "kaizen", "settings"];
```

- [ ] **Step 2: Create SettingsScreen component**

Create `src/mini-app/components/settings/SettingsScreen.tsx`:

```tsx
import { useEffect, useState } from "preact/hooks";
import {
  settings,
  settingsLoading,
  loadSettings,
  saveSettings,
  isOnVacation,
} from "../../store/settings";
import { haptic, hapticSuccess } from "../../telegram";
import { navigate } from "../../router";

const TIMEZONE_OPTIONS = [
  { label: "Москва (UTC+3)", value: "Europe/Moscow" },
  { label: "Алматы (UTC+6)", value: "Asia/Almaty" },
  { label: "Ташкент (UTC+5)", value: "Asia/Tashkent" },
  { label: "Дубай (UTC+4)", value: "Asia/Dubai" },
  { label: "Шанхай (UTC+8)", value: "Asia/Shanghai" },
  { label: "Токио (UTC+9)", value: "Asia/Tokyo" },
  { label: "Лондон (UTC+0)", value: "Europe/London" },
  { label: "Берлин (UTC+1)", value: "Europe/Berlin" },
  { label: "Нью-Йорк (UTC-5)", value: "America/New_York" },
];

const VACATION_PRESETS = [3, 5, 7, 14, 30];

export function SettingsScreen() {
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  if (settingsLoading.value || !settings.value) {
    return (
      <div class="screen">
        <header class="screen-header">
          <button class="back-btn" onClick={() => navigate("hub")}>←</button>
          <h1>Настройки</h1>
        </header>
        <div class="loading-container"><div class="loading-spinner" /></div>
      </div>
    );
  }

  const s = settings.value;
  const prefs = s.notificationPrefs;
  const onVacation = isOnVacation();

  const togglePref = async (key: string, value: boolean) => {
    haptic("light");
    setSaving(true);
    await saveSettings({ notificationPrefs: { [key]: value } });
    setSaving(false);
  };

  const setMorningTime = async (time: string) => {
    haptic("light");
    await saveSettings({ notificationPrefs: { morningTime: time } });
  };

  const setTimezone = async (tz: string) => {
    haptic("medium");
    setSaving(true);
    await saveSettings({ timezone: tz });
    setSaving(false);
    hapticSuccess();
  };

  const startVacation = async (days: number) => {
    haptic("medium");
    setSaving(true);
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await saveSettings({ vacationUntil: until, vacationReason: "отпуск" });
    setSaving(false);
    hapticSuccess();
  };

  const endVacation = async () => {
    haptic("medium");
    setSaving(true);
    await saveSettings({ vacationUntil: null });
    setSaving(false);
    hapticSuccess();
  };

  return (
    <div class="screen">
      <header class="screen-header">
        <button class="back-btn" onClick={() => navigate("hub")}>←</button>
        <h1>Настройки</h1>
      </header>

      <div class="settings-content">
        {/* Vacation mode */}
        <section class="settings-section">
          <h3 class="settings-section-title">Режим паузы</h3>
          {onVacation ? (
            <div class="settings-vacation-active">
              <div class="vacation-banner-small">
                <span>⏸ На паузе до {new Date(s.vacationUntil!).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
                {s.vacationReason && <span class="vacation-reason">({s.vacationReason})</span>}
              </div>
              <button class="settings-btn settings-btn-primary" onClick={endVacation} disabled={saving}>
                Вернуться
              </button>
            </div>
          ) : (
            <div class="settings-vacation-presets">
              <p class="settings-hint">Заморозит привычки и отключит уведомления</p>
              <div class="vacation-preset-grid">
                {VACATION_PRESETS.map(d => (
                  <button
                    key={d}
                    class="vacation-preset-btn"
                    onClick={() => startVacation(d)}
                    disabled={saving}
                  >
                    {d} дн
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Timezone */}
        <section class="settings-section">
          <h3 class="settings-section-title">Часовой пояс</h3>
          <select
            class="settings-select"
            value={s.timezone}
            onChange={(e) => setTimezone((e.target as HTMLSelectElement).value)}
          >
            {TIMEZONE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
            {!TIMEZONE_OPTIONS.find(o => o.value === s.timezone) && (
              <option value={s.timezone}>{s.timezone}</option>
            )}
          </select>
        </section>

        {/* Notifications */}
        <section class="settings-section">
          <h3 class="settings-section-title">Уведомления</h3>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-label">Утренний бриф</span>
              <span class="settings-toggle-desc">Привычки, рефлексия, инсайты</span>
            </div>
            <label class="settings-switch">
              <input
                type="checkbox"
                checked={prefs.morningBrief}
                onChange={(e) => togglePref("morningBrief", (e.target as HTMLInputElement).checked)}
              />
              <span class="settings-switch-slider" />
            </label>
          </div>

          {prefs.morningBrief && (
            <div class="settings-time-row">
              <span>Время</span>
              <select
                class="settings-time-select"
                value={prefs.morningTime}
                onChange={(e) => setMorningTime((e.target as HTMLSelectElement).value)}
              >
                {["06:00", "07:00", "08:00", "09:00", "10:00"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-label">Дневные привычки</span>
              <span class="settings-toggle-desc">Напоминание в 13:00</span>
            </div>
            <label class="settings-switch">
              <input
                type="checkbox"
                checked={prefs.afternoonReminder}
                onChange={(e) => togglePref("afternoonReminder", (e.target as HTMLInputElement).checked)}
              />
              <span class="settings-switch-slider" />
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-label">Вечерние привычки</span>
              <span class="settings-toggle-desc">Напоминание в 20:00</span>
            </div>
            <label class="settings-switch">
              <input
                type="checkbox"
                checked={prefs.eveningReminder}
                onChange={(e) => togglePref("eveningReminder", (e.target as HTMLInputElement).checked)}
              />
              <span class="settings-switch-slider" />
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-label">Недельный дайджест</span>
              <span class="settings-toggle-desc">Воскресенье в 20:00</span>
            </div>
            <label class="settings-switch">
              <input
                type="checkbox"
                checked={prefs.weeklyDigest}
                onChange={(e) => togglePref("weeklyDigest", (e.target as HTMLInputElement).checked)}
              />
              <span class="settings-switch-slider" />
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-label">Напоминание о балансе</span>
              <span class="settings-toggle-desc">Раз в {prefs.balanceIntervalDays} дней</span>
            </div>
            <label class="settings-switch">
              <input
                type="checkbox"
                checked={prefs.balanceReminder}
                onChange={(e) => togglePref("balanceReminder", (e.target as HTMLInputElement).checked)}
              />
              <span class="settings-switch-slider" />
            </label>
          </div>

          {prefs.balanceReminder && (
            <div class="settings-time-row">
              <span>Интервал</span>
              <select
                class="settings-time-select"
                value={String(prefs.balanceIntervalDays)}
                onChange={(e) => saveSettings({ notificationPrefs: { balanceIntervalDays: parseInt((e.target as HTMLSelectElement).value) } })}
              >
                {[7, 14, 21, 30].map(d => (
                  <option key={d} value={String(d)}>каждые {d} дней</option>
                ))}
              </select>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add SettingsScreen to app.tsx**

In `src/mini-app/app.tsx`, add import:
```typescript
import { SettingsScreen } from "./components/settings/SettingsScreen";
```

Add to the route switch (where other routes are mapped):
```typescript
case "settings":
  return <SettingsScreen />;
```

- [ ] **Step 4: Add settings gear icon to Hub**

In `src/mini-app/components/hub/Hub.tsx`, add to the header (inside `header-left` or after `date` div):

```tsx
<button class="settings-gear" onClick={() => navigate("settings")}>⚙️</button>
```

Add import:
```typescript
import { navigate } from "../../router";
```

Also add vacation banner at top of Hub, before the hub-grid. Import settings:
```typescript
import { settings, loadSettings } from "../../store/settings";
```

Add in Hub component, after useEffect for loadInitialData:
```typescript
useEffect(() => { loadSettings(); }, []);
```

Add before `<main class="views">`:
```tsx
{settings.value?.vacationUntil && new Date(settings.value.vacationUntil) > new Date() && (
  <div class="vacation-banner">
    ⏸ На паузе до {new Date(settings.value.vacationUntil).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
    {settings.value.vacationReason && ` (${settings.value.vacationReason})`}
  </div>
)}
```

- [ ] **Step 5: Add styles for settings screen**

In `src/mini-app/styles/global.css`, add:

```css
/* --- Settings Screen --- */

.settings-gear {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  opacity: 0.7;
}

.vacation-banner {
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 12px;
  padding: 10px 16px;
  margin: 0 16px 12px;
  font-size: 13px;
  color: #ffc107;
  text-align: center;
}

.settings-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  flex: 1;
}

.settings-section {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
}

.settings-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text2);
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.settings-hint {
  font-size: 12px;
  color: var(--text3);
  margin: 0 0 12px;
}

.vacation-preset-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.vacation-preset-btn {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 16px;
  color: var(--text1);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.vacation-preset-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.settings-vacation-active {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vacation-banner-small {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #ffc107;
}

.vacation-reason {
  font-size: 12px;
  color: var(--text3);
}

.settings-btn {
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
  text-align: center;
}

.settings-btn-primary {
  background: var(--accent);
  color: #000;
  font-weight: 600;
}

.settings-select {
  width: 100%;
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--text1);
  font-size: 14px;
  appearance: none;
  -webkit-appearance: none;
}

.settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.settings-toggle-row:last-child {
  border-bottom: none;
}

.settings-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-toggle-label {
  font-size: 14px;
  color: var(--text1);
}

.settings-toggle-desc {
  font-size: 11px;
  color: var(--text3);
}

.settings-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.settings-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.settings-switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: 0.3s;
}

.settings-switch-slider::before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

.settings-switch input:checked + .settings-switch-slider {
  background: var(--accent);
}

.settings-switch input:checked + .settings-switch-slider::before {
  transform: translateX(20px);
}

.settings-time-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 8px 12px;
  font-size: 13px;
  color: var(--text2);
}

.settings-time-select {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text1);
  font-size: 13px;
  appearance: none;
  -webkit-appearance: none;
}
```

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/mini-app/components/settings/SettingsScreen.tsx src/mini-app/router.ts src/mini-app/app.tsx src/mini-app/components/hub/Hub.tsx src/mini-app/store/settings.ts src/mini-app/styles/global.css
git commit -m "feat: settings screen — vacation, timezone, notification preferences"
```

---

## Task 11: Vacation Auto-Resume Cron

Add a check in daily habit cron to auto-resume users whose vacation ended.

**Files:**
- Modify: `src/services/habit-cron.ts`

- [ ] **Step 1: Add vacation auto-resume to daily cron**

In `src/services/habit-cron.ts`, inside `runDailyHabitCron()`, add at the beginning:

```typescript
  // Auto-resume users whose vacation has ended
  try {
    const expiredVacations = await prisma.user.findMany({
      where: {
        vacationUntil: { not: null, lte: new Date() },
      },
    });

    for (const user of expiredVacations) {
      await prisma.user.update({
        where: { id: user.id },
        data: { vacationUntil: null, vacationReason: null },
      });

      // Resume paused habits
      await prisma.habit.updateMany({
        where: { userId: user.id, isActive: true, pausedAt: { not: null } },
        data: { pausedAt: null, pausedUntil: null },
      });

      // Send welcome back message
      try {
        const chatId = Number(user.telegramId);
        await bot.api.sendMessage(chatId, "с возвращением! пауза закончилась, привычки разморожены. как ты?");
      } catch {}

      console.log(`[habit-cron] Auto-resumed user ${user.id} from vacation`);
    }
  } catch (err) {
    console.error("[habit-cron] Vacation auto-resume failed:", err);
  }
```

Add bot import at the top if not already present:
```typescript
import { bot } from "../bot.js";
```

- [ ] **Step 2: Run build and tests**

Run: `npm run build && npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/services/habit-cron.ts
git commit -m "feat: vacation auto-resume — daily cron sends welcome back message"
```

---

## Final Verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors
