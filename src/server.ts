import express from "express";
import path from "path";
import http from "http";
import { Router } from "express";
import { dashboardRoute } from "./api/dashboard.js";
import { config } from "./config.js";

let server: http.Server | null = null;

export function startServer(port?: number): http.Server {
  const app = express();
  const listenPort = port ?? config.port;

  // CORS for Telegram WebView
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Serve static files from public/ (relative to project root, not dist)
  const publicPath = path.resolve(process.cwd(), "public");
  app.use(express.static(publicPath));

  // API routes
  const apiRouter = Router();
  dashboardRoute(apiRouter);
  app.use("/api", apiRouter);

  server = app.listen(listenPort, () => {
    console.log(`HTTP server listening on port ${listenPort}`);
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
