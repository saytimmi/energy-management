# Energy Management App

Telegram бот + Mini App для управления жизненной энергией и балансом. AI-powered life coach.

## Что это

Персональный AI коуч в Telegram. Четыре слоя:
1. **Мониторинг** — ежедневная оценка 4 типов энергии (физ/мент/эмоц/дух)
2. **Стратегия** — колесо баланса жизни (8 сфер) показывает где перекос
3. **Тактика** — привычки и задачи = конкретные ежедневные действия
4. **AI Coach** — связывает всё, адаптируется, учится

Бот = быстрые действия + push. Mini App = визуал + управление.

## Stack

**Backend:**
- TypeScript, Node.js, Express (port 8080)
- grammy — Telegram Bot API
- Prisma + PostgreSQL (Neon, на Railway)
- Anthropic Claude API — AI чат
- Gemini — транскрипция голосовых

**Frontend (Mini App):**
- Preact 10 (3KB) + @preact/signals
- Vite 5 — сборка + HMR
- Chart.js 4 — графики энергии
- CSS Modules (vanilla CSS с переменными)
- Telegram Mini App SDK — тема, haptic, initData

## Архитектура

```
src/
  index.ts              → точка входа, запуск бота + сервера
  server.ts             → Express: API + статика dist/client/
  bot.ts                → grammy: Telegram бот
  config.ts             → env переменные
  db.ts                 → Prisma client
  middleware/
    telegram-auth.ts    → initData HMAC-SHA256 валидация
  api/                  → Express роуты (за auth middleware)
    dashboard.ts        → GET /api/dashboard — энергия + streak
    history.ts          → GET /api/history — история по дням
    analytics.ts        → GET /api/analytics — AI паттерны
    observations.ts     → GET /api/observations — наблюдения
    checkin-trigger.ts  → GET /api/checkin-trigger — запуск чекина
    kaizen.ts           → GET /api/kaizen — диагностика (без auth)
  handlers/             → Telegram bot команды
    start.ts, help.ts, energy.ts, report.ts, kaizen.ts, checkin.ts
  services/             → Бизнес-логика
    ai.ts               → Claude API интеграция
    voice.ts            → Gemini транскрипция
    scheduler.ts        → node-cron расписание
    checkin-sender.ts   → Отправка чекинов по расписанию
    diagnostics.ts      → Health checks
    recommendations.ts  → AI рекомендации
    monitor.ts          → Error tracking
  knowledge/            → Системные промпты
  mini-app/             → Preact frontend (собирается Vite)
    main.tsx            → Entry point
    app.tsx             → Корневой компонент + роутинг
    router.ts           → Hash-based роутер (#hub, #energy, #timeline, #journal)
    telegram.ts         → Telegram SDK wrapper (тема, haptic, initData, BackButton)
    store/
      energy.ts         → Signals: dashboardData, observations, analyticsData
      index.ts          → Re-exports
    api/
      client.ts         → Fetch wrapper с Authorization: tma <initData>
      types.ts          → TypeScript типы для API responses
    components/
      hub/
        Hub.tsx         → Главный экран — карточки-виджеты
        EnergyCard.tsx  → Виджет энергии (4 значения + streak)
      energy/
        EnergyDashboard.tsx → Полный экран энергии (кольца + наблюдения + аналитика)
        EnergyRings.tsx     → SVG кольца с анимацией
        Observations.tsx    → Список наблюдений
        Analytics.tsx       → AI паттерны
        utils.ts            → Хелперы (getTimeAgo, getDayWord, getNoteWord)
      timeline/
        Timeline.tsx    → Chart.js график энергии (7/30 дней)
      journal/
        Journal.tsx     → Дневник наблюдений (группировка по дням)
      shared/
        Card.tsx        → Переиспользуемая карточка
        BottomNav.tsx   → Нижняя навигация (4 таба)
        Loading.tsx     → Loading/Welcome/Error экраны
    styles/
      variables.css     → Design tokens (цвета, размеры, Telegram тема)
      global.css        → Все стили (импорт variables.css)
prisma/
  schema.prisma         → Модели: User, EnergyLog, Message, Session, Observation, ErrorLog, Metric
```

## Навигация Mini App

Hub-and-spoke: главный экран с виджетами → тап на карточку → детальный вид → назад.

| Роут | Компонент | Что показывает |
|------|-----------|----------------|
| `#hub` | Hub | Виджеты-карточки: энергия (+ будущие: баланс, привычки, задачи) |
| `#energy` | EnergyDashboard | Кольца энергии, наблюдения, AI паттерны, кнопка чекина |
| `#timeline` | Timeline | Chart.js график 4 типов энергии за 7/30 дней |
| `#journal` | Journal | Хронологический дневник наблюдений |

Bottom nav: Главная → Энергия → Динамика → Дневник

## Аутентификация

**Mini App → API:** `Authorization: tma <Telegram.WebApp.initData>`
- Сервер валидирует HMAC-SHA256 через bot token
- Извлекает telegramId → ищет User → прикрепляет userId к req
- Fallback: `?telegramId=` query param (legacy, для старых ссылок из бота)

**Middleware:** `src/middleware/telegram-auth.ts` — применён ко всем API кроме /api/kaizen

## Build Pipeline

```bash
npm run build    # prisma generate && tsc && vite build
npm run dev      # concurrently: tsx watch (backend) + vite dev (frontend, port 5173, proxy /api → 8080)
npm test         # vitest run (41 тест)
```

- `tsc` компилирует backend → `dist/`
- `vite build` компилирует frontend → `dist/client/`
- Express раздаёт `dist/client/` как статику
- `tsconfig.json` excludes `src/mini-app/` (Vite обрабатывает)
- `tsconfig.app.json` — frontend-only конфиг (JSX, Preact)

## Deploy

Railway. Auto-deploy из main.
- Build: `npm run build` (в railway.toml)
- Start: `npx prisma generate && node dist/index.js`
- Port: 8080 (0.0.0.0)
- DB: PostgreSQL (Neon)

## API Endpoints

Все (кроме kaizen) требуют Telegram initData auth.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/dashboard | Последние 4 энергии + streak |
| GET | /api/history?period=week\|month | Средние значения по дням |
| GET | /api/analytics | AI-анализ паттернов |
| GET | /api/observations | Наблюдения (триггеры, направления) |
| GET | /api/checkin-trigger | Запуск чекина через бота |
| GET | /api/kaizen | Диагностика (без auth) |

## v2 Roadmap (6 фаз)

Полный спек: `docs/superpowers/specs/2026-03-18-energy-app-v2-design.md`

| Фаза | Что | Статус |
|------|-----|--------|
| 1. Frontend Foundation | Preact + Vite, auth, hub dashboard | ✅ Done |
| 2. Life Balance Wheel | 8 сфер жизни, SVG radar chart, микро-чекины | Planned |
| 3. Habit Tracker | Привычки, streaks, one-tap completion | Planned |
| 4. Smart Task Manager | AI-планирование, NLP quick-add, calendar | Planned |
| 5. Achievement System | XP, уровни, progressive onboarding | Planned |
| 6. AI Intelligence | UserInsight граф, рекомендации, дайджесты | Planned |

## Kaizen Agent Protocol

При запуске в режиме непрерывного улучшения:

### 1. Диагностика
```bash
curl -s https://energy-management-production.up.railway.app/api/kaizen | jq .
npm run build
npm test
```

### 2. Анализ
- **Ошибки**: `recentErrors` в /api/kaizen
- **Перформанс**: AI response > 5s или voice > 3s → оптимизировать
- **Usage**: неиспользуемые фичи → упростить UX

### 3. Правила
- Коммитить каждое улучшение отдельно
- НЕ ломать существующий функционал
- НЕ менять API контракты без необходимости
- Тестировать билд после каждого изменения
