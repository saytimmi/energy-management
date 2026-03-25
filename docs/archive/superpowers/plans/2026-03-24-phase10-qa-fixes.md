# Phase 10: QA Fixes & Hardening — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 6 bugs found during full QA system test. Harden API security, fix test reliability, clean up hardcoded values, filter invalid input.

**Spec:** `docs/testing/qa-full-test-prompt.md` — QA report from 2026-03-24 session.

**Assumes:** Phases 6, 7, and 8 are completed. BUG-003 (TypeScript error) already fixed during QA.

---

## File Structure

### New files:
_None_

### Modified files:
- `src/api/energy.ts` — logId ownership check (BUG-001), empty trigger filter (BUG-005)
- `src/services/diagnostics.ts` — chronicLows relative date window (BUG-002)
- `src/__tests__/diagnostics.test.ts` — fix hardcoded test dates (BUG-002)
- `src/mini-app/components/kaizen/KaizenScreen.tsx` — dynamic bot username (BUG-004)
- `src/mini-app/components/kaizen/AlgorithmDetail.tsx` — dynamic bot username (BUG-004)
- `src/mini-app/components/balance/StrategyScreen.tsx` — dynamic bot username (BUG-004)
- `src/mini-app/store/strategy.ts` — fetch + expose botUsername from /api/config (BUG-004)
- `src/services/scheduler.ts` — UTC fallback (BUG-006)
- `src/services/checkin-sender.ts` — UTC fallback (BUG-006)
- `src/services/ai.ts` — UTC fallback (BUG-006)

---

## Task 1: API Security — logId ownership check + empty trigger filter (BUG-001, BUG-005)

**Files:** `src/api/energy.ts`

- [ ] **1a.** In `POST /api/energy/:logId/triggers`, after parsing logId, add ownership check:
  ```typescript
  const log = await prisma.energyLog.findFirst({ where: { id: logId, userId } });
  if (!log) { res.status(404).json({ error: "log_not_found" }); return; }
  ```
- [ ] **1b.** Before the loop, filter empty/whitespace triggers:
  ```typescript
  const validTriggers = triggers.map(t => t.trim()).filter(Boolean);
  if (validTriggers.length === 0) { res.status(400).json({ error: "triggers required" }); return; }
  ```
  Use `validTriggers` in the for loop instead of `triggers`.
- [ ] **1c.** Verify: `npm run build` passes.

---

## Task 2: Fix chronicLows test — relative date window (BUG-002)

**Files:** `src/services/diagnostics.ts`, `src/__tests__/diagnostics.test.ts`

- [ ] **2a.** In `analyzeEnergyHistory()`, change the 7-day window to be relative to the latest log, not `new Date()`:
  ```typescript
  // Before:
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // After:
  const latestDate = logs.length > 0 ? logs[0].createdAt : new Date();
  const sevenDaysAgo = new Date(latestDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  ```
  This makes chronicLows work with any date range, not just "last 7 days from now".
- [ ] **2b.** Run `npm test` — the "detects chronic lows" test should now pass.
- [ ] **2c.** Verify all 109 tests pass.

---

## Task 3: Dynamic bot username in Mini App (BUG-004)

**Files:** `src/mini-app/store/strategy.ts`, `KaizenScreen.tsx`, `AlgorithmDetail.tsx`, `StrategyScreen.tsx`

- [ ] **3a.** In `src/mini-app/store/strategy.ts`, add a signal for botUsername and fetch it:
  ```typescript
  export const botUsername = signal<string>("energy_coach_bot");

  export async function loadAppConfig() {
    try {
      const cfg = await api.appConfig();
      botUsername.value = cfg.botUsername;
    } catch {}
  }
  ```
- [ ] **3b.** Call `loadAppConfig()` in app.tsx on mount (alongside other initial loads).
- [ ] **3c.** In `KaizenScreen.tsx:34`, replace `"energy_coach_bot"` with `botUsername.value`:
  ```typescript
  import { botUsername } from "../../store/strategy";
  // ...
  openTelegramLink(botUsername.value);
  ```
- [ ] **3d.** In `AlgorithmDetail.tsx:46`, same replacement.
- [ ] **3e.** In `StrategyScreen.tsx:17,22`, same replacement for both occurrences.
- [ ] **3f.** Verify: `grep -r "energy_coach_bot" src/mini-app/` returns 0 results.
- [ ] **3g.** Verify: `npm run build` passes.

---

## Task 4: Replace Asia/Shanghai timezone fallback with UTC (BUG-006)

**Files:** `src/services/scheduler.ts`, `src/services/checkin-sender.ts`, `src/services/ai.ts`

- [ ] **4a.** In `src/services/scheduler.ts:24`, change:
  ```typescript
  // Before:
  const tz = user.timezone || "Asia/Shanghai";
  // After:
  const tz = user.timezone || "UTC";
  ```
- [ ] **4b.** In `src/services/checkin-sender.ts:42`, same change.
- [ ] **4c.** In `src/services/ai.ts:1416`, same change.
- [ ] **4d.** Do NOT change `src/services/ai.ts:132,141` — those are AI prompt examples, not runtime fallbacks.
- [ ] **4e.** Verify: `grep -r "Asia/Shanghai" src/services/ | grep -v ai.ts` returns 0 results.
- [ ] **4f.** Verify: `npm run build` passes.

---

## Task 5: Final Verification

- [ ] **5a.** `npm run build` — no errors
- [ ] **5b.** `npm test` — all tests pass (109/109)
- [ ] **5c.** `npx tsc --noEmit` — no TypeScript errors
- [ ] **5d.** Code quality checks:
  - `grep -r "energy_coach_bot" src/mini-app/` → 0 results
  - `grep -r "getBotUsername" src/` → 0 results
  - `grep -r "Asia/Shanghai" src/services/ | grep -v ai.ts` → 0 results
  - `grep -r "time-sheet\|showTimeSheet\|selectedTime" src/mini-app/components/habits/HabitCard.tsx` → 0 results
- [ ] **5e.** Commit: `fix: QA Phase 10 — security, test reliability, code quality`
