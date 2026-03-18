# Phase 1: Frontend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Mini App from vanilla JS (`public/`) to Preact + Vite, implement Telegram initData authentication, and create a hub dashboard — preserving all existing functionality.

**Architecture:** Vite builds the frontend to `dist/client/`, Express serves it as static. Backend compilation (tsc) remains separate. Dev mode uses `concurrently` to run Vite dev server + `tsx watch` for backend. All API requests use `Authorization: tma <initData>` header validated server-side via HMAC-SHA256.

**Tech Stack:** Preact 10 (3KB), Vite 6, @anthropic-ai/sdk (existing), Chart.js 4 (existing CDN → npm), @preact/signals for state.

---

## File Structure

```
src/
  mini-app/
    main.tsx                    → Vite entry point, mounts <App/>
    app.tsx                     → Root component with router
    router.ts                   → Hash-based router (useRoute/navigate)
    telegram.ts                 → Telegram WebApp SDK wrapper (theme, haptic, initData)
    store/
      index.ts                  → Re-exports all stores
      energy.ts                 → Energy data signals
    api/
      client.ts                 → Fetch wrapper with initData auth header
      types.ts                  → Shared API response types
    components/
      hub/
        Hub.tsx                 → Main dashboard (hub-and-spoke root)
        EnergyCard.tsx          → 4 energy rings card
      energy/
        EnergyDashboard.tsx     → Full energy view (rings + observations + analytics)
        EnergyRings.tsx         → SVG ring components
        Observations.tsx        → Observations list
        Analytics.tsx           → AI patterns section
      timeline/
        Timeline.tsx            → Chart.js timeline view
      journal/
        Journal.tsx             → Observation journal view
      shared/
        Card.tsx                → Reusable card wrapper
        BottomNav.tsx           → Navigation bar
        Loading.tsx             → Loading/welcome screens
    styles/
      variables.css             → Design tokens (migrated from style.css :root)
      global.css                → Base styles + animations
      components.css            → Component-specific styles
  middleware/
    telegram-auth.ts            → initData HMAC-SHA256 validation middleware
  index.html                    → Vite HTML entry (replaces public/index.html)
vite.config.ts                  → Vite config (base: './', outDir: dist/client)
tsconfig.app.json               → Frontend tsconfig (JSX, Preact)
```

**Modified files:**
- `src/server.ts` → serve `dist/client/` instead of `public/`, add auth middleware
- `src/api/dashboard.ts` → use `req.userId` from auth middleware (keep `?telegramId` as fallback)
- `src/api/history.ts` → same auth migration
- `src/api/analytics.ts` → same auth migration
- `src/api/observations.ts` → same auth migration
- `src/api/checkin-trigger.ts` → same auth migration
- `package.json` → new deps + scripts
- `tsconfig.json` → exclude `src/mini-app/`
- `railway.toml` → add `vite build` to buildCmd

---

## Chunk 1: Tooling & Build Pipeline

### Task 1: Install dependencies and configure Vite

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.app.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install Preact, Vite, and related dependencies**

```bash
npm install preact @preact/signals chart.js
npm install -D @preact/preset-vite concurrently
```

- [ ] **Step 2: Create `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  root: "src",
  base: "./",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
```

- [ ] **Step 3: Create `tsconfig.app.json` for frontend**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "react": ["./node_modules/preact/compat"],
      "react-dom": ["./node_modules/preact/compat"]
    }
  },
  "include": ["src/mini-app/**/*"]
}
```

- [ ] **Step 4: Update `tsconfig.json` — exclude mini-app from backend compilation**

Add `"src/mini-app/**/*"` to the `exclude` array:

```json
{
  "exclude": ["node_modules", "dist", "src/mini-app/**/*"]
}
```

- [ ] **Step 5: Update `package.json` scripts**

```json
{
  "scripts": {
    "build": "prisma generate && tsc && vite build",
    "start": "npx prisma db push --accept-data-loss; node dist/index.js",
    "dev": "concurrently -n bot,vite \"tsx watch src/index.ts\" \"vite dev --config vite.config.ts\"",
    "dev:bot": "tsx watch src/index.ts",
    "dev:vite": "vite dev --config vite.config.ts",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "test": "vitest run"
  }
}
```

- [ ] **Step 6: Create `src/index.html` — Vite entry HTML**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Energy</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./mini-app/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 7: Update `railway.toml` — add Vite build**

```toml
[build]
builder = "nixpacks"

[build.nixpacks]
buildCmd = "npm run build"

[deploy]
startCommand = "npx prisma generate && node dist/index.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

- [ ] **Step 8: Update `src/server.ts` — serve `dist/client/` instead of `public/`**

Change static file serving path and update CORS to allow Authorization header:

```typescript
// CORS: add Authorization to allowed headers
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Serve Vite-built frontend (replaces public/)
const clientPath = path.resolve(process.cwd(), "dist", "client");
app.use(express.static(clientPath));
```

- [ ] **Step 9: Create minimal `src/mini-app/main.tsx` placeholder**

```tsx
import { render } from "preact";

function App() {
  return <div style={{ color: "white", padding: "20px" }}>Preact works!</div>;
}

render(<App />, document.getElementById("app")!);
```

- [ ] **Step 10: Verify build pipeline**

```bash
npm run build
```

Expected: `dist/` contains backend JS files, `dist/client/` contains Vite output with `index.html` and bundled JS.

- [ ] **Step 11: Verify dev mode**

```bash
npm run dev
```

Expected: Both `tsx watch` and `vite dev` start. Vite proxies `/api` to port 8080. Opening `http://localhost:5173` shows "Preact works!".

- [ ] **Step 12: Commit**

```bash
git add vite.config.ts tsconfig.app.json src/index.html src/mini-app/main.tsx package.json tsconfig.json railway.toml src/server.ts package-lock.json
git commit -m "feat: set up Preact + Vite build pipeline for Mini App"
```

---

## Chunk 2: Telegram initData Authentication Middleware

### Task 2: Implement initData HMAC-SHA256 validation

**Files:**
- Create: `src/middleware/telegram-auth.ts`
- Create: `src/__tests__/telegram-auth.test.ts`

- [ ] **Step 1: Write the test for initData validation**

```typescript
// src/__tests__/telegram-auth.test.ts
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { validateInitData, parseInitData } from "../middleware/telegram-auth.js";

const BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";

function createValidInitData(
  data: Record<string, string>,
  botToken: string
): string {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  const params = new URLSearchParams({ ...data, hash });
  return params.toString();
}

describe("telegram-auth", () => {
  describe("validateInitData", () => {
    it("returns true for valid initData", () => {
      const userData = JSON.stringify({
        id: 123456789,
        first_name: "Test",
        username: "testuser",
      });
      const initData = createValidInitData(
        {
          user: userData,
          auth_date: String(Math.floor(Date.now() / 1000)),
          query_id: "test-query",
        },
        BOT_TOKEN
      );
      expect(validateInitData(initData, BOT_TOKEN)).toBe(true);
    });

    it("returns false for tampered data", () => {
      const userData = JSON.stringify({ id: 123456789, first_name: "Test" });
      const initData = createValidInitData(
        {
          user: userData,
          auth_date: String(Math.floor(Date.now() / 1000)),
        },
        BOT_TOKEN
      );
      const tampered = initData.replace("Test", "Hacker");
      expect(validateInitData(tampered, BOT_TOKEN)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateInitData("", BOT_TOKEN)).toBe(false);
    });
  });

  describe("parseInitData", () => {
    it("extracts telegramId from valid user JSON", () => {
      const userData = JSON.stringify({
        id: 123456789,
        first_name: "Test",
      });
      const initData = createValidInitData(
        {
          user: userData,
          auth_date: String(Math.floor(Date.now() / 1000)),
        },
        BOT_TOKEN
      );
      const result = parseInitData(initData);
      expect(result?.telegramId).toBe(123456789);
      expect(result?.firstName).toBe("Test");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/telegram-auth.test.ts
```

Expected: FAIL — module `../middleware/telegram-auth.js` not found.

- [ ] **Step 3: Implement the middleware**

```typescript
// src/middleware/telegram-auth.ts
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import prisma from "../db.js";
import { config } from "../config.js";

export interface TelegramUser {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export function validateInitData(initData: string, botToken: string): boolean {
  if (!initData) return false;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    params.delete("hash");
    const entries = Array.from(params.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const computed = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return computed === hash;
  } catch {
    return false;
  }
}

export function parseInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    if (!userJson) return null;

    const user = JSON.parse(userJson);
    if (!user.id) return null;

    return {
      telegramId: user.id,
      firstName: user.first_name || "",
      lastName: user.last_name,
      username: user.username,
    };
  } catch {
    return null;
  }
}

// Express middleware: validates initData, resolves userId, attaches to req
export function telegramAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Try Authorization header first: "tma <initData>"
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("tma ")) {
    const initData = authHeader.slice(4);
    if (!validateInitData(initData, config.telegramBotToken)) {
      res.status(401).json({ error: "invalid_init_data" });
      return;
    }
    const tgUser = parseInitData(initData);
    if (!tgUser) {
      res.status(401).json({ error: "invalid_user_data" });
      return;
    }
    // Resolve DB user and attach to request
    prisma.user
      .findUnique({ where: { telegramId: BigInt(tgUser.telegramId) } })
      .then((user) => {
        if (!user) {
          res.status(404).json({ error: "user_not_found" });
          return;
        }
        (req as any).userId = user.id;
        (req as any).telegramId = BigInt(tgUser.telegramId);
        next();
      })
      .catch(() => {
        res.status(500).json({ error: "internal_error" });
      });
    return;
  }

  // Fallback: legacy ?telegramId= query param (for existing bot WebView links)
  const telegramIdParam = req.query.telegramId as string | undefined;
  if (telegramIdParam) {
    const telegramId = BigInt(telegramIdParam);
    prisma.user
      .findUnique({ where: { telegramId } })
      .then((user) => {
        if (!user) {
          res.status(404).json({ error: "user_not_found" });
          return;
        }
        (req as any).userId = user.id;
        (req as any).telegramId = telegramId;
        next();
      })
      .catch(() => {
        res.status(500).json({ error: "internal_error" });
      });
    return;
  }

  res.status(401).json({ error: "missing_auth" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/telegram-auth.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/telegram-auth.ts src/__tests__/telegram-auth.test.ts
git commit -m "feat: add Telegram initData HMAC-SHA256 auth middleware"
```

### Task 3: Apply auth middleware to API routes

**Files:**
- Modify: `src/server.ts`
- Modify: `src/api/dashboard.ts`
- Modify: `src/api/history.ts`
- Modify: `src/api/analytics.ts`
- Modify: `src/api/observations.ts`
- Modify: `src/api/checkin-trigger.ts`

- [ ] **Step 1: Apply middleware to API router in `src/server.ts`**

```typescript
import { telegramAuth } from "./middleware/telegram-auth.js";

// In startServer(), after creating apiRouter:
const authedRouter = Router();
authedRouter.use(telegramAuth);

// Register routes on authedRouter instead of apiRouter
dashboardRoute(authedRouter);
historyRoute(authedRouter);
analyticsRoute(authedRouter);
observationsRoute(authedRouter);
checkinTriggerRoute(authedRouter);

// kaizen stays on unauthed router (diagnostics endpoint)
kaizenRoute(apiRouter);

app.use("/api", apiRouter);
app.use("/api", authedRouter);
```

- [ ] **Step 2: Simplify `src/api/dashboard.ts` — use `req.userId` from middleware**

Replace the telegramId extraction + user lookup with:

```typescript
export function dashboardRoute(router: Router): void {
  router.get("/dashboard", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;

      const latestLog = await prisma.energyLog.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      if (!latestLog) {
        res.json({ error: "no_data" });
        return;
      }

      const streak = await calculateStreak(userId);

      res.json({
        physical: latestLog.physical,
        mental: latestLog.mental,
        emotional: latestLog.emotional,
        spiritual: latestLog.spiritual,
        loggedAt: latestLog.createdAt.toISOString(),
        streak,
      });
    } catch (err) {
      console.error("Dashboard API error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
```

- [ ] **Step 3: Apply same pattern to `history.ts`, `analytics.ts`, `observations.ts`, `checkin-trigger.ts`**

In each file, remove the `telegramId` query param extraction and user lookup. Replace with:

```typescript
const userId = (req as any).userId as number;
```

Remove the `if (!telegramIdParam)` and `if (!user)` checks — middleware handles both.

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: Clean build with no type errors.

- [ ] **Step 5: Run existing tests**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts src/api/dashboard.ts src/api/history.ts src/api/analytics.ts src/api/observations.ts src/api/checkin-trigger.ts
git commit -m "feat: apply Telegram initData auth middleware to all API routes"
```

---

## Chunk 3: Frontend Foundation (App Shell, Router, API Client, Telegram Integration)

### Task 4: Create Telegram SDK wrapper

**Files:**
- Create: `src/mini-app/telegram.ts`

- [ ] **Step 1: Create Telegram wrapper**

This wraps `window.Telegram.WebApp` with typed helpers for theme sync, haptic feedback, and initData access.

```typescript
// src/mini-app/telegram.ts

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        themeParams: Record<string, string>;
        colorScheme: "light" | "dark";
        HapticFeedback: {
          impactOccurred(style: "light" | "medium" | "heavy"): void;
          notificationOccurred(type: "error" | "success" | "warning"): void;
          selectionChanged(): void;
        };
        BackButton: {
          show(): void;
          hide(): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
        };
        onEvent(event: string, cb: () => void): void;
      };
    };
  }
}

const tg = window.Telegram?.WebApp;

export function initTelegram(): void {
  if (tg) {
    tg.ready();
    tg.expand();
  }
}

export function getInitData(): string {
  return tg?.initData ?? "";
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user ?? null;
}

export function haptic(type: "light" | "medium" | "heavy" = "light"): void {
  tg?.HapticFeedback?.impactOccurred(type);
}

export function hapticSuccess(): void {
  tg?.HapticFeedback?.notificationOccurred("success");
}

export function hapticSelection(): void {
  tg?.HapticFeedback?.selectionChanged();
}

export function showBackButton(onBack: () => void): void {
  if (tg?.BackButton) {
    tg.BackButton.show();
    tg.BackButton.onClick(onBack);
  }
}

export function hideBackButton(): void {
  tg?.BackButton?.hide();
}

export function syncTheme(): void {
  if (!tg) return;
  const params = tg.themeParams;
  const root = document.documentElement;
  if (params.bg_color) root.style.setProperty("--tg-bg", params.bg_color);
  if (params.text_color) root.style.setProperty("--tg-text", params.text_color);
  if (params.hint_color) root.style.setProperty("--tg-hint", params.hint_color);
  if (params.button_color) root.style.setProperty("--tg-button", params.button_color);
  if (params.secondary_bg_color) root.style.setProperty("--tg-surface", params.secondary_bg_color);

  tg.onEvent("themeChanged", syncTheme);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/telegram.ts
git commit -m "feat: add Telegram WebApp SDK wrapper (theme, haptic, auth)"
```

### Task 5: Create API client with initData auth

**Files:**
- Create: `src/mini-app/api/types.ts`
- Create: `src/mini-app/api/client.ts`

- [ ] **Step 1: Create shared API types**

```typescript
// src/mini-app/api/types.ts

export interface DashboardData {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
  loggedAt: string;
  streak: number;
}

export interface Observation {
  id: number;
  energyType: "physical" | "mental" | "emotional" | "spiritual";
  direction: "drop" | "rise" | "low" | "high" | "stable";
  trigger: string | null;
  recommendation: string | null;
  context: string | null;
  createdAt: string;
}

export interface ObservationsResponse {
  observations: Observation[];
  stats: { total: number };
}

export interface HistoryPoint {
  date: string;
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
}

export interface AnalyticsData {
  hasEnoughData: boolean;
  insights: string | string[];
  stats: Record<string, unknown>;
}
```

- [ ] **Step 2: Create API client with auth header**

```typescript
// src/mini-app/api/client.ts
import { getInitData } from "../telegram";
import type {
  DashboardData,
  ObservationsResponse,
  HistoryPoint,
  AnalyticsData,
} from "./types";

const BASE = "";  // same origin

async function request<T>(path: string): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = {};

  if (initData) {
    headers["Authorization"] = `tma ${initData}`;
  }

  const res = await fetch(`${BASE}${path}`, { headers });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  observations: () => request<ObservationsResponse>("/api/observations"),
  history: (period: "week" | "month") =>
    request<HistoryPoint[]>(`/api/history?period=${period}`),
  analytics: () => request<AnalyticsData>("/api/analytics"),
  triggerCheckin: () => request<{ ok: boolean }>("/api/checkin-trigger"),
};
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/api/types.ts src/mini-app/api/client.ts
git commit -m "feat: add typed API client with initData auth header"
```

### Task 6: Create hash-based router

**Files:**
- Create: `src/mini-app/router.ts`

- [ ] **Step 1: Implement minimal hash router using Preact signals**

```typescript
// src/mini-app/router.ts
import { signal, effect } from "@preact/signals";

export type Route = "hub" | "energy" | "timeline" | "journal";

export const currentRoute = signal<Route>("hub");

export function navigate(route: Route): void {
  window.location.hash = route;
}

// Sync hash → signal on popstate
function syncRoute(): void {
  const hash = window.location.hash.slice(1) as Route;
  const valid: Route[] = ["hub", "energy", "timeline", "journal"];
  currentRoute.value = valid.includes(hash) ? hash : "hub";
}

export function initRouter(): void {
  syncRoute();
  window.addEventListener("hashchange", syncRoute);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mini-app/router.ts
git commit -m "feat: add hash-based router with Preact signals"
```

### Task 7: Create styles (migrate from public/style.css)

**Files:**
- Create: `src/mini-app/styles/variables.css`
- Create: `src/mini-app/styles/global.css`

- [ ] **Step 1: Create `variables.css` — design tokens**

Extract `:root` variables from `public/style.css`:

```css
/* src/mini-app/styles/variables.css */
:root {
  --bg: #0d0d0f;
  --surface: #1a1a1f;
  --surface2: #242429;
  --text: #f0ede8;
  --text2: #8a8690;
  --accent: #c8ff73;
  --physical: #5be07a;
  --mental: #5ba8ff;
  --emotional: #ff8c5b;
  --spiritual: #c77dff;
  --radius: 20px;
  --nav-h: 72px;

  /* Telegram theme overrides (set by syncTheme) */
  --tg-bg: var(--bg);
  --tg-text: var(--text);
  --tg-hint: var(--text2);
  --tg-button: var(--accent);
  --tg-surface: var(--surface);
}
```

- [ ] **Step 2: Create `global.css` — base styles + animations**

Copy the base styles, animations, and component styles from `public/style.css`. This is a direct migration — keep everything from the original CSS file.

```css
/* src/mini-app/styles/global.css */
@import "./variables.css";

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Outfit', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

.hidden { display: none !important; }

/* Copy ALL remaining styles from public/style.css here */
/* (screens, header, rings, observations, nav, timeline, journal, etc.) */
```

**Note to implementer:** Copy the entire contents of `public/style.css` into `global.css` after the variables import. Do not omit any styles — this is a 1:1 migration.

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/styles/variables.css src/mini-app/styles/global.css
git commit -m "feat: migrate CSS to Vite — design tokens + global styles"
```

---

## Chunk 4: Port Existing Views to Preact Components

### Task 8: Create shared components

**Files:**
- Create: `src/mini-app/components/shared/Card.tsx`
- Create: `src/mini-app/components/shared/Loading.tsx`
- Create: `src/mini-app/components/shared/BottomNav.tsx`

- [ ] **Step 1: Create `Card.tsx`**

```tsx
// src/mini-app/components/shared/Card.tsx
import { ComponentChildren } from "preact";

interface CardProps {
  children: ComponentChildren;
  class?: string;
  onClick?: () => void;
}

export function Card({ children, class: cls, onClick }: CardProps) {
  return (
    <div
      class={`card-surface ${cls ?? ""}`}
      onClick={onClick}
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius)",
        padding: "16px",
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `Loading.tsx`**

```tsx
// src/mini-app/components/shared/Loading.tsx

export function LoadingScreen() {
  return (
    <div class="screen loading-screen">
      <div class="pulse-ring" />
      <p class="loading-text">Загружаю...</p>
    </div>
  );
}

export function WelcomeScreen({ message }: { message?: string }) {
  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <div class="welcome-content">
        <div class="welcome-icon">✨</div>
        <h1>Привет!</h1>
        <p>{message ?? "Напиши боту как ты себя чувствуешь — я начну отслеживать твою энергию."}</p>
      </div>
    </div>
  );
}

export function ErrorScreen() {
  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <div class="welcome-content">
        <div class="welcome-icon">😔</div>
        <h1>Не удалось загрузить</h1>
        <p>Проверь соединение и попробуй снова</p>
        <button class="retry-btn" onClick={() => location.reload()}>
          🔄 Повторить
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `BottomNav.tsx`**

```tsx
// src/mini-app/components/shared/BottomNav.tsx
import { hapticSelection } from "../../telegram";
import { navigate, currentRoute, type Route } from "../../router";

interface NavItem {
  route: Route;
  label: string;
  icon: string; // SVG path
}

const items: NavItem[] = [
  {
    route: "hub",
    label: "Главная",
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  },
  {
    route: "energy",
    label: "Энергия",
    icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  },
  {
    route: "timeline",
    label: "Динамика",
    icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  },
  {
    route: "journal",
    label: "Дневник",
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  },
];

export function BottomNav() {
  const active = currentRoute.value;

  return (
    <nav class="bottom-nav">
      {items.map((item) => (
        <button
          key={item.route}
          class={`nav-btn ${active === item.route ? "active" : ""}`}
          onClick={() => {
            hapticSelection();
            navigate(item.route);
          }}
        >
          <div class="nav-icon-wrap">
            <svg
              class="nav-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              dangerouslySetInnerHTML={{ __html: item.icon }}
            />
          </div>
          <span class="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/mini-app/components/shared/
git commit -m "feat: add shared components — Card, Loading, BottomNav"
```

### Task 9: Create energy store and Energy components

**Files:**
- Create: `src/mini-app/store/energy.ts`
- Create: `src/mini-app/components/energy/EnergyRings.tsx`
- Create: `src/mini-app/components/energy/Observations.tsx`
- Create: `src/mini-app/components/energy/Analytics.tsx`
- Create: `src/mini-app/components/energy/EnergyDashboard.tsx`

- [ ] **Step 1: Create energy store**

```typescript
// src/mini-app/store/energy.ts
import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { DashboardData, Observation, AnalyticsData } from "../api/types";

export const dashboardData = signal<DashboardData | null>(null);
export const observations = signal<Observation[]>([]);
export const analyticsData = signal<AnalyticsData | null>(null);
export const isLoading = signal(true);
export const hasError = signal(false);
export const hasNoData = signal(false);

let loaded = false;

export async function loadInitialData(): Promise<void> {
  if (loaded) return;
  loaded = true;
  isLoading.value = true;
  hasError.value = false;

  try {
    const [dashboard, obsData] = await Promise.all([
      api.dashboard().catch(() => null),
      api.observations().catch(() => ({ observations: [], stats: { total: 0 } })),
    ]);

    const noData =
      (!dashboard || "error" in dashboard) &&
      obsData.stats.total === 0;

    if (noData) {
      hasNoData.value = true;
      isLoading.value = false;
      return;
    }

    if (dashboard && !("error" in dashboard)) {
      dashboardData.value = dashboard;
    }

    observations.value = obsData.observations;

    // Load analytics if enough data
    if (obsData.stats.total >= 3) {
      api.analytics().then((data) => {
        analyticsData.value = data;
      }).catch(() => {});
    }

    isLoading.value = false;
  } catch {
    hasError.value = true;
    isLoading.value = false;
  }
}
```

- [ ] **Step 2: Create `EnergyRings.tsx`**

Port the SVG ring rendering from `app.js:renderRings()`:

```tsx
// src/mini-app/components/energy/EnergyRings.tsx
import { useEffect, useRef } from "preact/hooks";
import type { DashboardData } from "../../api/types";

const types = [
  { key: "physical", emoji: "🏃", label: "Физическая" },
  { key: "mental", emoji: "🧠", label: "Ментальная" },
  { key: "emotional", emoji: "💚", label: "Эмоциональная" },
  { key: "spiritual", emoji: "🔮", label: "Духовная" },
] as const;

interface Props {
  data: DashboardData;
}

export function EnergyRings({ data }: Props) {
  return (
    <>
      <div class="energy-rings">
        {types.map((t, i) => (
          <RingCard
            key={t.key}
            type={t.key}
            emoji={t.emoji}
            label={t.label}
            value={data[t.key]}
            delay={i * 120}
          />
        ))}
      </div>
      {data.loggedAt && (
        <p class="last-update">
          Обновлено{" "}
          {new Date(data.loggedAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </>
  );
}

function RingCard({
  type,
  emoji,
  label,
  value,
  delay,
}: {
  type: string;
  emoji: string;
  label: string;
  value: number;
  delay: number;
}) {
  const fillRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const offset = 264 - (value / 10) * 264;
    const timer = setTimeout(() => {
      if (fillRef.current) {
        fillRef.current.style.strokeDashoffset = String(offset);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div class="ring-card" data-type={type}>
      <div class="ring-wrap">
        <svg viewBox="0 0 100 100">
          <circle class="ring-bg" cx="50" cy="50" r="42" />
          <circle ref={fillRef} class="ring-fill" cx="50" cy="50" r="42" />
        </svg>
        <div class="ring-inner">
          <span class="ring-val">{value || "—"}</span>
          <span class="ring-emoji">{emoji}</span>
        </div>
      </div>
      <span class="ring-label">{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `Observations.tsx`**

Port `renderObservations()` from `app.js`:

```tsx
// src/mini-app/components/energy/Observations.tsx
import type { Observation } from "../../api/types";
import { getTimeAgo } from "./utils";

const emojiMap: Record<string, string> = {
  physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮",
};
const dirNames: Record<string, string> = {
  drop: "↓ просадка", rise: "↑ рост", low: "↓ низкая", high: "↑ высокая", stable: "— стабильно",
};
const dirIcons: Record<string, string> = {
  drop: "🔻", rise: "🔺", low: "🔻", high: "🔺", stable: "➖",
};

interface Props {
  observations: Observation[];
}

export function Observations({ observations }: Props) {
  if (observations.length === 0) return null;

  const todayKey = new Date().toISOString().split("T")[0];
  const todayObs = observations.filter((o) => o.createdAt.split("T")[0] === todayKey);
  const notable = observations
    .filter((o) => ["drop", "rise", "low"].includes(o.direction))
    .slice(0, 5);

  if (todayObs.length === 0 && notable.length === 0) return null;

  return (
    <div class="observations-section">
      <h2 class="section-title">Последние наблюдения</h2>
      <div class="obs-list">
        {todayObs.length > 0 && (
          <div class="obs-today-card">
            <div class="obs-today-title">Сегодня</div>
            <div class="obs-today-items">
              {todayObs.map((o) => (
                <div key={o.id} class="obs-today-item">
                  <span>{emojiMap[o.energyType] ?? "•"} {dirIcons[o.direction] ?? ""}</span>
                  <span class="obs-today-text">{o.trigger ?? o.context ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {notable.map((o, i) => (
          <div key={o.id} class="obs-item" style={{ animationDelay: `${i * 0.06}s` }}>
            <span class="obs-emoji">{emojiMap[o.energyType] ?? "•"}</span>
            <div class="obs-body">
              <div class="obs-text">{o.context ?? o.trigger ?? ""}</div>
              <div class="obs-meta">
                <span class={`obs-tag ${o.direction}`}>{dirNames[o.direction] ?? o.direction}</span>
                <span>{getTimeAgo(new Date(o.createdAt))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `utils.ts` helpers**

```typescript
// src/mini-app/components/energy/utils.ts

export function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function getDayWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "дней";
  if (last > 1 && last < 5) return "дня";
  if (last === 1) return "день";
  return "дней";
}

export function getNoteWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "записей";
  if (last > 1 && last < 5) return "записи";
  if (last === 1) return "запись";
  return "записей";
}
```

- [ ] **Step 5: Create `Analytics.tsx`**

```tsx
// src/mini-app/components/energy/Analytics.tsx
import type { AnalyticsData } from "../../api/types";

interface Props {
  data: AnalyticsData;
}

export function Analytics({ data }: Props) {
  if (!data?.insights) return null;

  const text = Array.isArray(data.insights) ? data.insights.join("\n") : data.insights;
  const items = text.split(/\n(?=\d+\.)/).filter((s) => s.trim());

  return (
    <div class="analytics-section">
      <h2 class="section-title">Паттерны</h2>
      <div class="analytics-content">
        {items.length <= 1 ? (
          <div class="analytics-card" dangerouslySetInnerHTML={{ __html: formatInsight(text) }} />
        ) : (
          items.map((item, i) => (
            <div key={i} class="analytics-card" dangerouslySetInnerHTML={{ __html: formatInsight(item.trim()) }} />
          ))
        )}
      </div>
    </div>
  );
}

function formatInsight(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}
```

- [ ] **Step 6: Create `EnergyDashboard.tsx` — combines everything**

```tsx
// src/mini-app/components/energy/EnergyDashboard.tsx
import { useEffect } from "preact/hooks";
import { dashboardData, observations, analyticsData, loadInitialData, isLoading, hasError, hasNoData } from "../../store/energy";
import { EnergyRings } from "./EnergyRings";
import { Observations } from "./Observations";
import { Analytics } from "./Analytics";
import { LoadingScreen, WelcomeScreen, ErrorScreen } from "../shared/Loading";
import { getDayWord } from "./utils";
import { api } from "../../api/client";
import { haptic } from "../../telegram";
import { getTelegramUser } from "../../telegram";
import { signal } from "@preact/signals";

const checkinState = signal<"idle" | "sending" | "sent">("idle");

export function EnergyDashboard() {
  useEffect(() => {
    loadInitialData();
  }, []);

  if (isLoading.value) return <LoadingScreen />;
  if (hasError.value) return <ErrorScreen />;
  if (hasNoData.value) return <WelcomeScreen />;

  const data = dashboardData.value;
  const obs = observations.value;
  const analytics = analyticsData.value;
  const user = getTelegramUser();

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 6 ? "Доброй ночи," :
    hour < 12 ? "Доброе утро," :
    hour < 18 ? "Добрый день," :
    "Добрый вечер,";

  const handleCheckin = async () => {
    if (checkinState.value !== "idle") return;
    haptic("medium");
    checkinState.value = "sending";
    try {
      await api.triggerCheckin();
      checkinState.value = "sent";
      setTimeout(() => { checkinState.value = "idle"; }, 3000);
    } catch {
      checkinState.value = "idle";
    }
  };

  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <header class="app-header">
        <div class="header-left">
          <div class="greeting">
            <span class="greeting-hi">{greeting}</span>
            <span class="greeting-name">{user?.first_name ?? ""}</span>
          </div>
          {data && data.streak > 0 && (
            <div class="streak-badge">
              🔥 {data.streak} {getDayWord(data.streak)} подряд
            </div>
          )}
        </div>
        <div class="date">
          {now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}
        </div>
      </header>

      <main class="views">
        <section class="view">
          {data ? (
            <EnergyRings data={data} />
          ) : (
            <div class="dashboard-empty-msg">
              Расскажи боту как ты себя чувствуешь — я начну отслеживать 🌱
            </div>
          )}

          <Observations observations={obs} />
          {analytics && <Analytics data={analytics} />}

          <button class="quick-checkin-btn" onClick={handleCheckin} disabled={checkinState.value !== "idle"}>
            {checkinState.value === "sending" ? "Отправляю..." :
             checkinState.value === "sent" ? "✓ Бот напишет тебе" :
             "⚡ Записать энергию"}
          </button>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/mini-app/store/ src/mini-app/components/energy/
git commit -m "feat: port energy dashboard to Preact — rings, observations, analytics"
```

### Task 10: Create Timeline and Journal components

**Files:**
- Create: `src/mini-app/components/timeline/Timeline.tsx`
- Create: `src/mini-app/components/journal/Journal.tsx`

- [ ] **Step 1: Create `Timeline.tsx` — Chart.js wrapper**

```tsx
// src/mini-app/components/timeline/Timeline.tsx
import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import Chart from "chart.js/auto";
import { api } from "../../api/client";
import type { HistoryPoint } from "../../api/types";

const period = signal<"week" | "month">("week");
const data = signal<HistoryPoint[]>([]);
const isEmpty = signal(false);

export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    loadData(period.value);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || data.value.length === 0) return;
    renderChart(canvasRef.current, data.value, chartRef);
    return () => { chartRef.current?.destroy(); };
  }, [data.value]);

  async function loadData(p: "week" | "month") {
    period.value = p;
    try {
      const result = await api.history(p);
      data.value = result;
      isEmpty.value = result.length === 0;
    } catch {
      isEmpty.value = true;
    }
  }

  return (
    <section class="view">
      <div class="timeline-header">
        <div class="period-pills">
          <button
            class={`pill ${period.value === "week" ? "active" : ""}`}
            onClick={() => loadData("week")}
          >
            7 дней
          </button>
          <button
            class={`pill ${period.value === "month" ? "active" : ""}`}
            onClick={() => loadData("month")}
          >
            30 дней
          </button>
        </div>
      </div>
      <div class="chart-wrap">
        <canvas ref={canvasRef} />
      </div>
      {isEmpty.value && <p class="empty-msg">Пока нет данных</p>}
    </section>
  );
}

function renderChart(
  canvas: HTMLCanvasElement,
  points: HistoryPoint[],
  chartRef: { current: Chart | null }
) {
  chartRef.current?.destroy();

  const ctx = canvas.getContext("2d")!;
  const h = canvas.offsetHeight || 240;

  function grad(r: number, g: number, b: number) {
    const g2 = ctx.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, `rgba(${r},${g},${b},0.28)`);
    g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
    return g2;
  }

  const labels = points.map((d) =>
    new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
  );

  const opts = { tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: true };

  chartRef.current = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Физ", data: points.map((d) => d.physical), borderColor: "#5be07a", backgroundColor: grad(91, 224, 122), ...opts },
        { label: "Мент", data: points.map((d) => d.mental), borderColor: "#5ba8ff", backgroundColor: grad(91, 168, 255), ...opts },
        { label: "Эмоц", data: points.map((d) => d.emotional), borderColor: "#ff8c5b", backgroundColor: grad(255, 140, 91), ...opts },
        { label: "Дух", data: points.map((d) => d.spiritual), borderColor: "#c77dff", backgroundColor: grad(199, 125, 255), ...opts },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0, max: 10,
          ticks: { color: "#8a8690", stepSize: 2, font: { family: "Outfit", size: 11 } },
          grid: { color: "rgba(255,255,255,0.04)" },
          border: { display: false },
        },
        x: {
          ticks: { color: "#8a8690", maxRotation: 0, font: { family: "Outfit", size: 10 } },
          grid: { display: false },
          border: { display: false },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8a8690", padding: 16, font: { family: "Outfit", size: 11 }, boxWidth: 12, boxHeight: 2, useBorderRadius: true, borderRadius: 2 },
        },
        tooltip: {
          backgroundColor: "#1a1a1f",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          titleColor: "#f0ede8",
          bodyColor: "#8a8690",
          titleFont: { family: "Outfit", size: 12, weight: "bold" },
          bodyFont: { family: "Outfit", size: 11 },
          padding: 10,
          cornerRadius: 10,
          displayColors: true,
          boxWidth: 8, boxHeight: 8,
        },
      },
      interaction: { intersect: false, mode: "index" },
    },
  });
}
```

- [ ] **Step 2: Create `Journal.tsx`**

```tsx
// src/mini-app/components/journal/Journal.tsx
import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { api } from "../../api/client";
import type { Observation } from "../../api/types";
import { getNoteWord, getTimeAgo } from "../energy/utils";

const entries = signal<Observation[]>([]);
const isLoading = signal(true);
const hasError = signal(false);

const emojiMap: Record<string, string> = { physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮" };
const typeNames: Record<string, string> = { physical: "Физическая", mental: "Ментальная", emotional: "Эмоциональная", spiritual: "Духовная" };
const dirNames: Record<string, string> = { drop: "просадка", rise: "рост", low: "низкая", high: "высокая", stable: "стабильно" };

export function Journal() {
  useEffect(() => {
    isLoading.value = true;
    api.observations()
      .then((data) => {
        entries.value = data.observations;
        isLoading.value = false;
      })
      .catch(() => {
        hasError.value = true;
        isLoading.value = false;
      });
  }, []);

  if (isLoading.value) {
    return (
      <section class="view">
        <div class="journal-loading">
          <div class="pulse-ring small" />
          <p>Загружаю дневник...</p>
        </div>
      </section>
    );
  }

  if (hasError.value) {
    return (
      <section class="view">
        <div class="journal-empty-state">
          <div class="journal-empty-icon">😔</div>
          <p>Не удалось загрузить дневник</p>
        </div>
      </section>
    );
  }

  if (entries.value.length === 0) {
    return (
      <section class="view">
        <div class="journal-empty-state">
          <div class="journal-empty-icon">📝</div>
          <p>Твой дневник энергии пока пуст. Каждый разговор с ботом добавит запись сюда</p>
        </div>
      </section>
    );
  }

  // Group by day
  const todayKey = new Date().toISOString().split("T")[0];
  const yesterdayKey = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const grouped: Record<string, Observation[]> = {};
  for (const o of entries.value) {
    const key = o.createdAt.split("T")[0];
    (grouped[key] ??= []).push(o);
  }

  // Sort entries within each day ascending
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const days = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));

  return (
    <section class="view">
      <div class="journal-timeline">
        {days.map(([dateKey, obs]) => {
          const isToday = dateKey === todayKey;
          const isYesterday = dateKey === yesterdayKey;
          const dateLabel = isToday ? "Сегодня" :
            isYesterday ? "Вчера" :
            new Date(dateKey + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

          return (
            <div key={dateKey} class="tl-day">
              <div class="tl-day-header">
                <span class={`tl-day-label ${isToday ? "today" : ""}`}>{dateLabel}</span>
                <span class="tl-day-meta">{obs.length} {getNoteWord(obs.length)}</span>
              </div>
              <div class="tl-entries">
                {obs.map((o) => {
                  const time = new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={o.id} class="tl-entry">
                      <div class="tl-time">{time}</div>
                      <div class="tl-line"><div class="tl-dot" data-type={o.energyType} /></div>
                      <div class="tl-card" data-type={o.energyType}>
                        <div class="tl-card-top">
                          <span class="tl-type-name">{emojiMap[o.energyType] ?? "•"} {typeNames[o.energyType] ?? o.energyType}</span>
                          <span class={`tl-dir ${o.direction}`}>{dirNames[o.direction] ?? o.direction}</span>
                        </div>
                        {o.context && <div class="tl-context">{o.context}</div>}
                        {o.trigger && o.trigger !== o.context && <div class="tl-trigger">{o.trigger}</div>}
                        {o.recommendation && <div class="tl-rec">💡 {o.recommendation}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/components/timeline/ src/mini-app/components/journal/
git commit -m "feat: port Timeline (Chart.js) and Journal to Preact components"
```

### Task 11: Wire up App root with router

**Files:**
- Modify: `src/mini-app/main.tsx`
- Create: `src/mini-app/app.tsx`
- Create: `src/mini-app/store/index.ts`

- [ ] **Step 1: Create `store/index.ts`**

```typescript
// src/mini-app/store/index.ts
export { dashboardData, observations, analyticsData, isLoading, hasError, hasNoData, loadInitialData } from "./energy";
```

- [ ] **Step 2: Create `app.tsx` — root component with routing**

```tsx
// src/mini-app/app.tsx
import { currentRoute, initRouter } from "./router";
import { initTelegram, syncTheme } from "./telegram";
import { EnergyDashboard } from "./components/energy/EnergyDashboard";
import { Timeline } from "./components/timeline/Timeline";
import { Journal } from "./components/journal/Journal";
import { BottomNav } from "./components/shared/BottomNav";
import { useEffect } from "preact/hooks";

export function App() {
  useEffect(() => {
    initTelegram();
    syncTheme();
    initRouter();
  }, []);

  const route = currentRoute.value;

  return (
    <>
      {(route === "hub" || route === "energy") && <EnergyDashboard />}
      {route === "timeline" && <Timeline />}
      {route === "journal" && <Journal />}
      <BottomNav />
    </>
  );
}
```

- [ ] **Step 3: Update `main.tsx`**

```tsx
// src/mini-app/main.tsx
import { render } from "preact";
import { App } from "./app";
import "./styles/global.css";

render(<App />, document.getElementById("app")!);
```

- [ ] **Step 4: Verify full build**

```bash
npm run build
```

Expected: Clean build. `dist/client/` contains compiled Mini App. `dist/` contains backend.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All tests pass (including new telegram-auth tests).

- [ ] **Step 6: Commit**

```bash
git add src/mini-app/app.tsx src/mini-app/main.tsx src/mini-app/store/index.ts
git commit -m "feat: wire up App root with router — Phase 1 frontend complete"
```

---

## Chunk 5: Hub Dashboard (v2 card layout) + Cleanup

### Task 12: Create Hub dashboard with widget cards

The spec calls for a hub-and-spoke pattern: main screen shows summary cards, tapping goes to detail. For Phase 1, only the energy card is real — the rest are placeholders for future phases.

**Files:**
- Create: `src/mini-app/components/hub/Hub.tsx`
- Create: `src/mini-app/components/hub/EnergyCard.tsx`
- Modify: `src/mini-app/app.tsx`

- [ ] **Step 1: Create `EnergyCard.tsx` — compact energy summary for hub**

```tsx
// src/mini-app/components/hub/EnergyCard.tsx
import { dashboardData } from "../../store/energy";
import { haptic } from "../../telegram";
import { navigate } from "../../router";
import { getDayWord } from "../energy/utils";

export function EnergyCard() {
  const data = dashboardData.value;

  const handleClick = () => {
    haptic("light");
    navigate("energy");
  };

  if (!data) {
    return (
      <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
        <div class="hub-card-title">⚡ Энергия</div>
        <div class="hub-card-empty">Расскажи боту как дела — появится первая запись</div>
      </div>
    );
  }

  const types = [
    { key: "physical" as const, emoji: "🏃", color: "var(--physical)" },
    { key: "mental" as const, emoji: "🧠", color: "var(--mental)" },
    { key: "emotional" as const, emoji: "💚", color: "var(--emotional)" },
    { key: "spiritual" as const, emoji: "🔮", color: "var(--spiritual)" },
  ];

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">⚡ Энергия</span>
        {data.streak > 0 && (
          <span class="hub-card-badge">🔥 {data.streak} {getDayWord(data.streak)}</span>
        )}
      </div>
      <div class="hub-energy-grid">
        {types.map((t) => (
          <div key={t.key} class="hub-energy-item">
            <span class="hub-energy-emoji">{t.emoji}</span>
            <span class="hub-energy-val" style={{ color: t.color }}>{data[t.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `Hub.tsx`**

```tsx
// src/mini-app/components/hub/Hub.tsx
import { useEffect } from "preact/hooks";
import { EnergyCard } from "./EnergyCard";
import { loadInitialData, isLoading, hasError, hasNoData } from "../../store/energy";
import { LoadingScreen, WelcomeScreen, ErrorScreen } from "../shared/Loading";
import { getTelegramUser } from "../../telegram";

export function Hub() {
  useEffect(() => {
    loadInitialData();
  }, []);

  if (isLoading.value) return <LoadingScreen />;
  if (hasError.value) return <ErrorScreen />;
  if (hasNoData.value) return <WelcomeScreen />;

  const user = getTelegramUser();
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 6 ? "Доброй ночи," :
    hour < 12 ? "Доброе утро," :
    hour < 18 ? "Добрый день," :
    "Добрый вечер,";

  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <header class="app-header">
        <div class="header-left">
          <div class="greeting">
            <span class="greeting-hi">{greeting}</span>
            <span class="greeting-name">{user?.first_name ?? ""}</span>
          </div>
        </div>
        <div class="date">
          {now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}
        </div>
      </header>

      <main class="views">
        <div class="hub-grid">
          <EnergyCard />
          {/* Phase 2: BalanceCard */}
          {/* Phase 3: HabitsCard */}
          {/* Phase 4: TasksCard */}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add hub styles to `global.css`**

Append to `src/mini-app/styles/global.css`:

```css
/* ── Hub Dashboard ── */
.hub-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.hub-card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s;
  animation: cardIn 0.4s ease both;
}
.hub-card:active { transform: scale(0.97); }

.hub-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.hub-card-title { font-size: 14px; font-weight: 600; }
.hub-card-badge {
  font-size: 11px; font-weight: 500;
  padding: 2px 8px; border-radius: 10px;
  background: rgba(200,255,115,0.12); color: var(--accent);
}
.hub-card-empty {
  font-size: 13px; color: var(--text2); line-height: 1.4;
  padding: 8px 0;
}

.hub-energy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
  text-align: center;
}
.hub-energy-item {
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
}
.hub-energy-emoji { font-size: 16px; }
.hub-energy-val { font-size: 20px; font-weight: 700; }
```

- [ ] **Step 4: Update `app.tsx` — add Hub route**

```tsx
// Updated routing in app.tsx
{route === "hub" && <Hub />}
{route === "energy" && <EnergyDashboard />}
{route === "timeline" && <Timeline />}
{route === "journal" && <Journal />}
```

Add import: `import { Hub } from "./components/hub/Hub";`

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/mini-app/components/hub/ src/mini-app/styles/global.css src/mini-app/app.tsx
git commit -m "feat: add Hub dashboard with energy widget card"
```

### Task 13: Final cleanup and verification

- [ ] **Step 1: Verify `public/` is no longer served**

The old `public/index.html`, `public/app.js`, and `public/style.css` are now dead code. Don't delete yet — keep as reference until Phase 1 is deployed and verified in production.

- [ ] **Step 2: Full build + test**

```bash
npm run build && npm test
```

Expected: All pass. `dist/client/index.html` exists with bundled Preact app.

- [ ] **Step 3: Test dev mode**

```bash
npm run dev
```

Expected: Both servers start. Vite at 5173, backend at 8080. Vite proxies API calls.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 frontend foundation complete"
```

- [ ] **Step 5: (After production verification) Remove old public/ files**

```bash
git rm public/index.html public/app.js public/style.css
git commit -m "chore: remove legacy vanilla JS Mini App (replaced by Preact)"
```
