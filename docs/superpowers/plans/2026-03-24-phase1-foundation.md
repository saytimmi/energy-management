# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the codebase for Personal OS features — new DB models, 5-tab navigation, parameterized router, Hub with 4 widgets (Balance + Kaizen as stubs), Journal content migrated to Kaizen tab, diagnostics endpoint renamed.

**Architecture:** Database migration adds 5 new models (Mission, Goal, BalanceGoal, Algorithm, Reflection) + extends BalanceRating. Frontend router extended to support parameterized routes (#balance/health, #kaizen/42). Navigation expanded from 4 to 5 tabs. Journal removed as tab, its Observations component reused inside new KaizenScreen.

**Tech Stack:** Prisma (PostgreSQL), Preact + @preact/signals, TypeScript, Vitest, Express

**Spec:** `docs/superpowers/specs/2026-03-23-personal-os-design.md`

---

## Chunk 1: Database Migration

### Task 1: Add new models to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Mission model after BalanceRating model (after line 161)**

```prisma
model Mission {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique
  user      User     @relation(fields: [userId], references: [id])
  identity  String?
  purpose   String?
  legacy    String?
  statement String?
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Add Goal model after Mission**

```prisma
model Goal {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  lifeArea    String
  title       String
  description String?
  timeHorizon String
  period      String
  status      String   @default("active")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, lifeArea, status])
}
```

- [ ] **Step 3: Add BalanceGoal model after Goal**

```prisma
model BalanceGoal {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  area        String
  targetScore Int
  identity    String?
  isFocus     Boolean  @default(false)
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@unique([userId, area])
}
```

- [ ] **Step 4: Add Algorithm model after BalanceGoal**

```prisma
model Algorithm {
  id                 Int         @id @default(autoincrement())
  userId             Int
  user               User        @relation(fields: [userId], references: [id])
  title              String
  icon               String
  lifeArea           String?
  steps              Json
  context            String?
  sourceReflectionId Int?
  sourceReflection   Reflection? @relation("AlgorithmReflection", fields: [sourceReflectionId], references: [id])
  usageCount         Int         @default(0)
  lastUsedAt         DateTime?
  isActive           Boolean     @default(true)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt
}
```

- [ ] **Step 5: Add Reflection model after Algorithm**

```prisma
model Reflection {
  id            Int         @id @default(autoincrement())
  userId        Int
  user          User        @relation(fields: [userId], references: [id])
  date          DateTime
  summary       String
  insights      Json?
  energyContext String?
  habitsContext String?
  algorithms    Algorithm[] @relation("AlgorithmReflection")
  sessionId     Int?
  session       Session?    @relation(fields: [sessionId], references: [id])
  createdAt     DateTime    @default(now())

  @@unique([userId, date])
}
```

- [ ] **Step 6: Add subScores and assessmentType to existing BalanceRating model (line ~153)**

Add after `createdAt` field (line 160):
```prisma
  subScores      Json?
  assessmentType String   @default("subjective")

  @@index([userId, area, createdAt])
```

- [ ] **Step 7: Add relations to User model (lines 10-25)**

Add after existing relations in User model:
```prisma
  mission       Mission?
  balanceGoals  BalanceGoal[]
  goals         Goal[]
  algorithms    Algorithm[]
  reflections   Reflection[]
```

- [ ] **Step 8: Add relation to Session model**

Add to Session model:
```prisma
  reflections   Reflection[]
```

- [ ] **Step 9: Run prisma generate and verify**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 10: Run build to verify no TS errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Personal OS models — Mission, Goal, BalanceGoal, Algorithm, Reflection"
```

---

## Chunk 2: Rename Diagnostics Endpoint

### Task 2: Rename /api/kaizen to /api/diagnostics

**Files:**
- Rename: `src/api/kaizen.ts` → `src/api/diagnostics.ts`
- Modify: `src/server.ts` (line 37 — import and registration)
- Modify: `src/handlers/kaizen.ts` (line 29, 33 — API URL)
- Test: `src/__tests__/diagnostics.test.ts`

- [ ] **Step 1: Write test for renamed endpoint**

Create `src/__tests__/diagnostics-rename.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("diagnostics endpoint rename", () => {
  it("should export kaizenRoute as diagnosticsRoute", async () => {
    const mod = await import("../api/diagnostics");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/diagnostics-rename.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Rename the file**

```bash
mv src/api/kaizen.ts src/api/diagnostics.ts
```

- [ ] **Step 4: Update route path inside diagnostics.ts**

In `src/api/diagnostics.ts`, change the route path (line 5):
```typescript
// Old:
router.get("/kaizen", async (req, res) => {
// New:
router.get("/diagnostics", async (req, res) => {
```

- [ ] **Step 5: Update server.ts import and registration**

In `src/server.ts`, change line 6 (import) and line 37 (registration):
```typescript
// Old import:
import kaizenRoute from "./api/kaizen";
// New import:
import diagnosticsRoute from "./api/diagnostics";

// Old registration (line 37):
kaizenRoute(apiRouter);
// New registration:
diagnosticsRoute(apiRouter);
```

- [ ] **Step 6: Update bot handler API URL**

In `src/handlers/kaizen.ts`, update the fetch URLs (lines 29 and 33):
```typescript
// Old:
const url = `${baseUrl}/api/kaizen`;
// and fallback:
const url = `http://localhost:${port}/api/kaizen`;

// New:
const url = `${baseUrl}/api/diagnostics`;
// and fallback:
const url = `http://localhost:${port}/api/diagnostics`;
```

- [ ] **Step 7: Update existing diagnostics test if present**

In `src/__tests__/diagnostics.test.ts`, update any import paths from `../api/kaizen` to `../api/diagnostics`.

- [ ] **Step 8: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 9: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: rename /api/kaizen to /api/diagnostics — free route for kaizen features"
```

---

## Chunk 3: Parameterized Router

### Task 3: Extend router to support parameterized routes

**Files:**
- Modify: `src/mini-app/router.ts`
- Test: `src/__tests__/router.test.ts`

- [ ] **Step 1: Write router parsing tests**

Create `src/__tests__/router.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseRoute } from "../mini-app/router";

describe("parseRoute", () => {
  it("parses simple route", () => {
    expect(parseRoute("#hub")).toEqual({ route: "hub", param: undefined });
  });

  it("parses route with param", () => {
    expect(parseRoute("#balance/health")).toEqual({ route: "balance", param: "health" });
  });

  it("parses kaizen with numeric param", () => {
    expect(parseRoute("#kaizen/42")).toEqual({ route: "kaizen", param: "42" });
  });

  it("parses balance/strategy", () => {
    expect(parseRoute("#balance/strategy")).toEqual({ route: "balance", param: "strategy" });
  });

  it("defaults to hub for empty hash", () => {
    expect(parseRoute("")).toEqual({ route: "hub", param: undefined });
    expect(parseRoute("#")).toEqual({ route: "hub", param: undefined });
  });

  it("defaults to hub for unknown route", () => {
    expect(parseRoute("#unknown")).toEqual({ route: "hub", param: undefined });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/router.test.ts`
Expected: FAIL — parseRoute not exported

- [ ] **Step 3: Rewrite router.ts with parameterized support**

Replace entire `src/mini-app/router.ts`:
```typescript
import { signal, computed } from "@preact/signals";

export type Route = "hub" | "energy" | "habits" | "balance" | "kaizen";

const VALID_ROUTES: Route[] = ["hub", "energy", "habits", "balance", "kaizen"];

export interface ParsedRoute {
  route: Route;
  param?: string;
}

export function parseRoute(hash: string): ParsedRoute {
  const raw = hash.replace(/^#\/?/, "");
  if (!raw) return { route: "hub", param: undefined };

  const [first, ...rest] = raw.split("/");
  const route = VALID_ROUTES.includes(first as Route) ? (first as Route) : "hub";
  const param = rest.length > 0 ? rest.join("/") : undefined;

  return { route, param };
}

export const currentParsedRoute = signal<ParsedRoute>({ route: "hub", param: undefined });

export const currentRoute = computed<Route>(() => currentParsedRoute.value.route);
export const currentParam = computed<string | undefined>(() => currentParsedRoute.value.param);

export function navigate(route: Route, param?: string) {
  const hash = param ? `#${route}/${param}` : `#${route}`;
  window.location.hash = hash;
}

export function initRouter() {
  const update = () => {
    currentParsedRoute.value = parseRoute(window.location.hash);
  };
  window.addEventListener("hashchange", update);
  update();
}
```

- [ ] **Step 4: Run router tests**

Run: `npx vitest run src/__tests__/router.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Update app.tsx to use new router exports**

In `src/mini-app/app.tsx`, update imports and route matching:
```typescript
import { currentRoute, currentParam, initRouter } from "./router";
// ... existing imports ...

// In the component, replace route matching:
// Old: currentRoute.value === "journal"
// New: remove journal, add balance and kaizen

export function App() {
  useEffect(() => { initRouter(); }, []);

  const route = currentRoute.value;
  const param = currentParam.value;

  return (
    <div class="app">
      {route === "hub" && <Hub />}
      {route === "energy" && <EnergyDashboard />}
      {route === "habits" && <HabitsScreen />}
      {route === "balance" && <BalanceScreen param={param} />}
      {route === "kaizen" && <KaizenScreen param={param} />}
      <BottomNav />
    </div>
  );
}
```

Note: BalanceScreen and KaizenScreen don't exist yet — create stubs in next tasks.

- [ ] **Step 6: Run build to check for remaining references to old router**

Run: `grep -r "journal" src/mini-app/ --include="*.ts" --include="*.tsx" -l`

Update any files that reference the "journal" route to use "kaizen" instead. Key files:
- `src/mini-app/components/shared/BottomNav.tsx`
- Any component that calls `navigate("journal")`

- [ ] **Step 7: Commit**

```bash
git add src/mini-app/router.ts src/__tests__/router.test.ts
git commit -m "feat: parameterized router — support #balance/health, #kaizen/42"
```

---

## Chunk 4: 5-Tab Navigation + Stub Screens

### Task 4: Update BottomNav to 5 tabs

**Files:**
- Modify: `src/mini-app/components/shared/BottomNav.tsx`

- [ ] **Step 1: Replace nav items array**

In `src/mini-app/components/shared/BottomNav.tsx`, replace the items array (lines 10-15):
```typescript
const items: { route: Route; icon: string; label: string }[] = [
  { route: "hub", icon: "🏠", label: "Главная" },
  { route: "balance", icon: "⚖️", label: "Баланс" },
  { route: "habits", icon: "⚡", label: "Привычки" },
  { route: "kaizen", icon: "🧠", label: "Кайдзен" },
  { route: "energy", icon: "🔋", label: "Энергия" },
];
```

- [ ] **Step 2: Update import to use Route type from new router**

```typescript
import { currentRoute, navigate, Route } from "../../router";
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/components/shared/BottomNav.tsx
git commit -m "feat: 5-tab navigation — Balance and Kaizen tabs"
```

### Task 5: Create stub BalanceScreen component

**Files:**
- Create: `src/mini-app/components/balance/BalanceScreen.tsx`

- [ ] **Step 1: Create BalanceScreen stub**

Create `src/mini-app/components/balance/BalanceScreen.tsx`:
```typescript
interface BalanceScreenProps {
  param?: string;
}

export function BalanceScreen({ param }: BalanceScreenProps) {
  // param routing: undefined = main, "strategy" = mission & goals, "health" etc = area detail
  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
      </header>
      <main class="views">
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text2)" }}>
          Колесо баланса скоро появится
          {param && <div style={{ marginTop: 8, fontSize: 13 }}>Раздел: {param}</div>}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/balance/BalanceScreen.tsx
git commit -m "feat: BalanceScreen stub component"
```

### Task 6: Create stub KaizenScreen with migrated Observations

**Files:**
- Create: `src/mini-app/components/kaizen/KaizenScreen.tsx`
- Create: `src/mini-app/store/kaizen.ts`
- Modify: `src/mini-app/api/client.ts` (no changes needed — observations() already exists)

- [ ] **Step 1: Create kaizen store**

Create `src/mini-app/store/kaizen.ts`:
```typescript
import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { Observation } from "../api/types";

export const kaizenObservations = signal<Observation[]>([]);
export const kaizenLoading = signal(false);
export const kaizenError = signal(false);

export async function loadKaizenData() {
  kaizenLoading.value = true;
  kaizenError.value = false;
  try {
    const data = await api.observations();
    kaizenObservations.value = data.observations;
  } catch {
    kaizenError.value = true;
  } finally {
    kaizenLoading.value = false;
  }
}
```

- [ ] **Step 2: Create KaizenScreen component**

Create `src/mini-app/components/kaizen/KaizenScreen.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { kaizenObservations, kaizenLoading, kaizenError, loadKaizenData } from "../../store/kaizen";
import { haptic, getTelegramBotUsername } from "../../telegram";

interface KaizenScreenProps {
  param?: string;
}

export function KaizenScreen({ param }: KaizenScreenProps) {
  useEffect(() => { loadKaizenData(); }, []);

  // TODO: param === algorithmId → AlgorithmDetail screen (Phase 3)

  const handleAskAI = () => {
    haptic("medium");
    const botUsername = getTelegramBotUsername();
    if (botUsername) {
      window.open(`https://t.me/${botUsername}`, "_blank");
    }
  };

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

        {/* Algorithms placeholder */}
        <div style={{ padding: "20px", textAlign: "center", color: "var(--text2)", fontSize: "13px" }}>
          📂 Библиотека алгоритмов появится после первой рефлексии
        </div>

        {/* Observations — migrated from Journal */}
        <div class="section-title">👁 Наблюдения</div>
        {kaizenLoading.value && <div style={{ textAlign: "center", color: "var(--text2)", padding: 20 }}>Загрузка...</div>}
        {kaizenError.value && <div style={{ textAlign: "center", color: "var(--text2)", padding: 20 }}>Ошибка загрузки</div>}
        {!kaizenLoading.value && kaizenObservations.value.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text2)", padding: 20, fontSize: 13 }}>
            Наблюдения появятся после чекинов энергии
          </div>
        )}
        {kaizenObservations.value.map((obs) => (
          <div key={obs.id} class="observation-card">
            <div class="observation-meta">
              {obs.createdAt && new Date(obs.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              {" · "}
              {obs.energyType === "physical" ? "🦾" : obs.energyType === "mental" ? "🧬" : obs.energyType === "emotional" ? "🫀" : "🔮"}
              {" "}
              {obs.direction === "drop" ? "↓" : obs.direction === "rise" ? "↑" : "→"}
            </div>
            {obs.trigger && <div class="observation-trigger">{obs.trigger}</div>}
            {obs.context && <div class="observation-context">{obs.context}</div>}
          </div>
        ))}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add CSS for kaizen screen elements**

Append to `src/mini-app/styles/global.css`:
```css
/* Kaizen Screen */
.kaizen-ask-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 12px;
  background: linear-gradient(135deg, rgba(200,255,115,0.1), rgba(200,255,115,0.03));
  border: 1px solid rgba(200,255,115,0.15);
  border-radius: var(--radius-sm);
  color: var(--accent); font-size: 14px; font-weight: 600;
  cursor: pointer; margin-bottom: 16px;
  font-family: inherit;
}
.kaizen-ask-btn:active { transform: scale(0.97); }
.section-title {
  font-size: 12px; font-weight: 600; color: var(--text3);
  text-transform: uppercase; letter-spacing: 1px;
  margin: 16px 0 8px; padding: 0 4px;
}
.observation-card {
  background: var(--surface); border: 1px solid var(--surface-border);
  border-radius: var(--radius-xs); padding: 12px; margin-bottom: 8px;
}
.observation-meta { font-size: 11px; color: var(--text3); margin-bottom: 4px; }
.observation-trigger { font-size: 13px; color: var(--text); margin-bottom: 2px; }
.observation-context { font-size: 12px; color: var(--text2); line-height: 1.4; }
```

- [ ] **Step 4: Check if getTelegramBotUsername exists in telegram.ts**

If not, add to `src/mini-app/telegram.ts`:
```typescript
export function getTelegramBotUsername(): string | null {
  try {
    // Bot username from Telegram.WebApp.initDataUnsafe
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user ? "energy_coach_bot" : null;
  } catch {
    return null;
  }
}
```

Note: Replace `"energy_coach_bot"` with the actual bot username from config or env.

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/components/kaizen/ src/mini-app/store/kaizen.ts src/mini-app/styles/global.css
git commit -m "feat: KaizenScreen with migrated Observations from Journal"
```

### Task 7: Update app.tsx with new imports and routes

**Files:**
- Modify: `src/mini-app/app.tsx`

- [ ] **Step 1: Update app.tsx**

Replace `src/mini-app/app.tsx`:
```typescript
import { useEffect } from "preact/hooks";
import { currentRoute, currentParam, initRouter } from "./router";
import { Hub } from "./components/hub/Hub";
import { EnergyDashboard } from "./components/energy/EnergyDashboard";
import { HabitsScreen } from "./components/habits/HabitsScreen";
import { BalanceScreen } from "./components/balance/BalanceScreen";
import { KaizenScreen } from "./components/kaizen/KaizenScreen";
import { BottomNav } from "./components/shared/BottomNav";

export function App() {
  useEffect(() => { initRouter(); }, []);

  const route = currentRoute.value;
  const param = currentParam.value;

  return (
    <div class="app">
      {route === "hub" && <Hub />}
      {route === "energy" && <EnergyDashboard />}
      {route === "habits" && <HabitsScreen />}
      {route === "balance" && <BalanceScreen param={param} />}
      {route === "kaizen" && <KaizenScreen param={param} />}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/app.tsx
git commit -m "feat: wire up Balance and Kaizen screens in app router"
```

---

## Chunk 5: Hub Widgets (Balance + Kaizen stubs)

### Task 8: Create BalanceCard widget for Hub

**Files:**
- Create: `src/mini-app/components/hub/BalanceCard.tsx`

- [ ] **Step 1: Create BalanceCard stub**

Create `src/mini-app/components/hub/BalanceCard.tsx`:
```typescript
import { navigate } from "../../router";
import { haptic } from "../../telegram";

export function BalanceCard() {
  const handleClick = () => {
    haptic("light");
    navigate("balance");
  };

  // Phase 2 will load real data from /api/balance
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
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/hub/BalanceCard.tsx
git commit -m "feat: BalanceCard hub widget (stub)"
```

### Task 9: Create KaizenCard widget for Hub

**Files:**
- Create: `src/mini-app/components/hub/KaizenCard.tsx`

- [ ] **Step 1: Create KaizenCard stub**

Create `src/mini-app/components/hub/KaizenCard.tsx`:
```typescript
import { navigate } from "../../router";
import { haptic } from "../../telegram";

export function KaizenCard() {
  const handleClick = () => {
    haptic("light");
    navigate("kaizen");
  };

  // Phase 3 will show reflection status + algorithm chips
  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">🧠 Кайдзен</span>
      </div>
      <div class="hub-card-empty">
        После первой рефлексии здесь появятся алгоритмы
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/components/hub/KaizenCard.tsx
git commit -m "feat: KaizenCard hub widget (stub)"
```

### Task 10: Update Hub to include all 4 widgets

**Files:**
- Modify: `src/mini-app/components/hub/Hub.tsx`

- [ ] **Step 1: Add imports and replace placeholder comments**

In `src/mini-app/components/hub/Hub.tsx`, add imports:
```typescript
import { BalanceCard } from "./BalanceCard";
import { KaizenCard } from "./KaizenCard";
```

Replace the hub-grid contents (lines 32-37):
```tsx
<div class="hub-grid">
  <EnergyCard />
  <BalanceCard />
  <HabitsCard />
  <KaizenCard />
</div>
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/components/hub/Hub.tsx
git commit -m "feat: Hub with 4 widgets — Energy, Balance, Habits, Kaizen"
```

---

## Chunk 6: Cleanup + Verification

### Task 11: Remove Journal tab references

**Files:**
- Delete or keep: `src/mini-app/components/journal/Journal.tsx` (keep for reference, remove from routing)

- [ ] **Step 1: Verify no remaining "journal" route references**

Run: `grep -rn '"journal"' src/mini-app/ --include="*.ts" --include="*.tsx"`

Any hits should be:
- Old imports or navigate("journal") calls → change to navigate("kaizen")
- The Journal.tsx component itself → leave it (not imported anywhere now)

- [ ] **Step 2: Fix any remaining references**

Update each found reference to use "kaizen" instead of "journal".

- [ ] **Step 3: Final build + test**

Run: `npm run build && npm test`
Expected: Both succeed

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove journal route references, complete Phase 1 foundation"
```

---

## Summary

After Phase 1 completion, the app has:
- ✅ 5 new DB models ready for data (Mission, Goal, BalanceGoal, Algorithm, Reflection)
- ✅ BalanceRating extended with subScores + assessmentType
- ✅ `/api/diagnostics` (renamed from `/api/kaizen`)
- ✅ Parameterized router supporting `#balance/health`, `#kaizen/42`
- ✅ 5-tab navigation: 🏠 ⚖️ ⚡ 🧠 🔋
- ✅ Hub with 4 widgets (Balance + Kaizen as stubs)
- ✅ KaizenScreen with migrated Observations from Journal
- ✅ BalanceScreen stub ready for Phase 2
- ✅ Journal tab removed from navigation

**Next:** Phase 2 (Balance) implements radar chart, balance assessment API, bot tools.
