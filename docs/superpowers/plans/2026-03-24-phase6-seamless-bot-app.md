# Phase 6: Seamless Bot ↔ App — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mini App a full participant — in-app energy checkin, in-app balance rating, remove all Telegram redirects, fix daily UX friction.

**Architecture:** Extract shared energy analysis from bot handler into service. Add new API endpoints for in-app actions. Build overlay components in Preact. Fix HabitCard tap behavior. Add data sync via Telegram WebApp `activated` event.

**Tech Stack:** Preact + @preact/signals, Express, Prisma, grammy, Telegram Mini App SDK

**Spec:** `docs/superpowers/specs/2026-03-24-v2-improvements-design.md` (sections 6.1–6.6)

---

## File Structure

### New files:
- `src/services/energy-analysis.ts` — severity analysis, trigger mapping, recommendations (extracted from checkin.ts)
- `src/api/energy.ts` — POST /api/energy, POST /api/energy/:logId/triggers, GET /api/config
- `src/mini-app/components/energy/EnergyCheckinOverlay.tsx` — fullscreen overlay with 4 sliders
- `src/mini-app/components/energy/TriggerPicker.tsx` — preset trigger buttons + custom input
- `src/mini-app/components/balance/BalanceRateOverlay.tsx` — 8 area sliders overlay
- `src/__tests__/energy-api.test.ts` — tests for new energy API
- `src/__tests__/energy-analysis.test.ts` — tests for extracted analysis service

### Modified files:
- `src/handlers/checkin.ts` — import from energy-analysis.ts instead of inline logic
- `src/server.ts` — register new energy routes
- `src/config.ts` — add botUsername
- `src/mini-app/api/client.ts` — add new API methods
- `src/mini-app/api/types.ts` — add new response types
- `src/mini-app/components/energy/EnergyDashboard.tsx` — replace triggerCheckin with overlay
- `src/mini-app/components/balance/BalanceScreen.tsx` — replace bot redirect with overlay
- `src/mini-app/components/habits/HabitCard.tsx` — single tap = complete, remove time sheet
- `src/mini-app/store/energy.ts` — add reload function
- `src/mini-app/store/balance.ts` — add reload function
- `src/mini-app/telegram.ts` — add onActivated listener, openTelegramLink helper
- `src/mini-app/app.tsx` — add activated listener for data sync
- `src/mini-app/components/kaizen/AlgorithmDetail.tsx` — replace getBotUsername with openTelegramLink

---

## Task 1: Extract Energy Analysis Service

Extract severity analysis, trigger mapping, and recommendations from `src/handlers/checkin.ts` into a shared service that both bot handler and API can use.

**Files:**
- Create: `src/services/energy-analysis.ts`
- Create: `src/__tests__/energy-analysis.test.ts`
- Modify: `src/handlers/checkin.ts`

- [ ] **Step 1: Write tests for energy analysis service**

Create `src/__tests__/energy-analysis.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getSeverity, getTriggersForSeverity, analyzeSeverity } from "../services/energy-analysis.js";

describe("energy-analysis", () => {
  describe("getSeverity", () => {
    it("returns critical when drop >= 4", () => {
      expect(getSeverity(3, 7)).toBe("critical");
    });

    it("returns critical when level <= 3 and drop >= 3", () => {
      expect(getSeverity(2, 5)).toBe("critical");
    });

    it("returns moderate when drop 2-3", () => {
      expect(getSeverity(5, 7)).toBe("moderate");
    });

    it("returns improved when rise >= 2", () => {
      expect(getSeverity(8, 6)).toBe("improved");
    });

    it("returns stable when no significant change", () => {
      expect(getSeverity(7, 7)).toBe("stable");
    });

    it("returns mild when drop is 1", () => {
      expect(getSeverity(6, 7)).toBe("mild");
    });
  });

  describe("getTriggersForSeverity", () => {
    it("returns critical triggers for critical severity", () => {
      const triggers = getTriggersForSeverity("critical", "physical");
      expect(triggers).toContain("Не спал");
      expect(triggers.length).toBeGreaterThan(0);
    });

    it("returns improved triggers for improved severity", () => {
      const triggers = getTriggersForSeverity("improved", "mental");
      expect(triggers).toContain("Медитация");
    });
  });

  describe("analyzeSeverity", () => {
    it("detects critical drops", () => {
      const current = { physical: 3, mental: 7, emotional: 7, spiritual: 7 };
      const previous = { physical: 8, mental: 7, emotional: 7, spiritual: 7 };
      const result = analyzeSeverity(current, previous);
      expect(result.drops.length).toBe(1);
      expect(result.drops[0].type).toBe("physical");
      expect(result.drops[0].severity).toBe("critical");
    });

    it("detects improvements", () => {
      const current = { physical: 8, mental: 7, emotional: 7, spiritual: 7 };
      const previous = { physical: 5, mental: 7, emotional: 7, spiritual: 7 };
      const result = analyzeSeverity(current, previous);
      expect(result.improvements.length).toBe(1);
      expect(result.improvements[0].type).toBe("physical");
    });

    it("returns empty when no previous data", () => {
      const current = { physical: 5, mental: 5, emotional: 5, spiritual: 5 };
      const result = analyzeSeverity(current, null);
      expect(result.drops.length).toBe(0);
      expect(result.improvements.length).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/energy-analysis.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create energy-analysis.ts**

Create `src/services/energy-analysis.ts` — extract `getSeverity`, trigger constants, and `analyzeSeverity` from `src/handlers/checkin.ts:62-97` and `274-296`:

```typescript
export type Severity = "critical" | "moderate" | "mild" | "stable" | "improved";

export interface EnergyValues {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
}

export interface SeverityChange {
  type: string;
  severity: Severity;
  current: number;
  prev: number;
  drop: number;
}

export interface SeverityResult {
  drops: SeverityChange[];
  improvements: SeverityChange[];
  stable: boolean;
}

export function getSeverity(current: number, previous: number): Severity {
  const drop = previous - current;
  if (current <= 3 && drop >= 3) return "critical";
  if (drop >= 4) return "critical";
  if (current <= 3 && drop >= 1) return "moderate";
  if (drop >= 2) return "moderate";
  if (drop === 1) return "mild";
  if (drop <= -2) return "improved";
  return "stable";
}

export const CRITICAL_TRIGGERS: Record<string, string[]> = {
  physical: ["Не спал", "Болезнь", "Перетренировка", "Голод", "Алкоголь"],
  mental: ["Выгорание", "Дедлайн", "Инфо-перегрузка", "Конфликт на работе"],
  emotional: ["Ссора", "Потеря", "Одиночество", "Тревога", "Подавленность"],
  spiritual: ["Всё бесполезно", "Кризис смысла", "Выгорание", "Пустота"],
};

export const MODERATE_TRIGGERS: Record<string, string[]> = {
  physical: ["Плохой сон", "Нет движения", "Плохая еда", "Устал"],
  mental: ["Долго за экраном", "Много задач", "Нет фокуса"],
  emotional: ["Конфликт", "Одиночество", "Стресс"],
  spiritual: ["Потеря смысла", "Рутина", "Нет прогресса"],
};

export const IMPROVED_TRIGGERS: Record<string, string[]> = {
  physical: ["Хороший сон", "Тренировка", "Здоровая еда", "Прогулка"],
  mental: ["Отдых от экранов", "Медитация", "Интересная задача"],
  emotional: ["Хорошее общение", "Смех", "Природа"],
  spiritual: ["Помог кому-то", "Осмысленная работа", "Благодарность"],
};

export function getTriggersForSeverity(severity: Severity, energyType: string): string[] {
  const map: Record<string, Record<string, string[]>> = {
    critical: CRITICAL_TRIGGERS,
    moderate: MODERATE_TRIGGERS,
    improved: IMPROVED_TRIGGERS,
  };
  return map[severity]?.[energyType] || [];
}

export function analyzeSeverity(
  current: EnergyValues,
  previous: EnergyValues | null,
): SeverityResult {
  if (!previous) return { drops: [], improvements: [], stable: true };

  const types = ["physical", "mental", "emotional", "spiritual"] as const;
  const drops: SeverityChange[] = [];
  const improvements: SeverityChange[] = [];

  for (const type of types) {
    const severity = getSeverity(current[type], previous[type]);
    const drop = previous[type] - current[type];
    if (severity === "critical" || severity === "moderate") {
      drops.push({ type, severity, current: current[type], prev: previous[type], drop });
    } else if (severity === "improved") {
      improvements.push({ type, severity, current: current[type], prev: previous[type], drop });
    }
  }

  return { drops, improvements, stable: drops.length === 0 && improvements.length === 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/energy-analysis.test.ts`
Expected: PASS

- [ ] **Step 5: Refactor checkin.ts to import from energy-analysis.ts**

In `src/handlers/checkin.ts`:
- Remove inline `getSeverity` function (lines ~65-74)
- Remove `CRITICAL_TRIGGERS`, `MODERATE_TRIGGERS`, `IMPROVED_TRIGGERS` constants (lines ~78-97)
- Add import: `import { getSeverity, getTriggersForSeverity, CRITICAL_TRIGGERS, MODERATE_TRIGGERS, IMPROVED_TRIGGERS } from "../services/energy-analysis.js";`
- Remove `type Severity = ...` line
- Keep all bot-specific logic (keyboards, callbacks, pending state)

- [ ] **Step 6: Run full test suite to verify nothing broke**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
git add src/services/energy-analysis.ts src/__tests__/energy-analysis.test.ts src/handlers/checkin.ts
git commit -m "refactor: extract energy analysis into shared service"
```

---

## Task 2: Energy API Endpoints

Create POST /api/energy and POST /api/energy/:logId/triggers for in-app checkin.

**Files:**
- Create: `src/api/energy.ts`
- Create: `src/__tests__/energy-api.test.ts`
- Modify: `src/server.ts`
- Modify: `src/config.ts`

- [ ] **Step 1: Write tests for energy API**

Create `src/__tests__/energy-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("../db.js", () => ({
  default: {
    energyLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    observation: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, timezone: "Asia/Shanghai" }),
    },
  },
}));

import prisma from "../db.js";

describe("energy API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates energy log with valid data", async () => {
    const { createEnergyLog } = await import("../api/energy.js");
    const result = await createEnergyLog(1, {
      physical: 7, mental: 6, emotional: 8, spiritual: 5, logType: "manual",
    });
    expect(result.logId).toBe(1);
    expect(prisma.energyLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ physical: 7, mental: 6, emotional: 8, spiritual: 5 }),
      }),
    );
  });

  it("rejects invalid energy values", async () => {
    const { createEnergyLog } = await import("../api/energy.js");
    await expect(createEnergyLog(1, {
      physical: 11, mental: 6, emotional: 8, spiritual: 5, logType: "manual",
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/energy-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Create energy API route**

Create `src/api/energy.ts`:

```typescript
import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { analyzeSeverity, getTriggersForSeverity } from "../services/energy-analysis.js";
import { getInstantRecommendations, type EnergyValues } from "../services/instant-recommendations.js";
import { config } from "../config.js";

interface CreateEnergyInput {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
  logType: string;
}

export async function createEnergyLog(userId: number, input: CreateEnergyInput) {
  const { physical, mental, emotional, spiritual, logType } = input;

  // Validate
  for (const val of [physical, mental, emotional, spiritual]) {
    if (!Number.isInteger(val) || val < 1 || val > 10) {
      throw new Error("Energy values must be integers 1-10");
    }
  }

  // Dedup: update if <5min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentLog = await prisma.energyLog.findFirst({
    where: { userId, createdAt: { gte: fiveMinAgo } },
    orderBy: { createdAt: "desc" },
  });

  let logId: number;
  if (recentLog) {
    await prisma.energyLog.update({
      where: { id: recentLog.id },
      data: { physical, mental, emotional, spiritual, logType },
    });
    logId = recentLog.id;
  } else {
    const newLog = await prisma.energyLog.create({
      data: { userId, physical, mental, emotional, spiritual, logType },
    });
    logId = newLog.id;
  }

  // Severity analysis — find previous same-slot checkin
  const current: EnergyValues = { physical, mental, emotional, spiritual };
  const previousLog = await prisma.energyLog.findFirst({
    where: {
      userId,
      logType,
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });

  const previous: EnergyValues | null = previousLog
    ? { physical: previousLog.physical, mental: previousLog.mental, emotional: previousLog.emotional, spiritual: previousLog.spiritual }
    : null;

  const severity = analyzeSeverity(current, previous);

  // Recommendations for drops
  const hasDrops = severity.drops.length > 0;
  let recommendations: Array<{ name: string; duration: number }> = [];
  if (hasDrops) {
    const recResult = getInstantRecommendations(current, undefined, undefined);
    recommendations = recResult.recommendations.slice(0, 5).map(r => ({ name: r.name, duration: r.duration }));
  }

  // Build trigger info for worst change
  let triggerInfo: { energyType: string; direction: string; triggers: string[] } | null = null;
  if (severity.drops.length > 0) {
    const worst = severity.drops.sort((a, b) => b.drop - a.drop)[0];
    triggerInfo = {
      energyType: worst.type,
      direction: "drop",
      triggers: getTriggersForSeverity(worst.severity, worst.type),
    };
  } else if (severity.improvements.length > 0) {
    const best = severity.improvements.sort((a, b) => a.drop - b.drop)[0];
    triggerInfo = {
      energyType: best.type,
      direction: "rise",
      triggers: getTriggersForSeverity("improved", best.type),
    };
  }

  return { logId, severity, recommendations, triggerInfo };
}

export function energyRoute(router: Router): void {
  // POST /api/energy — create energy log from Mini App
  router.post("/energy", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    try {
      const result = await createEnergyLog(userId, req.body);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("1-10")) {
        res.status(400).json({ error: err.message });
      } else {
        console.error("Energy API error:", err);
        res.status(500).json({ error: "internal_error" });
      }
    }
  });

  // POST /api/energy/:logId/triggers — save triggers/observations
  router.post("/energy/:logId/triggers", async (req: Request, res: Response) => {
    const userId = (req as any).userId as number;
    const logId = parseInt(req.params.logId, 10);
    if (isNaN(logId)) { res.status(400).json({ error: "invalid_logId" }); return; }

    const { triggers, context, energyType, direction } = req.body as {
      triggers: string[];
      context?: string;
      energyType: string;
      direction: string;
    };

    if (!triggers || !Array.isArray(triggers) || triggers.length === 0) {
      res.status(400).json({ error: "triggers required" }); return;
    }

    try {
      const observationIds: number[] = [];
      for (const trigger of triggers) {
        const obs = await prisma.observation.create({
          data: {
            userId,
            energyType,
            direction,
            trigger,
            context: context || null,
            energyLogId: logId,
          },
        });
        observationIds.push(obs.id);
      }
      res.json({ ok: true, observationIds });
    } catch (err) {
      console.error("Triggers API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

}

// Separate public route (no auth) for config
export function configRoute(router: Router): void {
  router.get("/config", (_req: Request, res: Response) => {
    res.json({
      botUsername: config.botUsername,
      webappUrl: config.webappUrl,
    });
  });
}

```

- [ ] **Step 4: Add botUsername to config.ts**

In `src/config.ts`, add to config object:

```typescript
botUsername: process.env.BOT_USERNAME || "energy_coach_bot",
```

- [ ] **Step 5: Register route in server.ts**

In `src/server.ts`:
- Add import: `import { energyRoute, configRoute } from "./api/energy.js";`
- Add `configRoute(apiRouter);` after `diagnosticsRoute(apiRouter);` (public, no auth)
- Add `energyRoute(authedRouter);` after `strategyRoute(authedRouter);` (authed)

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/__tests__/energy-api.test.ts`
Expected: PASS

- [ ] **Step 7: Run build to verify compilation**

Run: `npm run build`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/api/energy.ts src/__tests__/energy-api.test.ts src/server.ts src/config.ts
git commit -m "feat: POST /api/energy + /api/energy/:logId/triggers + /api/config"
```

---

## Task 3: Mini App API Client & Types

Add new API methods and types to the Mini App client.

**Files:**
- Modify: `src/mini-app/api/types.ts`
- Modify: `src/mini-app/api/client.ts`

- [ ] **Step 1: Add types**

In `src/mini-app/api/types.ts`, add at the end:

```typescript
// --- Energy Checkin ---

export interface SeverityChange {
  type: string;
  severity: string;
  current: number;
  prev: number;
  drop: number;
}

export interface EnergyCheckinResponse {
  logId: number;
  severity: {
    drops: SeverityChange[];
    improvements: SeverityChange[];
    stable: boolean;
  };
  recommendations: Array<{ name: string; duration: number }>;
  triggerInfo: {
    energyType: string;
    direction: string;
    triggers: string[];
  } | null;
}

export interface AppConfig {
  botUsername: string;
  webappUrl: string;
}
```

- [ ] **Step 2: Add API methods**

In `src/mini-app/api/client.ts`, add to the `api` object:

```typescript
// Energy checkin
submitEnergy: (data: { physical: number; mental: number; emotional: number; spiritual: number; logType: string }) =>
  post<EnergyCheckinResponse>("/api/energy", data),
submitTriggers: (logId: number, data: { triggers: string[]; context?: string; energyType: string; direction: string }) =>
  post<{ ok: boolean; observationIds: number[] }>(`/api/energy/${logId}/triggers`, data),
// Balance quick rate
rateBalance: (ratings: Array<{ area: string; score: number; subScores?: Record<string, number> }>) =>
  post<{ ok: true; updated: number }>("/api/balance/rate", { ratings }),
// Config
config: () => request<AppConfig>("/api/config"),
```

Add imports for new types at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/api/types.ts src/mini-app/api/client.ts
git commit -m "feat: add energy checkin + balance rate + config to API client"
```

---

## Task 4: EnergyCheckinOverlay Component

Build the fullscreen overlay with 4 sliders for in-app energy checkin.

**Files:**
- Create: `src/mini-app/components/energy/EnergyCheckinOverlay.tsx`
- Create: `src/mini-app/components/energy/TriggerPicker.tsx`
- Modify: `src/mini-app/components/energy/EnergyDashboard.tsx`
- Modify: `src/mini-app/store/energy.ts`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Create EnergyCheckinOverlay**

Create `src/mini-app/components/energy/EnergyCheckinOverlay.tsx`:

```tsx
import { useState } from "preact/hooks";
import { api } from "../../api/client";
import { haptic, hapticSuccess } from "../../telegram";
import { TriggerPicker } from "./TriggerPicker";
import type { EnergyCheckinResponse } from "../../api/types";

interface Props {
  onClose: () => void;
  onComplete: () => void;
  initialValues?: { physical: number; mental: number; emotional: number; spiritual: number };
}

const TYPES = [
  { key: "physical" as const, emoji: "🦾", label: "Физическая", color: "var(--physical)" },
  { key: "mental" as const, emoji: "🧬", label: "Ментальная", color: "var(--mental)" },
  { key: "emotional" as const, emoji: "🫀", label: "Эмоциональная", color: "var(--emotional)" },
  { key: "spiritual" as const, emoji: "🔮", label: "Духовная", color: "var(--spiritual)" },
];

export function EnergyCheckinOverlay({ onClose, onComplete, initialValues }: Props) {
  const [values, setValues] = useState({
    physical: initialValues?.physical ?? 5,
    mental: initialValues?.mental ?? 5,
    emotional: initialValues?.emotional ?? 5,
    spiritual: initialValues?.spiritual ?? 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EnergyCheckinResponse | null>(null);
  const [triggersDone, setTriggersDone] = useState(false);

  const handleSlider = (key: keyof typeof values, val: number) => {
    haptic("light");
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    haptic("medium");
    try {
      const res = await api.submitEnergy({ ...values, logType: "manual" });
      setResult(res);
      hapticSuccess();
    } catch (err) {
      console.error("Checkin failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggersComplete = () => {
    setTriggersDone(true);
    onComplete();
  };

  // Show trigger picker after submit if there are drops/improvements
  if (result && result.triggerInfo && !triggersDone) {
    return (
      <TriggerPicker
        logId={result.logId}
        triggerInfo={result.triggerInfo}
        recommendations={result.recommendations}
        severity={result.severity}
        values={values}
        onDone={handleTriggersComplete}
      />
    );
  }

  // Show success and close if no triggers needed
  if (result && (!result.triggerInfo || triggersDone)) {
    return (
      <div class="checkin-overlay">
        <div class="checkin-overlay-content">
          <div class="checkin-success">
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2>Записано!</h2>
            <div class="checkin-result-grid">
              {TYPES.map(t => (
                <div key={t.key} class="checkin-result-item">
                  <span>{t.emoji}</span>
                  <span style={{ color: t.color, fontWeight: 600 }}>{values[t.key]}</span>
                </div>
              ))}
            </div>
            {result.severity.stable && <p style={{ color: "var(--text2)", marginTop: 8 }}>👍 Стабильно</p>}
            <button class="checkin-done-btn" onClick={() => { haptic("light"); onComplete(); }}>
              Готово
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Slider form
  return (
    <div class="checkin-overlay">
      <div class="checkin-overlay-content">
        <div class="checkin-header">
          <button class="checkin-close" onClick={onClose}>✕</button>
          <h2 class="checkin-title">Записать энергию</h2>
        </div>

        <div class="checkin-sliders">
          {TYPES.map(t => (
            <div key={t.key} class="checkin-slider-row">
              <div class="checkin-slider-label">
                <span>{t.emoji} {t.label}</span>
                <span class="checkin-slider-value" style={{ color: t.color }}>{values[t.key]}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={values[t.key]}
                class="checkin-slider"
                style={{ accentColor: t.color }}
                onInput={(e) => handleSlider(t.key, parseInt((e.target as HTMLInputElement).value))}
              />
              <div class="checkin-slider-scale">
                <span>1</span><span>5</span><span>10</span>
              </div>
            </div>
          ))}
        </div>

        <button
          class="checkin-submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Записываю..." : "⚡ Записать"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TriggerPicker**

Create `src/mini-app/components/energy/TriggerPicker.tsx`:

```tsx
import { useState } from "preact/hooks";
import { api } from "../../api/client";
import { haptic, hapticSuccess } from "../../telegram";
import type { EnergyCheckinResponse } from "../../api/types";

const ENERGY_LABELS: Record<string, string> = {
  physical: "физической", mental: "ментальной",
  emotional: "эмоциональной", spiritual: "духовной",
};

interface Props {
  logId: number;
  triggerInfo: NonNullable<EnergyCheckinResponse["triggerInfo"]>;
  recommendations: EnergyCheckinResponse["recommendations"];
  severity: EnergyCheckinResponse["severity"];
  values: { physical: number; mental: number; emotional: number; spiritual: number };
  onDone: () => void;
}

export function TriggerPicker({ logId, triggerInfo, recommendations, severity, values, onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const toggle = (trigger: string) => {
    haptic("light");
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(trigger)) next.delete(trigger); else next.add(trigger);
      return next;
    });
  };

  const addCustom = () => {
    if (!customText.trim()) return;
    haptic("light");
    setSelected(prev => new Set(prev).add(customText.trim()));
    setCustomText("");
    setShowCustom(false);
  };

  const handleDone = async () => {
    if (selected.size === 0) { onDone(); return; }
    if (!showContext) { setShowContext(true); return; }

    setSubmitting(true);
    haptic("medium");
    try {
      await api.submitTriggers(logId, {
        triggers: [...selected],
        context: context.trim() || undefined,
        energyType: triggerInfo.energyType,
        direction: triggerInfo.direction,
      });
      hapticSuccess();
    } catch (err) {
      console.error("Submit triggers failed:", err);
    }
    setSubmitting(false);
    onDone();
  };

  const question = triggerInfo.direction === "rise"
    ? `Что помогло ${ENERGY_LABELS[triggerInfo.energyType]}?`
    : `Почему ${ENERGY_LABELS[triggerInfo.energyType]} просела?`;

  // Context input step
  if (showContext) {
    return (
      <div class="checkin-overlay">
        <div class="checkin-overlay-content">
          <h2 class="checkin-title" style={{ marginBottom: 8 }}>Что произошло?</h2>
          <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 16 }}>
            Опиши ситуацию коротко — поможет найти паттерны
          </p>
          <textarea
            class="trigger-context-input"
            value={context}
            onInput={(e) => setContext((e.target as HTMLTextAreaElement).value)}
            placeholder="Например: не мог уснуть, листал телефон до 2 ночи"
            rows={3}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button class="trigger-skip-btn" onClick={() => { setContext(""); onDone(); }} style={{ flex: 1 }}>
              Пропустить
            </button>
            <button class="checkin-submit-btn" onClick={handleDone} disabled={submitting} style={{ flex: 1 }}>
              {submitting ? "..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="checkin-overlay">
      <div class="checkin-overlay-content">
        <h2 class="checkin-title" style={{ marginBottom: 16 }}>{question}</h2>

        {/* Severity summary */}
        <div class="trigger-severity-summary">
          {severity.drops.map(d => (
            <span key={d.type} class="trigger-change drop">{d.prev} → {d.current} (−{d.drop})</span>
          ))}
          {severity.improvements.map(d => (
            <span key={d.type} class="trigger-change rise">{d.prev} → {d.current} (+{-d.drop})</span>
          ))}
        </div>

        {/* Trigger buttons */}
        <div class="trigger-grid">
          {triggerInfo.triggers.map(t => (
            <button
              key={t}
              class={`trigger-btn${selected.has(t) ? " selected" : ""}`}
              onClick={() => toggle(t)}
            >
              {selected.has(t) && "✅ "}{t}
            </button>
          ))}
        </div>

        {/* Custom input */}
        {showCustom ? (
          <div class="trigger-custom">
            <input
              class="form-input"
              value={customText}
              onInput={(e) => setCustomText((e.target as HTMLInputElement).value)}
              placeholder="Своя причина"
              onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
            />
            <button class="trigger-custom-add" onClick={addCustom}>+</button>
          </div>
        ) : (
          <button class="trigger-custom-btn" onClick={() => { haptic("light"); setShowCustom(true); }}>
            ✍️ Свой вариант
          </button>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div class="trigger-recommendations">
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>⚡ Рекомендации:</div>
            {recommendations.slice(0, 3).map((r, i) => (
              <div key={i} class="trigger-rec-item">→ {r.name}, {r.duration} мин</div>
            ))}
          </div>
        )}

        {/* Done */}
        <button class="checkin-submit-btn" onClick={handleDone} disabled={submitting}>
          {selected.size === 0 ? "Пропустить" : `Готово (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update EnergyDashboard to use overlay**

In `src/mini-app/components/energy/EnergyDashboard.tsx`:

Replace the `checkinState` signal and `handleCheckin` function and the `<button class="quick-checkin-btn">` with:

```tsx
import { EnergyCheckinOverlay } from "./EnergyCheckinOverlay";
import { resetEnergyCache } from "../../store/energy";

const showCheckin = signal(false);

// ... inside EnergyDashboard component:

const handleCheckinComplete = () => {
  showCheckin.value = false;
  resetEnergyCache();
  loadInitialData();
};

// In JSX, replace the quick-checkin-btn with:
<button class="quick-checkin-btn" onClick={() => { haptic("medium"); showCheckin.value = true; }}>
  ⚡ Записать энергию
</button>

{showCheckin.value && (
  <EnergyCheckinOverlay
    onClose={() => { showCheckin.value = false; }}
    onComplete={handleCheckinComplete}
    initialValues={data ? { physical: data.physical, mental: data.mental, emotional: data.emotional, spiritual: data.spiritual } : undefined}
  />
)}
```

Also add to `src/mini-app/store/energy.ts`:

```typescript
export function resetEnergyCache(): void {
  loaded = false;
  dashboardData.value = null;
}
```

- [ ] **Step 4: Add CSS for overlays**

In `src/mini-app/styles/global.css`, add:

```css
/* --- Checkin Overlay --- */
.checkin-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: var(--bg); overflow-y: auto;
  animation: fadeIn 0.2s ease;
}
.checkin-overlay-content {
  padding: 20px; max-width: 440px; margin: 0 auto; min-height: 100vh;
  display: flex; flex-direction: column;
}
.checkin-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
}
.checkin-close {
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text2); width: 36px; height: 36px; border-radius: 50%;
  font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.checkin-title { font-size: 18px; font-weight: 700; }
.checkin-sliders { display: flex; flex-direction: column; gap: 24px; flex: 1; }
.checkin-slider-row { display: flex; flex-direction: column; gap: 6px; }
.checkin-slider-label {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 14px; font-weight: 500;
}
.checkin-slider-value { font-size: 20px; font-weight: 700; }
.checkin-slider {
  width: 100%; height: 6px; border-radius: 3px;
  -webkit-appearance: none; appearance: none;
  background: var(--surface); outline: none;
}
.checkin-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent); cursor: pointer; border: 2px solid var(--bg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.checkin-slider-scale {
  display: flex; justify-content: space-between;
  font-size: 11px; color: var(--text3); padding: 0 2px;
}
.checkin-submit-btn {
  background: var(--accent); color: #0c0d12; font-weight: 700;
  font-size: 16px; padding: 14px; border-radius: 14px;
  border: none; cursor: pointer; margin-top: 24px; width: 100%;
}
.checkin-submit-btn:disabled { opacity: 0.5; }
.checkin-success { text-align: center; padding-top: 80px; }
.checkin-result-grid {
  display: flex; gap: 16px; justify-content: center; margin-top: 16px;
}
.checkin-result-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-size: 13px;
}
.checkin-done-btn {
  background: var(--surface); color: var(--text); border: 1px solid var(--border);
  padding: 12px 32px; border-radius: 12px; font-size: 15px; margin-top: 32px;
  cursor: pointer;
}

/* --- Trigger Picker --- */
.trigger-severity-summary {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
}
.trigger-change {
  font-size: 12px; padding: 4px 8px; border-radius: 8px;
}
.trigger-change.drop { background: rgba(255,91,91,0.15); color: #ff5b5b; }
.trigger-change.rise { background: rgba(91,224,122,0.15); color: #5be07a; }
.trigger-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.trigger-btn {
  padding: 8px 14px; border-radius: 10px; font-size: 13px;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text); cursor: pointer; transition: all 0.15s;
}
.trigger-btn.selected {
  background: rgba(200,255,115,0.15); border-color: var(--accent);
  color: var(--accent);
}
.trigger-custom { display: flex; gap: 8px; margin-bottom: 16px; }
.trigger-custom .form-input { flex: 1; }
.trigger-custom-add {
  width: 40px; background: var(--accent); color: #0c0d12; border: none;
  border-radius: 10px; font-size: 18px; cursor: pointer;
}
.trigger-custom-btn {
  background: none; border: 1px dashed var(--border); color: var(--text2);
  padding: 8px 14px; border-radius: 10px; font-size: 13px; cursor: pointer;
  margin-bottom: 16px; width: 100%;
}
.trigger-context-input {
  width: 100%; padding: 12px; border-radius: 12px; font-size: 14px;
  background: var(--surface); border: 1px solid var(--border); color: var(--text);
  resize: none; font-family: inherit;
}
.trigger-skip-btn {
  background: var(--surface); color: var(--text2); border: 1px solid var(--border);
  padding: 14px; border-radius: 14px; font-size: 15px; cursor: pointer;
}
.trigger-recommendations { margin-bottom: 16px; }
.trigger-rec-item { font-size: 13px; color: var(--text2); margin-bottom: 4px; }
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/mini-app/components/energy/EnergyCheckinOverlay.tsx src/mini-app/components/energy/TriggerPicker.tsx src/mini-app/components/energy/EnergyDashboard.tsx src/mini-app/store/energy.ts src/mini-app/styles/global.css
git commit -m "feat: in-app energy checkin with sliders and trigger picker"
```

---

## Task 5: Balance Rate Overlay + API

In-app balance rating with 8 sliders, replacing the Telegram redirect.

**Files:**
- Modify: `src/api/balance.ts` — add POST /api/balance/rate
- Create: `src/mini-app/components/balance/BalanceRateOverlay.tsx`
- Modify: `src/mini-app/components/balance/BalanceScreen.tsx`
- Modify: `src/mini-app/store/balance.ts`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Add POST /api/balance/rate endpoint**

In `src/api/balance.ts`, add before the closing `}` of `balanceRoute`:

```typescript
// POST /api/balance/rate — bulk quick rating from Mini App
router.post("/balance/rate", async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { ratings } = req.body as { ratings: Array<{ area: string; score: number; subScores?: Record<string, number> }> };

  if (!ratings || !Array.isArray(ratings) || ratings.length === 0) {
    res.status(400).json({ error: "ratings array required" }); return;
  }

  try {
    let updated = 0;
    for (const r of ratings) {
      if (!LIFE_AREAS.includes(r.area as any)) continue;
      if (!Number.isInteger(r.score) || r.score < 1 || r.score > 10) continue;

      await prisma.balanceRating.create({
        data: {
          userId,
          area: r.area,
          score: r.score,
          subScores: r.subScores ?? undefined,
          assessmentType: "quick",
        },
      });
      updated++;
    }
    res.json({ ok: true, updated });
  } catch (err) {
    console.error("Balance rate API error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});
```

- [ ] **Step 2: Create BalanceRateOverlay**

Create `src/mini-app/components/balance/BalanceRateOverlay.tsx`:

```tsx
import { useState, useEffect } from "preact/hooks";
import { api } from "../../api/client";
import { haptic, hapticSuccess } from "../../telegram";
import type { BalanceAreaSummary } from "../../api/types";

const AREA_ORDER = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];

const AREA_META: Record<string, { icon: string; label: string }> = {
  health: { icon: "🩺", label: "Здоровье" },
  career: { icon: "🚀", label: "Карьера" },
  relationships: { icon: "💞", label: "Отношения" },
  finances: { icon: "💎", label: "Финансы" },
  family: { icon: "🏡", label: "Семья" },
  growth: { icon: "📚", label: "Развитие" },
  recreation: { icon: "🧘", label: "Отдых" },
  environment: { icon: "🌿", label: "Среда" },
};

interface Props {
  areas?: BalanceAreaSummary[];
  onClose: () => void;
  onComplete: () => void;
}

export function BalanceRateOverlay({ areas, onClose, onComplete }: Props) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from existing scores
  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const area of AREA_ORDER) {
      const existing = areas?.find(a => a.area === area);
      initial[area] = existing?.score ?? 5;
    }
    setValues(initial);
  }, [areas]);

  const handleSlider = (area: string, val: number) => {
    haptic("light");
    setValues(prev => ({ ...prev, [area]: val }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    haptic("medium");
    try {
      const ratings = AREA_ORDER.map(area => ({
        area,
        score: values[area] ?? 5,
      }));
      await api.rateBalance(ratings);
      hapticSuccess();
      onComplete();
    } catch (err) {
      console.error("Balance rate failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const scoreColor = (score: number) =>
    score <= 4 ? "#ff5b5b" : score <= 6 ? "#ffa85b" : "#5be07a";

  return (
    <div class="checkin-overlay">
      <div class="checkin-overlay-content">
        <div class="checkin-header">
          <button class="checkin-close" onClick={onClose}>✕</button>
          <h2 class="checkin-title">Оценить баланс</h2>
        </div>

        <div class="checkin-sliders">
          {AREA_ORDER.map(area => {
            const meta = AREA_META[area];
            const val = values[area] ?? 5;
            return (
              <div key={area} class="checkin-slider-row">
                <div class="checkin-slider-label">
                  <span>{meta.icon} {meta.label}</span>
                  <span class="checkin-slider-value" style={{ color: scoreColor(val) }}>{val}</span>
                </div>
                <input
                  type="range" min="1" max="10" value={val}
                  class="checkin-slider"
                  style={{ accentColor: scoreColor(val) }}
                  onInput={(e) => handleSlider(area, parseInt((e.target as HTMLInputElement).value))}
                />
                <div class="checkin-slider-scale">
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </div>
            );
          })}
        </div>

        <button class="checkin-submit-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Сохраняю..." : "Сохранить оценки"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update BalanceScreen to use overlay**

In `src/mini-app/components/balance/BalanceScreen.tsx`:

1. Add imports:
```tsx
import { BalanceRateOverlay } from "./BalanceRateOverlay";
import { resetBalanceCache } from "../../store/balance";
```
2. Add signal: `const showRate = signal(false);`
3. Replace `handleAssess` function body to open overlay instead of window.open:
```tsx
const handleAssess = () => {
  haptic("medium");
  showRate.value = true;
};
```
4. Add after closing `</main>`:
```tsx
{showRate.value && (
  <BalanceRateOverlay
    areas={overview?.areas}
    onClose={() => { showRate.value = false; }}
    onComplete={() => {
      showRate.value = false;
      resetBalanceCache();
      loadBalanceOverview();
    }}
  />
)}
```
5. Remove `getBotUsername` function at bottom of file.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/api/balance.ts src/mini-app/components/balance/BalanceRateOverlay.tsx src/mini-app/components/balance/BalanceScreen.tsx
git commit -m "feat: in-app balance rating with 8 sliders, remove Telegram redirect"
```

---

## Task 6: Bot Username Config + Data Sync

Fix hardcoded bot username and add data sync on app activation.

**Files:**
- Modify: `src/mini-app/components/kaizen/KaizenScreen.tsx`
- Modify: `src/mini-app/components/balance/StrategyScreen.tsx`
- Modify: `src/mini-app/telegram.ts`
- Modify: `src/mini-app/app.tsx`
- Modify: `src/mini-app/store/energy.ts`
- Modify: `src/mini-app/store/balance.ts`

- [ ] **Step 1: Add openTelegramLink and onActivated to telegram.ts**

In `src/mini-app/telegram.ts`, add:

```typescript
export function openTelegramLink(path: string): void {
  const url = `https://t.me/${path}`;
  try {
    // Use native Telegram method if available
    (tg as any)?.openTelegramLink?.(url);
  } catch {
    window.open(url, "_blank");
  }
}

export function onActivated(cb: () => void): void {
  tg?.onEvent("activated", cb);
}
```

- [ ] **Step 2: Replace getBotUsername in KaizenScreen.tsx**

In `src/mini-app/components/kaizen/KaizenScreen.tsx`:
- Remove `getBotUsername` function at bottom
- Replace `handleAskAI`:
```tsx
import { openTelegramLink } from "../../telegram";

const handleAskAI = () => {
  haptic("medium");
  openTelegramLink("energy_coach_bot");
};
```

- [ ] **Step 3: Replace getBotUsername in StrategyScreen.tsx**

In `src/mini-app/components/balance/StrategyScreen.tsx`:
- Remove `getBotUsername` function
- Replace `handleEditMission` and `handleSetGoals` to use `openTelegramLink`:
```tsx
import { openTelegramLink } from "../../telegram";

const handleEditMission = () => {
  haptic("medium");
  openTelegramLink("energy_coach_bot?text=" + encodeURIComponent("Хочу определить миссию"));
};

const handleSetGoals = () => {
  haptic("medium");
  openTelegramLink("energy_coach_bot?text=" + encodeURIComponent("Поставить цели"));
};
```

- [ ] **Step 4: Replace getBotUsername in AlgorithmDetail.tsx**

In `src/mini-app/components/kaizen/AlgorithmDetail.tsx`:
- Remove `getBotUsername` function
- Replace bot link with `openTelegramLink`:
```tsx
import { openTelegramLink } from "../../telegram";
// Where it opens bot link, replace with:
openTelegramLink("energy_coach_bot?text=" + encodeURIComponent("Расскажи про алгоритм"));
```

- [ ] **Step 5: Add data sync on app activation**

In `src/mini-app/app.tsx`:

```tsx
import { onActivated } from "./telegram";
import { resetEnergyCache, loadInitialData as loadEnergy } from "./store/energy";
import { resetBalanceCache, loadBalanceOverview } from "./store/balance";
import { loadHabits } from "./store/habits";

// Inside App component useEffect:
useEffect(() => {
  initTelegram();
  syncTheme();
  initRouter();

  // Reload data when returning from Telegram
  onActivated(() => {
    resetEnergyCache();
    loadEnergy();
    resetBalanceCache();
    loadBalanceOverview();
    loadHabits();
  });
}, []);
```

Make sure `resetEnergyCache` is exported from `src/mini-app/store/energy.ts` (added in Task 4).

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/mini-app/telegram.ts src/mini-app/app.tsx src/mini-app/components/kaizen/KaizenScreen.tsx src/mini-app/components/kaizen/AlgorithmDetail.tsx src/mini-app/components/balance/StrategyScreen.tsx src/mini-app/store/energy.ts src/mini-app/store/balance.ts
git commit -m "feat: remove hardcoded bot username, add data sync on app activation"
```

---

## Task 7: Time Sheet Fix + HabitDetail Accessibility

Single tap = complete now. Bigger touch target for detail arrow.

**Files:**
- Modify: `src/mini-app/components/habits/HabitCard.tsx`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Simplify HabitCard tap behavior**

In `src/mini-app/components/habits/HabitCard.tsx`:

1. Remove all time sheet related state and JSX:
   - Remove `showTimeSheet` state
   - Remove `selectedTime` state
   - Remove `nowTimeStr` function (if only used here)
   - Remove the entire time sheet overlay JSX block (lines ~236-258)
   - Remove `confirmComplete` function

2. Replace `handleTap` function:
```tsx
function handleTap() {
  if (done) {
    handleUncomplete();
    return;
  }
  if (isDuration) {
    if (inProgress) {
      handleCompleteDuration();
    } else {
      handleStartDuration();
    }
    return;
  }
  // Instant habit — complete NOW with current time
  haptic("medium");
  setCompleting(true);
  const now = new Date();
  const timeStr = `в ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  toggleComplete(habit, timeStr).then(() => {
    setCompleting(false);
    if (onCompleted) onCompleted(habit);
  });
}
```

3. Remove the `useState` imports for `showTimeSheet` and `selectedTime` (clean up unused).

- [ ] **Step 2: Increase detail arrow touch target**

In `src/mini-app/styles/global.css`, update `.habit-detail-arrow`:

```css
.habit-detail-arrow {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text3);
  cursor: pointer; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/components/habits/HabitCard.tsx src/mini-app/styles/global.css
git commit -m "feat: single tap = complete now, remove time sheet, bigger detail touch target"
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
