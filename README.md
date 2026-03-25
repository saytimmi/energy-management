# RuFlo — Personal OS

> Персональная операционная система для управления жизнью через Telegram

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot%20%2B%20Mini%20App-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots)
[![Preact](https://img.shields.io/badge/Preact-10-673AB8?logo=preact&logoColor=white)](https://preactjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Обзор

RuFlo — это Telegram бот с Mini App, который работает как персональная операционная система для управления жизнью. Система объединяет шесть ключевых модулей в единый каскад: от формулировки жизненной миссии до ежедневных привычек и отслеживания энергии, замыкая цикл через рефлексию и непрерывное улучшение.

В основе лежит 6-слойный каскад:

```
🧭 Миссия → 🎯 Цели → 🪞 Идентичность → ⚡ Привычки → 🔋 Энергия → 🧠 Кайдзен → цикл
⚖️ Баланс = отдельная метрика удовлетворённости (не цель, а измерение)
```

Бот обеспечивает быстрые действия и push-уведомления, а Mini App предоставляет визуальный интерфейс для глубокой аналитики и управления. AI-коуч на базе Claude связывает все модули, используя 18 инструментов (Tool Use) для контекстных диалогов и проактивных подсказок.

Проект прошёл через 10 фаз разработки и находится в production-ready состоянии.

---

## Возможности

### 🔋 Отслеживание энергии

- Ежедневная оценка 4 типов энергии: физическая, ментальная, эмоциональная, духовная
- Severity-based checkin — адаптивные вопросы в зависимости от изменения уровня (critical / moderate / mild / improved / stable)
- Trigger picker — выбор причин изменения энергии
- Мгновенные рекомендации из knowledge base
- AI-аналитика паттернов и наблюдения за 30 дней

### ⚡ Привычки

- **Мгновенные** — тап и готово; **Длительные** — с таймером (начать → выполнять → завершить)
- **Meaning Framework** — обязательное осмысление при создании (Build: 4 вопроса / Break: 3 вопроса)
- **Forgiving Streaks** — grace period (2 пропуска/неделю), сила привычки (strength 0-100), stage-aware система (seed → growth → autopilot)
- **Routine Stacking** — fullscreen flow с пошаговым таймером для утренних/дневных/вечерних рутин
- **Гибкая частота** — daily, weekdays, custom days; targetPerWeek для расчёта consistency
- **Pause / Vacation Mode** — заморозка стриков на 3-30 дней с auto-resume
- **Связь с целями** — привычка привязывается к цели через goalId

### ⚖️ Баланс жизни

- Колесо жизни: 8 сфер (здоровье, карьера, отношения, финансы, дом, развитие, духовность, отдых)
- AI-guided оценка с subScores по аспектам
- Radar chart визуализация
- Фокус-сферы с идентичностями («Я — человек, который...»)
- Inline rate overlay для быстрой переоценки

### 🧠 Кайдзен

- Ежедневная рефлексия (кайдзен-час) через диалог с AI
- Персональная библиотека алгоритмов — база знаний с инсайтами из рефлексий
- Еженедельные AI-дайджесты с анализом прогресса и рекомендациями
- Сохранение дайджестов в БД с отображением в Mini App

### 🎯 Стратегия

- Миссия — формулировка через 3 последовательных вопроса
- Цели на год и квартал с метриками (metric, targetValue, currentValue) и трекингом прогресса
- Связь Goal → Habit — привычки группируются под целями в Strategy Screen
- Milestones (JSON) для пошагового отслеживания
- Quarterly и yearly review через cron

### 🤖 AI Coach

- 18 инструментов Tool Use (создание привычек, оценка баланса, постановка целей, рефлексия и др.)
- Полный контекст пользователя при каждом сообщении (энергия, баланс, цели, привычки, алгоритмы, наблюдения)
- Awareness System — 11 типов пробелов в данных с приоритизацией
- Proactive Smart Nudges — 8 типов ежедневных подсказок (goal-habit gap, streak at risk, energy pattern и др.)
- Голосовые сообщения через Groq Whisper
- Анти-GPT стиль — пишет как друг в Telegram, без списков и формальностей

### 🔔 Умные уведомления

- Timezone-aware cron система через hourly poll + `getUsersByLocalHour()`
- Утренние/дневные/вечерние напоминания привычек (7:00 / 13:00 / 20:00)
- Ежедневный smart nudge в 9:00 (один с наивысшим приоритетом)
- Напоминание рефлексии, переоценки баланса, пересмотра целей
- Vacation mode — полное отключение всех уведомлений

---

## Скриншоты

> _Раздел будет дополнен скриншотами Mini App._

<!-- Примеры:
![Hub](docs/screenshots/hub.png)
![Energy Dashboard](docs/screenshots/energy.png)
![Habits](docs/screenshots/habits.png)
![Balance Radar](docs/screenshots/balance.png)
-->

---

## Tech Stack

| Слой | Технологии |
|------|------------|
| **Backend** | TypeScript, Node.js, Express 5, grammy (Telegram Bot API) |
| **Frontend** | Preact 10 + @preact/signals, Vite 5, Chart.js 4, Telegram Mini App SDK |
| **Database** | PostgreSQL (Neon), Prisma ORM (15 моделей) |
| **AI** | Anthropic Claude API (Sonnet — чат, Haiku — аналитика), Groq Whisper (voice) |
| **Deployment** | Railway (auto-deploy из main) |
| **Testing** | Vitest |

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (или [Neon](https://neon.tech/) для serverless)
- Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- Anthropic API Key
- Groq API Key (для голосовых сообщений)

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/your-username/energy-management.git
cd energy-management

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
# Заполнить .env: BOT_TOKEN, DATABASE_URL, ANTHROPIC_API_KEY, GROQ_API_KEY, WEBAPP_URL

# Применить миграции БД
npx prisma db push

# Запустить в dev-режиме (backend :8080 + frontend :5173 с proxy)
npm run dev
```

### Переменные окружения

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Telegram Bot Token |
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Ключ Anthropic API |
| `GROQ_API_KEY` | Ключ Groq API (voice transcription) |
| `WEBAPP_URL` | URL Mini App (production) |
| `PORT` | Порт сервера (default: 3000) |

---

## Структура проекта

```
src/
  index.ts                  # Точка входа: запуск бота + сервера
  server.ts                 # Express: API + статика Mini App
  bot.ts                    # grammy: Telegram бот + callback handlers
  config.ts                 # Env-переменные
  db.ts                     # Prisma client + findOrCreateUser

  middleware/                # Telegram initData HMAC-SHA256 валидация
  api/                      # Express роуты (15 модулей)
  handlers/                 # Telegram bot команды (7 handlers)
  services/                 # Бизнес-логика (18 сервисов)
  knowledge/                # Knowledge base (типы, данные, микро-действия)
  __tests__/                # Тесты (19 файлов, 117 тестов)

  mini-app/                 # Preact frontend
    store/                  # Signals-based state management (6 stores)
    api/                    # HTTP client + ~35 API methods
    components/
      hub/                  # Главный экран (5 виджетов)
      energy/               # Энергия: кольца, аналитика, чекин, триггеры
      habits/               # Привычки: карточки, создание, детали, рутины
      balance/              # Баланс: radar chart, детали сфер, стратегия
      kaizen/               # Кайдзен: рефлексия, алгоритмы, дайджесты
      settings/             # Настройки: timezone, vacation, уведомления
      shared/               # UI компоненты (Card, BottomNav, Loading, Skeleton)
    styles/                 # CSS переменные + глобальные стили (dark/light theme)

prisma/
  schema.prisma             # 15 моделей БД
```

---

## Архитектура

Приложение построено по принципу Domain-Driven Design с чётким разделением на слои:

- **API Layer** (`src/api/`) — Express роуты, валидация, авторизация
- **Service Layer** (`src/services/`) — бизнес-логика, AI-интеграция, cron jobs
- **Data Layer** (`src/db.ts` + Prisma) — доступ к данным, 15 моделей
- **Bot Layer** (`src/bot.ts` + `src/handlers/`) — Telegram bot handlers
- **Frontend** (`src/mini-app/`) — Preact SPA с signals-based state management

Аутентификация: `Authorization: tma <initData>` — HMAC-SHA256 валидация Telegram initData.

Подробная документация архитектуры: [`docs/architecture.md`](docs/architecture.md)

---

## API

REST API с 40+ endpoints, сгруппированных по доменам:

| Домен | Endpoints | Описание |
|-------|-----------|----------|
| Energy | 7 | Dashboard, history, analytics, observations, checkin, triggers |
| Habits | 13 | CRUD, start/complete, pause/resume, stats, correlation, heatmap |
| Balance | 5 | Overview, radar, area detail, goals, rate |
| Kaizen | 9 | Reflection status, algorithms CRUD, reflections, digests |
| Strategy | 6 | Mission CRUD, goals CRUD, combined strategy view |
| Settings | 2 | Timezone, vacation, notification preferences |
| System | 2 | Diagnostics (health check), config |

Полная документация API: [`docs/api.md`](docs/api.md)

---

## Тестирование

```bash
# Запуск всех тестов
npm test

# Запуск с watch-режимом
npx vitest
```

**Покрытие:** 19 test files, 117 tests

<details>
<summary>Список тестовых файлов</summary>

| Файл | Покрытие |
|------|----------|
| `energy-analysis.test.ts` | Severity calculation, analysis |
| `awareness.test.ts` | 11 типов awareness gaps |
| `meaning-identity.test.ts` | Meaning framework validation |
| `habit-streaks.test.ts` | Streaks, strength, stages |
| `habit-frequency.test.ts` | Flexible frequency logic |
| `diagnostics.test.ts` | Health checks |
| `recommendations.test.ts` | Energy recommendations |
| `knowledge.test.ts` | Knowledge base integrity |
| `knowledge-verify.test.ts` | Knowledge data validation |
| `micro-actions.test.ts` | Micro-actions library |
| `instant-recommendations.test.ts` | Instant recommendations |
| `router.test.ts` | Hash-based router |
| `telegram-auth.test.ts` | HMAC-SHA256 auth |
| `mission-api.test.ts` | Mission CRUD |
| `goals-api.test.ts` | Goals CRUD |
| `strategy-api.test.ts` | Strategy combined endpoint |
| `ai-tools-strategy.test.ts` | AI Tool Use for strategy |
| `goal-progress.test.ts` | Goal progress tracking |
| `digest-api.test.ts` | Weekly digests API |

</details>

---

## Деплой

Проект развёрнут на [Railway](https://railway.app/) с auto-deploy из ветки `main`.

```bash
# Build
npm run build    # prisma generate → tsc → vite build

# Start (production)
npm start        # prisma migrate deploy → node dist/index.js
```

Порт задаётся через env `PORT` (default: 3000). Railway автоматически предоставляет `PORT` и `DATABASE_URL`.

---

## Дизайн

Два режима оформления, синхронизированных с темой Telegram:

| | Dark (default) | Light |
|---|---|---|
| **Фон** | `#0c0d12` | `#f5f5f7` |
| **Accent** | `#c8ff73` (lime) | `#4a8c00` |
| **Стиль** | Glassmorphism | Clean minimal |

Skeleton loading с shimmer-анимацией, screen-enter transitions при навигации.

---

## Contributing

Contributions приветствуются. Перед отправкой PR убедитесь:

```bash
npm run build    # Билд проходит без ошибок
npm test         # Все тесты зелёные
```

---

## Лицензия

[MIT](LICENSE)
