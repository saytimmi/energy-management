# Energy ⚡ — AI Energy Coach

Telegram бот + Mini App для управления жизненной энергией. Отслеживает 4 типа энергии (физическая, ментальная, эмоциональная, духовная), помогает формировать привычки и находить паттерны.

## Quick Start

```bash
npm install
cp .env.example .env  # заполнить переменные
npm run dev            # backend + frontend (5173, proxy → 8080)
```

## Документация

Вся архитектура, API, дизайн-решения — в [CLAUDE.md](CLAUDE.md).

## Stack

TypeScript, Preact, Express, grammy, Prisma, PostgreSQL, Claude API, Vite.

## Deploy

Railway, auto-deploy из main. Подробности в CLAUDE.md.
