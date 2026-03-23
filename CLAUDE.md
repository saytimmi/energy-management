# Energy Management App

Telegram бот + Mini App для управления жизненной энергией. AI-powered life coach.

## Что это

Персональный AI коуч в Telegram. Четыре слоя:
1. **Мониторинг** — ежедневная оценка 4 типов энергии (физ/мент/эмоц/дух)
2. **Стратегия** — колесо баланса жизни (8 сфер) через AI-опрос в чате
3. **Тактика** — привычки (мгновенные + длительные) = конкретные ежедневные действия
4. **AI Coach** — связывает всё, адаптируется, учится

Бот = быстрые действия + push. Mini App = визуал + управление.

## Stack

**Backend:**
- TypeScript, Node.js, Express (port 8080)
- grammy — Telegram Bot API
- Prisma + PostgreSQL (Neon, на Railway)
- Anthropic Claude API — AI чат с Tool Use
- Gemini — транскрипция голосовых

**Frontend (Mini App):**
- Preact 10 (3KB) + @preact/signals
- Vite 5 — сборка + HMR
- Chart.js 4 — графики энергии
- Glass Dark Premium дизайн (glassmorphism, CSS variables)
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
    checkin-trigger.ts  → GET /api/checkin-trigger — запуск чекина (dedup 30с)
    kaizen.ts           → GET /api/kaizen — диагностика (без auth)
  handlers/             → Telegram bot команды
    start.ts, help.ts, energy.ts, report.ts, kaizen.ts, checkin.ts, habits.ts
  services/             → Бизнес-логика
    ai.ts               → Claude API + Tool Use + анти-GPT system prompt
    voice.ts            → Gemini транскрипция
    scheduler.ts        → node-cron расписание
    checkin-sender.ts   → Отправка чекинов по расписанию
    weekly-digest.ts    → Еженедельный AI-анализ паттернов
    diagnostics.ts      → Health checks
    instant-recommendations.ts → Мгновенные рекомендации из knowledge base
    habit-streaks.ts    → Расчёт streaks, consistency, stage transitions
    habit-cron.ts       → Ежедневный/еженедельный cron для привычек
    habit-correlation.ts → Корреляция привычки ↔ энергия
    monitor.ts          → Error tracking
  knowledge/            → Системные промпты + knowledge base
    types.ts            → EnergyType, Practice, MicroAction, EnergyFact
    data.ts             → Recovery practices, drain factors, substitution rules
    micro-actions.ts    → 40 evidence-based micro-actions (10 per energy type)
    energy-facts.ts     → 20 научных фактов об энергии
  mini-app/             → Preact frontend (собирается Vite)
    main.tsx            → Entry point
    app.tsx             → Корневой компонент + роутинг
    router.ts           → Hash-based роутер (#hub, #energy, #habits, #journal)
    telegram.ts         → Telegram SDK wrapper (тема, haptic, initData, BackButton)
    store/
      energy.ts         → Signals: dashboardData, observations, analyticsData
      habits.ts         → Signals: habitsData, todayProgress, startDurationHabit, toggleComplete
    api/
      client.ts         → Fetch wrapper с Authorization: tma <initData>
      types.ts          → TypeScript типы для API responses
    components/
      hub/
        Hub.tsx         → Главный экран — карточки-виджеты
        EnergyCard.tsx  → Виджет энергии (4 значения + streak)
        HabitsCard.tsx  → Виджет привычек (прогресс, стрик, consistency)
      energy/
        EnergyDashboard.tsx → Полный экран энергии (кольца + динамика + наблюдения + аналитика)
        EnergyRings.tsx     → SVG кольца с ambient glow анимацией
        Observations.tsx    → Список наблюдений
        Analytics.tsx       → AI паттерны
        utils.ts            → Хелперы (getTimeAgo, getDayWord, getNoteWord)
      habits/
        HabitsScreen.tsx    → Главный экран: прогресс, heatmap, routine groups, FAB
        HabitCard.tsx       → Карточка: gradient icon, time sheet, duration timer, long-press→detail
        HabitCreate.tsx     → 2-step wizard: (1) имя+время+тип+сфера (2) meaning framework (ОБЯЗАТЕЛЬНО)
        HabitDetail.tsx     → Детальный вид (стадия, heatmap, editable meaning, correlation)
        RoutineGroup.tsx    → Группа утро/день/вечер
        DayProgress.tsx     → Прогресс-бар дня + стрик
        WeekHeatmap.tsx     → Мини-тепловая карта недели
        StageIndicator.tsx  → 🌱→🌿→🌳 визуал стадий
        CorrelationCard.tsx → Корреляция привычка ↔ энергия (в HabitDetail, НЕ на главном)
        MilestoneToast.tsx  → Тост-уведомления (день 7/21/60)
      timeline/
        Timeline.tsx    → Chart.js график энергии (внутри EnergyDashboard)
      journal/
        Journal.tsx     → Дневник (фильтрует только записи с trigger/context)
      shared/
        Card.tsx        → Переиспользуемая карточка
        BottomNav.tsx   → Нижняя навигация (4 таба)
        Loading.tsx     → Loading/Welcome/Error экраны
    styles/
      variables.css     → Design tokens: Glass Dark Premium (glassmorphism, glow, тёплый тёмный фон)
      global.css        → Все стили
prisma/
  schema.prisma         → Модели: User, EnergyLog, Message, Session, Observation, Habit, HabitLog, BalanceRating, ErrorLog, Metric
docs/
  superpowers/specs/    → Спецификации дизайна (исторические, для контекста)
```

## Привычки — два типа

### Мгновенные (по умолчанию)
Холодный душ, медитация, зарядка — тап на карточку → time sheet "Во сколько?" → подтверждение.

### Длительные (isDuration: true)
Интервальное голодание, без телефона — три состояния:
1. **Не начата** → кнопка "Начать" (синяя) → записывает startedAt
2. **В процессе** → пульсирующая точка + elapsed таймер + кнопка "Готово"
3. **Завершена** → зелёная галочка

При создании: toggle "На время" + пресеты длительности (15м, 30м, 1ч, 2ч, 8ч, 16ч).

### Meaning Framework (ОБЯЗАТЕЛЬНО при создании)
Step 2 wizard — 3 вопроса для build ("Какая выгода сегодня?", "Что изменится через год?", "Кем ты станешь?") или 3 для break ("Выгодно ли организму?", "Что триггерит?", "Что вместо?"). Это ключевая фича — НЕ убирать.

## Навигация Mini App

Hub-and-spoke: главный экран → тап на карточку → детальный вид → назад.

| Роут | Компонент | Что показывает |
|------|-----------|----------------|
| `#hub` | Hub | Виджеты: энергия, привычки |
| `#energy` | EnergyDashboard | Кольца, динамика, наблюдения, AI паттерны, кнопка чекина |
| `#habits` | HabitsScreen | Привычки: прогресс, routine groups, FAB кнопка "+" |
| `#journal` | Journal | Дневник (только записи с trigger/context) |

Bottom nav: Главная → Энергия → Привычки → Дневник

## Аутентификация

**Mini App → API:** `Authorization: tma <Telegram.WebApp.initData>`
- HMAC-SHA256 валидация через bot token
- telegramId → User → userId на req

**Middleware:** `src/middleware/telegram-auth.ts` — все API кроме /api/kaizen

## Build & Deploy

```bash
npm run build    # prisma generate && tsc && vite build
npm run dev      # concurrently: tsx watch + vite dev (5173, proxy /api → 8080)
npm test         # vitest run
```

Railway auto-deploy из main. Port 8080.

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/dashboard | Последние 4 энергии + streak |
| GET | /api/history?period=week\|month | Средние по дням |
| GET | /api/analytics | AI-анализ паттернов |
| GET | /api/observations | Наблюдения (trigger, direction) |
| GET | /api/checkin-trigger | Запуск чекина (dedup 30с) |
| GET | /api/kaizen | Диагностика (без auth) |
| GET | /api/habits | Привычки (grouped by routineSlot, с inProgress/startedAt) |
| POST | /api/habits | Создать привычку (isDuration, meaning fields) |
| PATCH | /api/habits/:id | Обновить привычку |
| DELETE | /api/habits/:id | Soft delete |
| POST | /api/habits/:id/start | Начать длительную привычку |
| POST | /api/habits/:id/complete | Завершить (instant или duration) |
| DELETE | /api/habits/:id/complete | Отменить выполнение |
| GET | /api/habits/:id/stats | Стрик, consistency, heatmap |
| GET | /api/habits/:id/correlation | Корреляция привычка ↔ энергия |
| GET | /api/habits/heatmap | Тепловая карта за месяц |

## AI Bot Architecture

### Tool Use
- `create_habit` — создаёт привычку в БД
- `start_energy_checkin` — InlineKeyboard для оценки энергии
- `get_user_habits` — список активных привычек
- `rate_life_area` — оценка сферы жизни (8 сфер × 1-10)

**AI НЕ должен:** говорить "создал/записал" без вызова tool, имитировать UI текстом, делать предположения о религии/культуре.

### Анти-GPT стиль (критично)
System prompt содержит строгие правила:
- Не начинать с "Отлично!", "Замечательно!" — звучит как робот
- Не использовать маркированные списки в обычном разговоре
- Писать как человек в телеграме: "слушай", "ну смотри", "короче"
- Max 1 вопрос за ответ, 2-4 предложения
- Тон: заботливый друг, не коуч/терапевт/ассистент

### Severity-based Checkin
Slot-to-slot сравнение (утро с утром):
- **Critical** (drop ≥4 или level ≤3 с drop) → причины + 3-4 рекомендации
- **Moderate** (drop 2-3) → причины + 1-2 рекомендации
- **Improved** (rise ≥2) → "Что помогло?" + rise observation
- **Stable** → 👍

### Checkin dedup
- Сервер: 30с cooldown per user (in-memory Map)
- Клиент: 30с cooldown на кнопке

## Дизайн: Glass Dark Premium

Тёма вдохновлена Bearable, Streaks, Apple Fitness:
- Тёплый тёмный фон `#0c0d12` (blue tint, не чисто чёрный)
- Glassmorphism: `backdrop-filter: blur(20px)` + `border: 1px solid rgba(255,255,255,0.06)`
- Ambient glow за энергетическими кольцами (цвет типа энергии)
- Gradient icon containers для привычек (цвет по lifeArea)
- Accent: `#c8ff73` (lime green) с glow shadow на CTA кнопках
- FAB кнопка для добавления привычки
- Bottom sheet с анимацией для time picker

## Что завершено

| Что | Когда |
|-----|-------|
| Frontend Foundation (Preact + Vite, auth, hub) | 2026-03-18 |
| Habit Tracker + Knowledge Base | 2026-03-19 |
| Bot Intelligence (AI tool use, severity checkin) | 2026-03-22 |
| Life Balance через AI (lifeArea, rate_life_area) | 2026-03-22 |
| Weekly AI Digest (паттерны + авто-привычки) | 2026-03-22 |
| Glass Dark Premium редизайн Mini App | 2026-03-23 |
| Багфиксы: кнопка создания, чекин dedup, scroll, антиGPT, дневник | 2026-03-23 |
| Редизайн привычек: gradient cards, FAB, tap-to-complete | 2026-03-23 |
| Длительные привычки: Начать → таймер → Завершить | 2026-03-23 |
| Time sheet при выполнении мгновенных привычек | 2026-03-23 |

## Что НЕ нужно (отменено)

| Что | Причина |
|-----|---------|
| SVG Balance Wheel экран | AI-опрос в чате + lifeArea на привычках |
| Task Manager | Пользователь использует Google Calendar + Claude App |
| Achievement System (XP/уровни) | Стрики + confetti достаточно |
| AI Intelligence как отдельная фаза | AI улучшается итеративно |

## Приоритеты (что дальше)

| # | Что | Почему |
|---|-----|--------|
| 1 | **Balance check через AI** — бот раз в 2 недели спрашивает оценку 8 сфер | Колесо баланса без отдельного UI |
| 2 | **Визуал polish** — skeleton loading, number count-up анимации, transitions между табами | Premium feel |
| 3 | **Тестирование на реальных пользователях** — собрать фидбек, итерировать | Product-market fit |

## Kaizen Protocol

```bash
curl -s https://energy-management-production.up.railway.app/api/kaizen | jq .
npm run build
npm test
```

Правила: коммитить каждое улучшение отдельно, не ломать функционал, тестировать билд.
