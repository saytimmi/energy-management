import express from "express";
import path from "path";
import http from "http";
import { Router } from "express";
import { dashboardRoute } from "./api/dashboard.js";
import { historyRoute } from "./api/history.js";
import { analyticsRoute } from "./api/analytics.js";
import { observationsRoute } from "./api/observations.js";
import { checkinTriggerRoute } from "./api/checkin-trigger.js";
import { habitsRoute } from "./api/habits.js";
import { diagnosticsRoute } from "./api/diagnostics.js";
import balanceRoute from "./api/balance.js";
import { kaizenApiRoutes } from "./api/kaizen-api.js";
import { missionRoute } from "./api/mission.js";
import { goalsRoute } from "./api/goals.js";
import { strategyRoute } from "./api/strategy.js";
import { digestsRoute } from "./api/digests.js";
import { energyRoute, configRoute } from "./api/energy.js";
import { settingsRoute } from "./api/settings.js";
import { telegramAuth } from "./middleware/telegram-auth.js";
import { config } from "./config.js";

let server: http.Server | null = null;

export function startServer(port?: number): http.Server {
  const app = express();
  const listenPort = port ?? config.port;

  // CORS for Telegram WebView
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
  });

  app.use(express.json());

  // Serve Vite-built frontend (replaces public/)
  const clientPath = path.resolve(process.cwd(), "dist", "client");
  app.use(express.static(clientPath));

  // Public API routes (no auth)
  const apiRouter = Router();
  diagnosticsRoute(apiRouter);
  configRoute(apiRouter);
  app.use("/api", apiRouter);

  // Authenticated API routes
  const authedRouter = Router();
  authedRouter.use(telegramAuth);
  dashboardRoute(authedRouter);
  historyRoute(authedRouter);
  analyticsRoute(authedRouter);
  observationsRoute(authedRouter);
  checkinTriggerRoute(authedRouter);
  habitsRoute(authedRouter);
  balanceRoute(authedRouter);
  kaizenApiRoutes(authedRouter);
  missionRoute(authedRouter);
  goalsRoute(authedRouter);
  strategyRoute(authedRouter);
  energyRoute(authedRouter);
  settingsRoute(authedRouter);
  digestsRoute(authedRouter);
  app.use("/api", authedRouter);

  server = app.listen(listenPort, "0.0.0.0", () => {
    console.log(`HTTP server listening on 0.0.0.0:${listenPort}`);
  });

  return server;
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
