# Phase 5: Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visual polish pass — light/dark theme support, skeleton loading states, transition animations, premium emoji icons across all components.

**Architecture:** Theme detection reads `Telegram.WebApp.colorScheme` and sets `data-theme` on `<html>`. Light theme CSS variables defined under `:root[data-theme="light"]`. Skeleton component is a reusable Preact functional component with CSS shimmer animation. Icon updates are find-and-replace across existing component files.

**Tech Stack:** Preact, CSS custom properties, Telegram Mini App SDK

**Spec:** `docs/superpowers/specs/2026-03-23-personal-os-design.md` (section "Тема: Light / Dark" + "Фаза 5: Polish")

---

## Chunk 1: Light/Dark Theme

### Task 1: Add light theme CSS variables

**Files:**
- Modify: `src/mini-app/styles/variables.css`

- [ ] **Step 1: Add light theme variables block after the existing `:root` block**

Append after line 43 (closing `}` of `:root`):

```css
/* ── Light Theme ── */
:root[data-theme="light"] {
  --bg: #f5f5f7;
  --surface: rgba(255, 255, 255, 0.85);
  --surface-solid: #ffffff;
  --surface2: #e8e8ed;
  --surface-border: rgba(0, 0, 0, 0.06);
  --surface-glow: rgba(0, 0, 0, 0.02);

  --text: #1d1d1f;
  --text2: #6e6e73;
  --text3: #8e8e93;

  /* Accent — darker lime for contrast on white */
  --accent: #4a8c00;
  --accent-glow: rgba(74, 140, 0, 0.12);
  --accent-soft: rgba(74, 140, 0, 0.06);

  /* Energy type colors — slightly deeper for white bg */
  --physical: #2d9e4a;
  --physical-glow: rgba(45, 158, 74, 0.15);
  --mental: #3478f6;
  --mental-glow: rgba(52, 120, 246, 0.15);
  --emotional: #e8550f;
  --emotional-glow: rgba(232, 85, 15, 0.15);
  --spiritual: #a14de0;
  --spiritual-glow: rgba(161, 77, 224, 0.15);

  /* Telegram theme mapping */
  --tg-bg: var(--bg);
  --tg-text: var(--text);
  --tg-hint: var(--text2);
  --tg-button: var(--accent);
  --tg-surface: var(--surface-solid);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/styles/variables.css
git commit -m "feat: light theme CSS variables for Telegram colorScheme support"
```

### Task 2: Fix hardcoded dark colors in global.css

**Files:**
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Fix bottom nav background (line ~410)**

Replace the hardcoded dark background:
```css
/* Old: */
background: rgba(12, 13, 18, 0.85);
/* New: */
background: var(--surface);
```

- [ ] **Step 2: Fix timeline dot border color (line ~348)**

Replace:
```css
/* Old: */
border: 2px solid var(--bg);
/* New — stays var(--bg), already uses variable, OK */
```

No change needed — already uses CSS variable.

- [ ] **Step 3: Fix any remaining hardcoded rgba(12,13,18,...) references**

Search for `rgba(12, 13, 18` in global.css and replace with `var(--surface)` or `var(--bg)` as appropriate.

- [ ] **Step 4: Fix time-sheet overlay background for light theme**

In the `.time-sheet-overlay` rule, the `rgba(0, 0, 0, 0.5)` overlay works for both themes. No change needed.

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/styles/global.css
git commit -m "fix: replace hardcoded dark colors with CSS variables for theme support"
```

### Task 3: Set data-theme from Telegram colorScheme

**Files:**
- Modify: `src/mini-app/telegram.ts`

- [ ] **Step 1: Add applyColorScheme function and call it from syncTheme**

Add new function after `syncTheme`:
```typescript
export function applyColorScheme(): void {
  const scheme = tg?.colorScheme ?? "dark";
  document.documentElement.setAttribute("data-theme", scheme);
}
```

- [ ] **Step 2: Call applyColorScheme from syncTheme**

At the beginning of `syncTheme()` (line 70), add:
```typescript
export function syncTheme(): void {
  applyColorScheme();
  if (!tg) return;
  // ... rest stays the same
```

- [ ] **Step 3: Listen for themeChanged to re-apply color scheme**

In the `syncTheme` function, the existing `tg.onEvent("themeChanged", syncTheme)` already re-calls syncTheme, which now calls applyColorScheme. This is sufficient.

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/telegram.ts
git commit -m "feat: apply Telegram colorScheme as data-theme attribute on document root"
```

---

## Chunk 2: Skeleton Loading

### Task 4: Create Skeleton component + CSS

**Files:**
- Create: `src/mini-app/components/shared/Skeleton.tsx`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Add skeleton CSS to global.css**

Append to `src/mini-app/styles/global.css`:
```css
/* ── Skeleton Loading ── */
.skeleton {
  background: var(--surface2);
  border-radius: var(--radius-xs);
  position: relative;
  overflow: hidden;
}
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--surface-glow) 20%,
    rgba(255, 255, 255, 0.06) 50%,
    var(--surface-glow) 80%,
    transparent 100%
  );
  animation: shimmer 1.8s ease-in-out infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.skeleton-text { height: 12px; border-radius: 6px; }
.skeleton-title { height: 16px; width: 60%; border-radius: 8px; }
.skeleton-circle { border-radius: 50%; }
.skeleton-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 16px;
}
```

- [ ] **Step 2: Create Skeleton component**

Create `src/mini-app/components/shared/Skeleton.tsx`:
```typescript
interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  style?: Record<string, string | number>;
  class?: string;
}

export function Skeleton({ width = "100%", height = "12px", radius, style, class: cls }: SkeletonProps) {
  return (
    <div
      class={`skeleton ${cls ?? ""}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** Skeleton shaped like a hub widget card */
export function SkeletonCard({ children, style }: { children?: any; style?: Record<string, string | number> }) {
  return (
    <div class="skeleton-card" style={style}>
      {children ?? (
        <>
          <Skeleton width="50%" height="14px" style={{ marginBottom: "12px" }} />
          <Skeleton width="80%" height="12px" style={{ marginBottom: "8px" }} />
          <Skeleton width="60%" height="12px" />
        </>
      )}
    </div>
  );
}

/** Skeleton shaped like the 4 energy rings */
export function SkeletonRings() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} class="skeleton-card" style={{ padding: "22px 14px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", borderRadius: "24px" }}>
          <Skeleton width="96px" height="96px" radius="50%" />
          <Skeleton width="60px" height="11px" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton shaped like observation cards */
export function SkeletonObservations({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} class="skeleton-card" style={{ padding: "12px", marginBottom: "8px", borderRadius: "var(--radius-xs)" }}>
          <Skeleton width="100px" height="10px" style={{ marginBottom: "6px" }} />
          <Skeleton width="90%" height="12px" style={{ marginBottom: "4px" }} />
          <Skeleton width="70%" height="11px" />
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/components/shared/Skeleton.tsx src/mini-app/styles/global.css
git commit -m "feat: Skeleton component with shimmer animation"
```

### Task 5: Replace loading states with Skeleton UI

**Files:**
- Modify: `src/mini-app/components/hub/HabitsCard.tsx`
- Modify: `src/mini-app/components/habits/HabitsScreen.tsx`
- Modify: `src/mini-app/components/habits/HabitDetail.tsx`
- Modify: `src/mini-app/components/shared/Loading.tsx`

- [ ] **Step 1: Replace HabitsCard loading text**

In `src/mini-app/components/hub/HabitsCard.tsx`, find `Загрузка...` and replace with skeleton:

Add import:
```typescript
import { Skeleton } from "../shared/Skeleton";
```

Replace the loading state (the `<div class="hub-card-empty">Загрузка...</div>` line):
```tsx
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
  <Skeleton width="70%" height="14px" />
  <Skeleton width="50%" height="12px" />
</div>
```

- [ ] **Step 2: Replace HabitsScreen loading screen**

In `src/mini-app/components/habits/HabitsScreen.tsx`, find the loading screen block (lines ~129-131) and replace with:

Add import:
```typescript
import { Skeleton, SkeletonCard } from "../shared/Skeleton";
```

Replace:
```tsx
<div class="habits-screen">
  <SkeletonCard style={{ marginBottom: "12px" }}>
    <Skeleton width="40%" height="24px" style={{ marginBottom: "8px" }} />
    <Skeleton width="100%" height="8px" radius="4px" />
  </SkeletonCard>
  {[0, 1, 2].map((i) => (
    <SkeletonCard key={i} style={{ marginBottom: "10px" }} />
  ))}
</div>
```

- [ ] **Step 3: Replace HabitDetail loading text**

In `src/mini-app/components/habits/HabitDetail.tsx`, find `Загрузка...` (line ~243) and replace with:

Add import:
```typescript
import { Skeleton } from "../shared/Skeleton";
```

Replace:
```tsx
<div style={{ padding: "20px" }}>
  <Skeleton width="60%" height="18px" style={{ marginBottom: "16px" }} />
  <Skeleton width="100%" height="12px" style={{ marginBottom: "8px" }} />
  <Skeleton width="80%" height="12px" />
</div>
```

- [ ] **Step 4: Update Loading.tsx component**

In `src/mini-app/components/shared/Loading.tsx`, keep the existing pulse-ring loading as a fallback — it's used for the initial app load before data is available. No change needed.

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/components/hub/HabitsCard.tsx src/mini-app/components/habits/HabitsScreen.tsx src/mini-app/components/habits/HabitDetail.tsx
git commit -m "feat: replace loading text with skeleton UI in habits components"
```

---

## Chunk 3: Transition Animations

### Task 6: Add tab switch and screen transition animations

**Files:**
- Modify: `src/mini-app/styles/global.css`
- Modify: `src/mini-app/app.tsx`

- [ ] **Step 1: Add screen transition CSS**

Append to `src/mini-app/styles/global.css`:
```css
/* ── Screen Transitions ── */
.screen-enter {
  animation: screenIn 0.3s ease both;
}
@keyframes screenIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Apply screen-enter class in app.tsx**

In `src/mini-app/app.tsx`, wrap each screen render with a keyed container for re-triggering animation:

```tsx
return (
  <>
    <div key={route} class="screen-enter">
      {route === "hub" && <Hub />}
      {route === "energy" && <EnergyDashboard />}
      {route === "habits" && <HabitsScreen />}
      {route === "journal" && <Journal />}
    </div>
    <BottomNav />
  </>
);
```

The `key={route}` ensures the container re-mounts on tab change, triggering the `screenIn` animation.

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/styles/global.css src/mini-app/app.tsx
git commit -m "feat: screen enter animation on tab switch"
```

---

## Chunk 4: Premium Icons

### Task 7: Update energy type emojis across all components

**Files:**
- Modify: `src/mini-app/components/hub/EnergyCard.tsx`
- Modify: `src/mini-app/components/energy/EnergyRings.tsx`
- Modify: `src/mini-app/components/energy/Observations.tsx`
- Modify: `src/mini-app/components/journal/Journal.tsx`

**Icon mapping:**
- physical: `🏃` → `🦾`
- mental: `🧠` → `🧬`
- emotional: `💚` → `🫀`
- spiritual: `🔮` stays `🔮`

- [ ] **Step 1: Update EnergyCard.tsx (line ~24-27)**

Replace emoji values:
```typescript
{ key: "physical" as const, emoji: "🦾", color: "var(--physical)" },
{ key: "mental" as const, emoji: "🧬", color: "var(--mental)" },
{ key: "emotional" as const, emoji: "🫀", color: "var(--emotional)" },
{ key: "spiritual" as const, emoji: "🔮", color: "var(--spiritual)" },
```

- [ ] **Step 2: Update EnergyRings.tsx (lines ~5-8)**

Replace emoji values:
```typescript
{ key: "physical", emoji: "🦾", label: "Физическая" },
{ key: "mental", emoji: "🧬", label: "Ментальная" },
{ key: "emotional", emoji: "🫀", label: "Эмоциональная" },
{ key: "spiritual", emoji: "🔮", label: "Духовная" },
```

- [ ] **Step 3: Update Observations.tsx emojiMap (line ~4)**

Replace:
```typescript
const emojiMap: Record<string, string> = { physical: "🦾", mental: "🧬", emotional: "🫀", spiritual: "🔮" };
```

- [ ] **Step 4: Update Journal.tsx emojiMap (line ~12)**

Replace:
```typescript
const emojiMap: Record<string, string> = { physical: "🦾", mental: "🧬", emotional: "🫀", spiritual: "🔮" };
```

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/components/hub/EnergyCard.tsx src/mini-app/components/energy/EnergyRings.tsx src/mini-app/components/energy/Observations.tsx src/mini-app/components/journal/Journal.tsx
git commit -m "feat: premium energy emojis — 🦾 physical, 🧬 mental, 🫀 emotional"
```

### Task 8: Update life area emojis

**Files:**
- Modify: `src/mini-app/components/habits/HabitCreate.tsx`

**Icon mapping:**
- health: `❤️` → `🩺`
- career: `💼` → `🚀`
- relationships: `👫` → `💞`
- finances: `💰` → `💎`
- family: `👨‍👩‍👧` → `🏡`
- growth: `🧠` → `📚`
- recreation: `🎮` → `🧘`
- environment: `🏠` → `🌿`

- [ ] **Step 1: Update LIFE_AREAS array (lines ~37-46)**

Replace:
```typescript
const LIFE_AREAS = [
  { id: "health", label: "Здоровье", icon: "🩺" },
  { id: "career", label: "Карьера", icon: "🚀" },
  { id: "relationships", label: "Отношения", icon: "💞" },
  { id: "finances", label: "Финансы", icon: "💎" },
  { id: "family", label: "Семья", icon: "🏡" },
  { id: "growth", label: "Развитие", icon: "📚" },
  { id: "recreation", label: "Отдых", icon: "🧘" },
  { id: "environment", label: "Среда", icon: "🌿" },
] as const;
```

- [ ] **Step 2: Update SLOTS array time emojis (lines ~48-52)**

Replace:
```typescript
const SLOTS = [
  { id: "morning", label: "Утро", icon: "🌅" },
  { id: "afternoon", label: "День", icon: "☀️" },
  { id: "evening", label: "Вечер", icon: "🌙" },
] as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/components/habits/HabitCreate.tsx
git commit -m "feat: premium life area emojis — 🩺🚀💞💎🏡📚🧘🌿"
```

### Task 9: Update time slot emojis in habit screens

**Files:**
- Modify: `src/mini-app/components/hub/HabitsCard.tsx`
- Modify: `src/mini-app/components/habits/RoutineGroup.tsx`
- Modify: `src/mini-app/components/habits/HabitsScreen.tsx`

- [ ] **Step 1: Update HabitsCard.tsx slot emojis (line ~8-10)**

Replace:
```typescript
morning: "🌅",
afternoon: "☀️",  // if exists, otherwise keep current
evening: "🌙",
```

Note: morning changes from `☀️` to `🌅`. Afternoon gets `☀️`. Evening stays `🌙`.

- [ ] **Step 2: Update RoutineGroup.tsx slot labels (line ~14-16)**

Replace:
```typescript
morning: "🌅 Утро",
afternoon: "☀️ День",  // check current value
evening: "🌙 Вечер",
```

- [ ] **Step 3: Update HabitsScreen.tsx routine labels (lines ~91-93)**

Replace:
```typescript
morning: "🌅 Утренняя рутина",
afternoon: "☀️ Дневная рутина",  // check current value
evening: "🌙 Вечерняя рутина",
```

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/components/hub/HabitsCard.tsx src/mini-app/components/habits/RoutineGroup.tsx src/mini-app/components/habits/HabitsScreen.tsx
git commit -m "feat: premium time slot emojis — 🌅 morning, ☀️ afternoon, 🌙 evening"
```

---

## Chunk 5: Build & Verify

### Task 10: Final build and test

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Visual check list**

Verify in Telegram (or dev server) that:
- Dark theme: all existing visuals intact, no regressions
- Light theme (if testable via `document.documentElement.setAttribute("data-theme", "light")`): backgrounds, text, accents readable
- Skeleton shimmer appears on habit loading
- Tab switch has subtle fade-in animation
- New emojis render correctly (🦾 🧬 🫀 may need emoji font support check)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: Phase 5 polish — build fixes and adjustments"
```

---

## Summary

After Phase 5 completion, the app has:
- Light/dark theme via `Telegram.WebApp.colorScheme` → `data-theme` attribute
- Complete light theme CSS variables with adjusted accent/energy colors for white backgrounds
- Hardcoded dark colors replaced with CSS variables
- Reusable `Skeleton` component with shimmer animation
- Skeleton loading states replacing "Загрузка..." text in habits components
- Screen enter animation on tab switches (`screenIn` keyframe)
- Premium energy emojis: 🦾 physical, 🧬 mental, 🫀 emotional, 🔮 spiritual
- Premium life area emojis: 🩺 🚀 💞 💎 🏡 📚 🧘 🌿
- Premium time slot emojis: 🌅 morning, ☀️ afternoon, 🌙 evening

**Next:** Phase 6 (Google Calendar integration) or user testing.
