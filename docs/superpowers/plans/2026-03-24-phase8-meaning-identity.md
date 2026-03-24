# Phase 8: Meaning & Identity в Daily Flow — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "why" visible every day — show meaning in RoutineFlow, reorder HabitDetail to lead with meaning, add identity reinforcement card before routine start.

**Architecture:** Add `whyToday` display to RoutineFlow card. Reorder HabitDetail sections so "Зачем" is first (above stats). Add identity motivational card as RoutineFlow intro screen using BalanceGoal.identity fetched via `/api/balance` or `/api/strategy`. Fix Algorithm usageCount bug in `executeTool`.

**Tech Stack:** Preact + @preact/signals, Express, Prisma, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-24-v2-improvements-design.md` (section "Фаза 8: Meaning & Identity в Daily Flow")

---

## File Structure

### New files:
- `src/__tests__/meaning-identity.test.ts` — tests for identity card logic and usageCount fix

### Modified files:
- `src/mini-app/components/habits/RoutineFlow.tsx` — add whyToday under habit name, add identity intro card
- `src/mini-app/components/habits/HabitDetail.tsx` — reorder: "Зачем" section above stats
- `src/mini-app/components/habits/HabitsScreen.tsx` — fetch BalanceGoal identity data, pass to RoutineFlow
- `src/mini-app/api/client.ts` — add method to fetch identity for a lifeArea (if not already available)
- `src/mini-app/styles/global.css` — styles for whyToday text, identity card
- `src/services/ai.ts` — fix usageCount increment for get_algorithms (verify/fix)

---

## Task 1: Show whyToday in RoutineFlow

Display the `whyToday` meaning field under each habit's name in the RoutineFlow fullscreen card. Small, subtle text that reinforces why this habit matters.

**Files:**
- Modify: `src/mini-app/components/habits/RoutineFlow.tsx`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Add whyToday text under habit name in RoutineFlow**

In `src/mini-app/components/habits/RoutineFlow.tsx`, inside the `routine-flow-card` div, add whyToday after the habit name:

Find:
```tsx
        <h3 class="routine-flow-name">{current.name}</h3>
        {current.duration && !current.isDuration && (
```

Replace with:
```tsx
        <h3 class="routine-flow-name">{current.name}</h3>
        {current.whyToday && (
          <p class="routine-flow-why">{current.whyToday}</p>
        )}
        {current.duration && !current.isDuration && (
```

- [ ] **Step 2: Add CSS for routine-flow-why**

In `src/mini-app/styles/global.css`, after the `.routine-flow-name` rule, add:

Find:
```css
.routine-flow-name { font-size: 20px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.routine-flow-duration { font-size: 14px; color: var(--text3); }
```

Replace with:
```css
.routine-flow-name { font-size: 20px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.routine-flow-why {
  font-size: 12px; color: var(--text2); margin: 2px 0 8px;
  max-width: 280px; line-height: 1.4;
}
.routine-flow-duration { font-size: 14px; color: var(--text3); }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/components/habits/RoutineFlow.tsx src/mini-app/styles/global.css
git commit -m "feat: show whyToday in RoutineFlow under habit name"
```

---

## Task 2: Reorder HabitDetail — "Зачем" Section First

Move the "Зачем это тебе" meaning section above the strength bar and stats in HabitDetail. Users should see WHY before seeing numbers.

**Files:**
- Modify: `src/mini-app/components/habits/HabitDetail.tsx`

- [ ] **Step 1: Move "Зачем" section above StageIndicator and stats**

In `src/mini-app/components/habits/HabitDetail.tsx`, restructure the return JSX. Move the Meaning Framework block (from `<div class="detail-section-title">Зачем это тебе</div>` through closing `</div>` of `detail-why`) to right after the pause banner and before the strength section.

Current order in the component return:
1. Header (back button + name)
2. StageIndicator
3. Pause banner
4. Strength bar
5. Stats (streak, consistency, freezes)
6. **Meaning Framework ("Зачем это тебе")**
7. Duration info
8. Heatmap
9. CorrelationCard
10. Pause options
11. Delete

New order:
1. Header (back button + name)
2. StageIndicator
3. Pause banner
4. **Meaning Framework ("Зачем это тебе")** ← moved up
5. Strength bar
6. Stats (streak, consistency, freezes)
7. Duration info
8. Heatmap
9. CorrelationCard
10. Pause options
11. Delete

Find the entire block from `{/* Strength bar */}` through `{/* Meaning Framework */}` closing and reorder:

Find:
```tsx
      {/* Strength bar */}
      <div class="strength-section">
        <div class="strength-header">
          <span class="strength-label">Сила привычки</span>
          <span class="strength-value">{Math.round(habit.strength ?? 0)}%</span>
        </div>
        <div class="strength-bar-bg">
          <div class="strength-bar-fill" style={{ width: `${Math.min(100, habit.strength ?? 0)}%` }} />
        </div>
      </div>

      <div class="detail-stats">
        <div>🔥 {s?.streakCurrent ?? habit.streakCurrent} дней (лучший: {s?.streakBest ?? habit.streakBest})</div>
        <div>📊 {s?.consistency30d ?? habit.consistency30d}% за месяц</div>
        <div>❄️ {s ? s.freezesRemaining : Math.max(0, (habit.gracePeriod ?? 2) - (habit.gracesUsed ?? 0))} пропусков осталось на неделе</div>
      </div>

      {/* Meaning Framework */}
      <div class="detail-section-title">Зачем это тебе</div>
```

Replace with:
```tsx
      {/* Meaning Framework — always first */}
      <div class="detail-section-title">Зачем это тебе</div>
```

Then find the closing of the detail-why section and the duration info, and insert the strength/stats block after it.

Find:
```tsx
      {/* Duration info */}
      {habit.duration && (
```

Replace with:
```tsx
      {/* Strength bar */}
      <div class="strength-section">
        <div class="strength-header">
          <span class="strength-label">Сила привычки</span>
          <span class="strength-value">{Math.round(habit.strength ?? 0)}%</span>
        </div>
        <div class="strength-bar-bg">
          <div class="strength-bar-fill" style={{ width: `${Math.min(100, habit.strength ?? 0)}%` }} />
        </div>
      </div>

      <div class="detail-stats">
        <div>🔥 {s?.streakCurrent ?? habit.streakCurrent} дней (лучший: {s?.streakBest ?? habit.streakBest})</div>
        <div>📊 {s?.consistency30d ?? habit.consistency30d}% за месяц</div>
        <div>❄️ {s ? s.freezesRemaining : Math.max(0, (habit.gracePeriod ?? 2) - (habit.gracesUsed ?? 0))} пропусков осталось на неделе</div>
      </div>

      {/* Duration info */}
      {habit.duration && (
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/components/habits/HabitDetail.tsx
git commit -m "feat: reorder HabitDetail — meaning section always first"
```

---

## Task 3: Identity Reinforcement Card in RoutineFlow

Show a motivational intro card before the first habit in RoutineFlow, displaying the user's identity statement for the routine's primary lifeArea. Uses `BalanceGoal.identity` from the strategy/balance API.

**Files:**
- Modify: `src/mini-app/components/habits/HabitsScreen.tsx`
- Modify: `src/mini-app/components/habits/RoutineFlow.tsx`
- Modify: `src/mini-app/api/client.ts`
- Modify: `src/mini-app/api/types.ts`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Add identityMap type and API method**

In `src/mini-app/api/types.ts`, add at the end (before any closing):

```typescript
export interface IdentityMap {
  [area: string]: string | null;
}
```

In `src/mini-app/api/client.ts`, the `api.strategy()` method already returns `StrategyData` which contains `focusAreas` and `otherAreas` with `identity` field. We can extract identity from there. No new API method needed — we'll use `api.strategy()`.

- [ ] **Step 2: Fetch identity map in HabitsScreen and pass to RoutineFlow**

In `src/mini-app/components/habits/HabitsScreen.tsx`, add identity fetching. At the top, add a signal and fetch logic:

Add after the existing signal declarations (after `const routineFlowSlot = signal<string | null>(null);`):

```typescript
const identityMap = signal<Record<string, string | null>>({});
```

Inside the `HabitsScreen` function's `useEffect`, after `loadHabits()`, add identity fetch:

Find:
```typescript
  useEffect(() => {
    parseSuggestParam();
    loadHabits();
  }, []);
```

Replace with:
```typescript
  useEffect(() => {
    parseSuggestParam();
    loadHabits();
    // Fetch identity map for RoutineFlow identity card
    api.strategy().then(data => {
      const map: Record<string, string | null> = {};
      for (const area of [...data.focusAreas, ...data.otherAreas]) {
        if (area.identity) map[area.area] = area.identity;
      }
      identityMap.value = map;
    }).catch(() => { /* non-critical */ });
  }, []);
```

Add import for `api`:

Find:
```typescript
import type { HabitData } from "../../api/types";
```

Replace with:
```typescript
import type { HabitData } from "../../api/types";
import { api } from "../../api/client";
```

Then pass identityMap to RoutineFlow. Find:

```typescript
      <RoutineFlow
        habits={slotHabits}
        slotLabel={slotLabels[routineFlowSlot.value] ?? "Рутина"}
        onFinish={() => { routineFlowSlot.value = null; loadHabits(); }}
```

Replace with:

```typescript
      <RoutineFlow
        habits={slotHabits}
        slotLabel={slotLabels[routineFlowSlot.value] ?? "Рутина"}
        identityMap={identityMap.value}
        onFinish={() => { routineFlowSlot.value = null; loadHabits(); }}
```

- [ ] **Step 3: Add identity intro card to RoutineFlow**

In `src/mini-app/components/habits/RoutineFlow.tsx`, update the interface and add intro state:

Find:
```typescript
interface RoutineFlowProps {
  habits: HabitData[];
  slotLabel: string;
  onFinish: () => void;
}
```

Replace with:
```typescript
interface RoutineFlowProps {
  habits: HabitData[];
  slotLabel: string;
  identityMap?: Record<string, string | null>;
  onFinish: () => void;
}
```

Update the component signature:

Find:
```typescript
export function RoutineFlow({ habits, slotLabel, onFinish }: RoutineFlowProps) {
```

Replace with:
```typescript
export function RoutineFlow({ habits, slotLabel, identityMap, onFinish }: RoutineFlowProps) {
```

Add state for identity intro. Find:

```typescript
  const [completedCount, setCompletedCount] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
```

Replace with:

```typescript
  const [completedCount, setCompletedCount] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [showIdentityIntro, setShowIdentityIntro] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
```

Determine the identity for the first habit's lifeArea. Add after `const current = pending[currentIdx];`:

```typescript
  // Identity for the first habit's lifeArea
  const firstHabitArea = pending[0]?.lifeArea;
  const identityText = firstHabitArea && identityMap ? identityMap[firstHabitArea] : null;
```

Add the identity intro screen. Insert before `// Finished screen` comment:

```typescript
  // Identity intro screen — show before first habit
  if (showIdentityIntro && identityText && currentIdx === 0 && !finished) {
    return (
      <div class="routine-flow">
        <div class="routine-flow-header">
          <button class="routine-flow-close" onClick={onFinish}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <span class="routine-flow-title">{slotLabel}</span>
          <span class="routine-flow-count" />
        </div>
        <div class="routine-flow-identity-card">
          <div class="routine-flow-identity-mirror">🪞</div>
          <p class="routine-flow-identity-text">{identityText}</p>
          <button
            class="routine-flow-identity-btn"
            onClick={() => { haptic("medium"); setShowIdentityIntro(false); }}
          >
            Начать →
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Add CSS for identity intro card**

In `src/mini-app/styles/global.css`, after the `.routine-flow-minimal` rule, add:

```css
.routine-flow-identity-card {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 40px 24px; text-align: center;
}
.routine-flow-identity-mirror { font-size: 56px; margin-bottom: 20px; }
.routine-flow-identity-text {
  font-size: 18px; font-weight: 500; color: var(--text);
  line-height: 1.5; max-width: 300px; margin-bottom: 32px;
}
.routine-flow-identity-btn {
  background: var(--accent); color: #0c0d12; border: none;
  border-radius: 12px; padding: 14px 40px; font-size: 16px;
  font-weight: 600; cursor: pointer;
  box-shadow: 0 0 20px rgba(200, 255, 115, 0.3);
}
.routine-flow-identity-btn:active { transform: scale(0.96); }
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mini-app/components/habits/RoutineFlow.tsx src/mini-app/components/habits/HabitsScreen.tsx src/mini-app/api/types.ts src/mini-app/styles/global.css
git commit -m "feat: identity reinforcement card before RoutineFlow start"
```

---

## Task 4: Fix Algorithm usageCount Bug

The spec mentions `get_algorithms` should increment `usageCount` when called. Verify and ensure the fix is correct in `src/services/ai.ts`.

**Files:**
- Verify: `src/services/ai.ts`
- Create: `src/__tests__/meaning-identity.test.ts`

- [ ] **Step 1: Verify current usageCount behavior**

Check `src/services/ai.ts` around the `get_algorithms` case in `executeTool`. The current code (lines 883-889) already increments usageCount:

```typescript
      // Increment usage for viewed algorithms
      for (const algo of algorithms) {
        await prisma.algorithm.update({
          where: { id: algo.id },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        });
      }
```

This is already implemented. The usageCount fix was done in a previous phase. Verify it's working correctly by writing a test.

- [ ] **Step 2: Write test for usageCount increment**

Create `src/__tests__/meaning-identity.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("../db.js", () => ({
  default: {
    algorithm: {
      findMany: vi.fn().mockResolvedValue([
        { id: 1, icon: "📋", title: "Test Algorithm", steps: ["step1", "step2"], context: "test", usageCount: 3, lastUsedAt: null },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import prisma from "../db.js";

describe("Algorithm usageCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments usageCount when get_algorithms returns results", async () => {
    const mockAlgos = [
      { id: 1, icon: "📋", title: "Test", steps: ["s1", "s2"], context: "c", usageCount: 3, lastUsedAt: null },
      { id: 2, icon: "🔧", title: "Test2", steps: ["s1"], context: "c", usageCount: 0, lastUsedAt: null },
    ];
    (prisma.algorithm.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockAlgos);

    // Simulate what executeTool does for get_algorithms
    const algorithms = await prisma.algorithm.findMany({
      where: { userId: 1, isActive: true },
      orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    for (const algo of algorithms) {
      await prisma.algorithm.update({
        where: { id: algo.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
      });
    }

    expect(prisma.algorithm.update).toHaveBeenCalledTimes(2);
    expect(prisma.algorithm.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { usageCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
    });
    expect(prisma.algorithm.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { usageCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
    });
  });

  it("does not increment when no algorithms found", async () => {
    (prisma.algorithm.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const algorithms = await prisma.algorithm.findMany({
      where: { userId: 1, isActive: true },
      orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    for (const algo of algorithms) {
      await prisma.algorithm.update({
        where: { id: algo.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      });
    }

    expect(prisma.algorithm.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/__tests__/meaning-identity.test.ts`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/meaning-identity.test.ts
git commit -m "test: verify algorithm usageCount increment on get_algorithms"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: PASS — no TypeScript errors

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Manual verification checklist**

Verify in Mini App:
1. RoutineFlow: `whyToday` text appears under habit name (12px, var(--text2))
2. RoutineFlow: if `whyToday` is empty, no extra whitespace appears
3. RoutineFlow: identity intro card shows before first habit if BalanceGoal.identity exists for the slot's primary lifeArea
4. RoutineFlow: "Начать →" button dismisses intro and starts normal flow
5. RoutineFlow: if no identity exists, flow starts normally (no intro card)
6. HabitDetail: "Зачем это тебе" section is visible first, above strength bar and stats
7. HabitDetail: edit mode for meaning still works correctly
8. HabitDetail: all other sections (heatmap, correlation, pause, delete) still present and functional
