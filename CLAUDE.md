# Energy Management App — Personal OS

Telegram бот + Mini App — персональная операционная система для управления жизнью.

## СТАТУС ПРОЕКТА

Все 5 фаз реализованы. Проект в режиме итераций и улучшений.

```
Спек:    docs/superpowers/specs/2026-03-23-personal-os-design.md
Фаза 1:  docs/superpowers/plans/2026-03-24-phase1-foundation.md   ✅ ЗАВЕРШЕНА
Фаза 2:  docs/superpowers/plans/2026-03-24-phase2-balance.md      ✅ ЗАВЕРШЕНА
Фаза 3:  docs/superpowers/plans/2026-03-24-phase3-kaizen.md       ✅ ЗАВЕРШЕНА
Фаза 4:  docs/superpowers/plans/2026-03-24-phase4-strategy.md     ✅ ЗАВЕРШЕНА
Фаза 5:  docs/superpowers/plans/2026-03-24-phase5-polish.md       ✅ ЗАВЕРШЕНА
```

## Каскад системы (6 слоёв)

```
🧭 МИССИЯ (зачем я живу) → 🎯 ЦЕЛИ (год/квартал) → 🪞 ИДЕНТИЧНОСТЬ (кем стану)
→ ⚡ ПРИВЫЧКИ (ежедневно) → 🔋 ЭНЕРГИЯ (топливо) → 🧠 КАЙДЗЕН (рефлексия) → цикл
⚖️ БАЛАНС = метрика (не цель, а измерение удовлетворённости, отдельно от каскада)
```

1. **Энергия** — ежедневная оценка 4 типов (физ/мент/эмоц/дух), severity-based checkin
2. **Привычки** — мгновенные + длительные, forgiving streaks, routine stacking, pause mode
3. **Баланс** — колесо жизни (8 сфер), AI-guided оценка, фокус-сферы, идентичности
4. **Кайдзен** — ежедневная рефлексия → алгоритмы (персональная база знаний)
5. **Стратегия** — миссия (3 вопроса), цели (год/квартал), StrategyScreen
6. **AI Coach** — связывает всё через Tool Use, proactive nudges, контекст

Бот = быстрые действия + push-уведомления. Mini App = визуал + управление.

## Stack

**Backend:** TypeScript, Node.js, Express, grammy (Telegram Bot API), Prisma + PostgreSQL (Neon), Anthropic Claude API (AI чат с Tool Use, Sonnet для чата + Haiku для аналитики), Groq Whisper (транскрипция голосовых)

**Frontend (Mini App):** Preact 10 + @preact/signals, Vite 5, Chart.js 4, Telegram Mini App SDK

## Архитектура

```
src/
  index.ts              → точка входа, запуск бота + сервера
  server.ts             → Express: API + статика dist/client/
  bot.ts                → grammy: Telegram бот + callback handlers + message buffer
  config.ts             → env переменные
  db.ts                 → Prisma client + findOrCreateUser

  middleware/
    telegram-auth.ts    → initData HMAC-SHA256 валидация

  api/                  → Express роуты (за auth middleware)
    dashboard.ts        → GET /api/dashboard
    history.ts          → GET /api/history
    analytics.ts        → GET /api/analytics
    observations.ts     → GET /api/observations
    checkin-trigger.ts  → GET /api/checkin-trigger
    habits.ts           → CRUD /api/habits + start/complete/pause/resume/stats/correlation
    balance.ts          → GET /api/balance (overview, radar, area detail) + POST goals
    kaizen-api.ts       → GET /api/reflection/status, /api/algorithms, /api/reflections
    mission.ts          → GET/PUT /api/mission
    goals.ts            → GET/POST/PATCH /api/goals
    strategy.ts         → GET /api/strategy (combined: mission + goals + areas + habits)
    diagnostics.ts      → GET /api/diagnostics (без auth)

  handlers/             → Telegram bot команды
    start.ts, help.ts, energy.ts, report.ts, kaizen.ts, checkin.ts, habits.ts

  services/             → Бизнес-логика
    ai.ts               → Claude API + 12 Tool Use + system prompt + buildUserContext
    voice.ts            → Groq Whisper транскрипция
    scheduler.ts        → node-cron: 12 cron jobs
    checkin-sender.ts   → Timezone-aware энергия чекины
    weekly-digest.ts    → Еженедельный AI-анализ + корреляции + цели + привычки
    smart-nudges.ts     → Proactive daily nudges (7 типов по приоритету)
    strategy-cron.ts    → Quarterly goal review + yearly mission review
    kaizen-reminder.ts  → Утреннее напоминание о рефлексии
    balance-cron.ts     → 14-day balance assessment reminder
    habit-streaks.ts    → Расчёт streaks, consistency, stage transitions, strength
    habit-cron.ts       → Ежедневный/еженедельный cron + routine reminders
    habit-correlation.ts → Корреляция привычки ↔ энергия
    monitor.ts          → Error tracking + metrics
    diagnostics.ts      → Health checks
    instant-recommendations.ts → Рекомендации из knowledge base

  knowledge/            → Knowledge base
    types.ts, data.ts, micro-actions.ts, energy-facts.ts

  mini-app/             → Preact frontend (собирается Vite)
    main.tsx            → entrypoint
    app.tsx             → роутинг + screen-enter анимация
    router.ts           → hash-based, параметрический (#balance/health, #kaizen/42)
    telegram.ts         → initData, haptic, syncTheme, applyColorScheme (light/dark)

    store/
      energy.ts         → Dashboard data signals
      habits.ts         → Habits data + loading signals
      balance.ts        → Balance overview + radar signals
      kaizen.ts         → Reflection status + algorithms signals
      strategy.ts       → Strategy data (mission + goals) signals

    api/
      client.ts         → HTTP client (get/post/put/patch/delete) + 30 API methods
      types.ts          → TypeScript интерфейсы для всех API

    components/
      hub/              → Hub.tsx, EnergyCard.tsx, HabitsCard.tsx, BalanceCard.tsx,
                          KaizenCard.tsx, StrategyCard.tsx
      energy/           → EnergyDashboard.tsx, EnergyRings.tsx, Observations.tsx, Analytics.tsx
      habits/           → HabitsScreen.tsx, HabitCard.tsx, HabitCreate.tsx, HabitDetail.tsx,
                          RoutineGroup.tsx, RoutineFlow.tsx, DayProgress.tsx, WeekHeatmap.tsx,
                          StageIndicator.tsx, CorrelationCard.tsx, MilestoneToast.tsx
      balance/          → BalanceScreen.tsx, BalanceDetail.tsx, RadarChart.tsx, StrategyScreen.tsx
      kaizen/           → KaizenScreen.tsx, AlgorithmDetail.tsx
      timeline/         → Timeline.tsx (Chart.js)
      journal/          → Journal.tsx
      shared/           → Card.tsx, BottomNav.tsx, Loading.tsx, Skeleton.tsx

    styles/
      variables.css     → CSS переменные (dark + light theme)
      global.css        → Все стили (~2000 строк)

prisma/
  schema.prisma         → 12 моделей: User, EnergyLog, Message, Session, Observation,
                          Habit, HabitLog, BalanceRating, Mission, Goal, BalanceGoal,
                          Algorithm, Reflection, ErrorLog, Metric
```

## DB Модели (связи)

```
User (1) ──→ Mission (1:1)
         ──→ Goal (1:many) — lifeArea + timeHorizon + period + status
         ──→ BalanceGoal (1:many, unique по area) — targetScore, identity, isFocus
         ──→ BalanceRating (1:many) — area + score + subScores + assessmentType
         ──→ Habit (1:many) ──→ HabitLog (1:many, unique habitId+date)
         ──→ Algorithm (many) ←→ Reflection (через sourceReflectionId)
         ──→ Observation (1:many) — energyType + direction + trigger + context
         ──→ EnergyLog (1:many)
         ──→ Session ──→ Message
```

## Привычки

**Мгновенные** (по умолчанию) — тап → time sheet "Во сколько?" → подтверждение.

**Длительные** (isDuration: true) — три состояния: Не начата → "Начать" → В процессе (таймер) → "Готово".

**Meaning Framework** (обязателен при создании):
- Build: 4 вопроса (whyToday, whyMonth, whyYear, whyIdentity)
- Break: 3 вопроса (isItBeneficial, breakTrigger, replacement)

**Forgiving Streaks** — grace period (2 пропуска/неделю). Сила привычки (strength 0-100) растёт медленно, падает мягко. Stage-aware: seed +3/-5, growth +2/-3, autopilot +1.5/-2.

**Routine Stacking** — "▶ Рутина" → fullscreen RoutineFlow с пошаговым таймером.

**Pause Mode** — 3/7/14/30 дней. Стрик замораживается. Auto-resume.

**Inline Bot Actions** — ✅ Сделал / ⏭ Скип / ⏰ Позже. Routine reminders: 7:30/13:00/20:30.

## Навигация

Hash-based роутер с параметрами. 5-tab bottom nav.

| Роут | Компонент | Описание |
|------|-----------|----------|
| `#hub` | Hub | 5 виджетов: энергия, баланс, привычки, стратегия, кайдзен |
| `#balance` | BalanceScreen | Radar chart + area list + кнопка "Миссия и цели" |
| `#balance/strategy` | StrategyScreen | Миссия, фокус-сферы с целями, compact areas |
| `#balance/:area` | BalanceDetail | Аспекты, привычки, AI insight |
| `#energy` | EnergyDashboard | Кольца, динамика, наблюдения, AI паттерны |
| `#habits` | HabitsScreen | Прогресс, routine groups, FAB "+" |
| `#kaizen` | KaizenScreen | Рефлексия, алгоритмы, наблюдения |
| `#kaizen/:id` | AlgorithmDetail | Шаги, контекст, "Спросить AI" |

Bottom nav: 🏠 Главная → ⚖️ Баланс → ⚡ Энергия → 🧠 Кайдзен → 🔋 Привычки

## Аутентификация

`Authorization: tma <Telegram.WebApp.initData>` → HMAC-SHA256 валидация → telegramId → userId.

Middleware: `src/middleware/telegram-auth.ts` — все API кроме /api/diagnostics.

## Build & Deploy

```bash
npm run build    # prisma generate && tsc && vite build
npm run dev      # concurrently: tsx watch (port 8080) + vite dev (5173, proxy /api → 8080)
npm test         # vitest run
```

Railway auto-deploy из main. Порт через env `PORT` (дефолт 3000).

## API Endpoints

### Энергия
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/dashboard | Последние 4 энергии + streak |
| GET | /api/history?period=week\|month | Средние по дням |
| GET | /api/analytics | AI-анализ паттернов |
| GET | /api/observations | Наблюдения (trigger, direction) |
| GET | /api/checkin-trigger | Запуск чекина (dedup 30с) |

### Привычки
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/habits | Привычки (grouped by routineSlot) |
| GET | /api/habits/today | Привычки на сегодня + completion status |
| GET | /api/habits/heatmap | Тепловая карта за месяц |
| POST | /api/habits | Создать привычку |
| PATCH | /api/habits/:id | Обновить привычку |
| DELETE | /api/habits/:id | Soft delete |
| POST | /api/habits/:id/start | Начать длительную привычку |
| POST | /api/habits/:id/complete | Завершить привычку |
| DELETE | /api/habits/:id/complete | Отменить выполнение |
| POST | /api/habits/:id/pause | Поставить на паузу |
| POST | /api/habits/:id/resume | Возобновить |
| GET | /api/habits/:id/stats | Стрик, consistency, strength, heatmap |
| GET | /api/habits/:id/correlation | Корреляция привычка ↔ энергия |

### Баланс
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/balance | Overview: 8 сфер + avg score |
| GET | /api/balance/radar | Radar chart data |
| GET | /api/balance/:area | Area detail: aspects, habits, history |
| POST | /api/balance/goals | Set balance goal (targetScore, identity, isFocus) |

### Кайдзен
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/reflection/status | Статус рефлексии сегодня + контекст дня |
| GET | /api/algorithms | Алгоритмы (фильтр: lifeArea, q) |
| GET | /api/algorithms/:id | Детали алгоритма |
| PATCH | /api/algorithms/:id | Обновить алгоритм |
| DELETE | /api/algorithms/:id | Удалить алгоритм |
| GET | /api/reflections | Рефлексии (pagination) |
| GET | /api/reflections/:date | Рефлексия по дате |

### Стратегия
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/mission | Миссия пользователя |
| PUT | /api/mission | Обновить миссию (upsert) |
| GET | /api/goals | Цели (фильтры: lifeArea, timeHorizon, status) |
| POST | /api/goals | Создать цель |
| PATCH | /api/goals/:id | Обновить цель |
| GET | /api/strategy | Combined: mission + goals + areas + habits |

### Система
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/diagnostics | Health check (без auth) |

## AI Bot

### Tool Use (12 инструментов)
| Tool | Описание |
|------|----------|
| `create_habit` | Создать привычку (все поля: duration, isDuration, meaning, trigger, minimalDose) |
| `update_habit` | Редактировать привычку по ID |
| `delete_habit` | Удалить привычку (soft delete) |
| `start_energy_checkin` | InlineKeyboard для оценки энергии |
| `get_user_habits` | Список активных привычек с ID |
| `rate_life_area` | Оценка сферы жизни (8 сфер × 1-10 + subScores) |
| `set_balance_goal` | Установить цель для сферы (targetScore, identity, isFocus) |
| `start_balance_assessment` | Данные для AI-guided оценки баланса |
| `save_algorithm` | Сохранить алгоритм в библиотеку знаний |
| `get_algorithms` | Найти алгоритмы из библиотеки |
| `save_reflection` | Сохранить ежедневную рефлексию (кайдзен-час) |
| `set_mission` | Сохранить миссию (3 вопроса → statement) |
| `set_goal` | Установить цель (year/quarter) |
| `get_goals` | Посмотреть текущие цели |

### AI Context (buildUserContext)
При каждом сообщении бот получает контекст пользователя:
- Последние 5 записей энергии + низкие показатели + рекомендации
- Баланс жизни (8 сфер с оценками, давность)
- Миссия (statement + identity)
- Активные цели (по сферам и горизонтам)
- Фокус-сферы (из BalanceGoal)
- Активные привычки (streak, slot)
- Алгоритмы (top 5 по usage)
- Рефлексия (вчерашняя или предупреждение)
- Наблюдения за 30 дней + паттерны триггеров

### Правила поведения
- Анти-GPT стиль: запрет на списки, жирный текст, формальные обороты
- Пишет строчными, фрагментами, как друг в телеграме
- Max 1 вопрос за ответ, 2-4 предложения
- НЕ говорить "создал/записал" без вызова tool
- DATA-тег для пассивного сбора данных из разговора
- Миссия: 3 последовательных вопроса → statement → подтверждение
- Цели: после set_goal предлагает создать привычку
- Кайдзен-час: диалог рефлексии → инсайты → алгоритмы

### Severity-based Checkin
Slot-to-slot сравнение (утро с утром):
- **Critical** (drop ≥4 или level ≤3) → причины + рекомендации
- **Moderate** (drop 2-3) → причины + 1-2 рекомендации
- **Improved** (rise ≥2) → "Что помогло?"
- **Stable** → 👍

## Cron Jobs (12 задач)

| Время | Job | Описание |
|-------|-----|----------|
| */15 * | Heartbeat | Лог жизнеспособности |
| 0 * | Checkin sender | Timezone-aware энергия чекины (утро/вечер) |
| 0 0 | Daily habit cron | Streaks, strength, stage transitions |
| 0 0 Mon | Weekly habit reset | Freeze counter reset |
| 7:30 | Morning habits | Напоминание утренних привычек |
| 8:00 | Kaizen reminder | Напоминание рефлексии (если вчера не было) |
| 9:00 | **Smart nudges** | AI-powered proactive nudge (1/день, 7 типов) |
| 13:00 | Afternoon habits | Напоминание дневных привычек |
| 20:30 | Evening habits | Напоминание вечерних привычек |
| Sun 20:00 | Weekly digest | AI-анализ + корреляции + цели + привычки |
| 10:00 daily | Balance check | Reminder если >14 дней без оценки |
| Q1/Q2/Q3/Q4 1st | Quarterly review | Пересмотр целей + inline кнопки |
| Jan 1 | Yearly review | Пересмотр миссии |

## Smart Nudges (proactive intelligence)

Ежедневно в 9:00, выбирается ONE nudge с наивысшим приоритетом:

| Приоритет | Тип | Триггер |
|-----------|-----|---------|
| 90 | Goal-Habit Gap | Цель в фокус-сфере, но нет привычек |
| 85 | Low Consistency | Привычки для цели < 30% |
| 80 | Energy Pattern | 3+ замеров одного типа ≤ 4 |
| 75 | Streak at Risk | Сильная привычка потеряет стрик |
| 70 | Milestone | Стрик 7/21/30/60/90/100 дней |
| 65 | Weekly Goal Review | Понедельник — inline кнопки для целей |
| 60 | Balance Drift | Фокус-сфера упала в оценке |
| 50 | AI Fallback | Haiku генерирует персональный nudge |

Шаблонные nudges = 0 токенов. AI fallback = ~200 токенов Haiku.

## Дизайн

**Glass Dark Premium** (default) + **Light Theme** через `Telegram.WebApp.colorScheme`:
- Dark: тёмный фон `#0c0d12`, glassmorphism, accent `#c8ff73` (lime)
- Light: фон `#f5f5f7`, accent `#4a8c00`, deeper energy colors
- Skeleton loading с shimmer анимацией
- Screen-enter анимация при переключении табов
- Premium emojis: 🦾🧬🫀🔮 (энергия), 🩺🚀💞💎🏡📚🧘🌿 (сферы), 🌅☀️🌙 (время)

## Inline Bot Callbacks

| Pattern | Handler | Описание |
|---------|---------|----------|
| `action:checkin` | checkin.ts | Запуск чекина |
| `action:report` | report.ts | Отчёт |
| `habit_(complete\|skip\|later):*` | habits.ts | Привычки: сделал/скип/позже |
| `digest_habit*` | weekly-digest.ts | Создать привычку из дайджеста |
| `goal_(done\|drop):*` | smart-nudges.ts | Завершить/дропнуть цель |
| `checkin:*` | checkin.ts | Оценка энергии (flow) |

## Что НЕ нужно

- Task Manager → пользователь использует Google Calendar + Claude App
- Achievement System (XP/уровни) → стрики + confetti достаточно

## Kaizen Protocol

```bash
curl -s https://energy-management-production.up.railway.app/api/diagnostics | jq .
npm run build
npm test
```

Коммитить каждое улучшение отдельно, не ломать функционал, тестировать билд.
