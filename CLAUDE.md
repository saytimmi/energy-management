# Energy Management App — Personal OS

Telegram бот + Mini App — персональная операционная система для управления жизнью.

## СТАТУС ПРОЕКТА

**v2 — все 10 фаз завершены.** Проект в production-ready состоянии.

```
Дизайн v1:  docs/superpowers/specs/2026-03-23-personal-os-design.md
Дизайн v2:  docs/superpowers/specs/2026-03-24-v2-improvements-design.md

Фаза 1:  docs/superpowers/plans/2026-03-24-phase1-foundation.md        ✅ Foundation (энергия, привычки, Mini App)
Фаза 2:  docs/superpowers/plans/2026-03-24-phase2-balance.md           ✅ Balance (колесо жизни, radar)
Фаза 3:  docs/superpowers/plans/2026-03-24-phase3-kaizen.md            ✅ Kaizen (рефлексия, алгоритмы)
Фаза 4:  docs/superpowers/plans/2026-03-24-phase4-strategy.md          ✅ Strategy (миссия, цели)
Фаза 5:  docs/superpowers/plans/2026-03-24-phase5-polish.md            ✅ Polish (UX, анимации, темы)
Фаза 6:  docs/superpowers/plans/2026-03-24-phase6-seamless-bot-app.md  ✅ Seamless Bot↔App (energy overlay, balance rate, config API)
Фаза 7:  docs/superpowers/plans/2026-03-24-phase7-smart-awareness.md   ✅ Smart Awareness (awareness gaps, settings, vacation mode)
Фаза 8:  docs/superpowers/plans/2026-03-24-phase8-meaning-identity.md  ✅ Meaning & Identity (identity cards, meaning-first layout)
Фаза 9:  docs/superpowers/plans/2026-03-24-phase9-living-goals.md      ✅ Living Goals (progress tracking, goal↔habit links, digests)
Фаза 10: docs/superpowers/plans/2026-03-24-phase10-qa-fixes.md         ✅ QA Hardening (6 bugs fixed, security, code quality)

QA промт: docs/testing/qa-full-test-prompt.md
```

## Каскад системы (6 слоёв)

```
🧭 МИССИЯ (зачем я живу) → 🎯 ЦЕЛИ (год/квартал) → 🪞 ИДЕНТИЧНОСТЬ (кем стану)
→ ⚡ ПРИВЫЧКИ (ежедневно) → 🔋 ЭНЕРГИЯ (топливо) → 🧠 КАЙДЗЕН (рефлексия) → цикл
⚖️ БАЛАНС = метрика (не цель, а измерение удовлетворённости, отдельно от каскада)
```

1. **Энергия** — ежедневная оценка 4 типов (физ/мент/эмоц/дух), severity-based checkin, trigger picker, instant recommendations
2. **Привычки** — мгновенные + длительные, forgiving streaks, routine stacking, pause mode, goal linking, flexible frequency, meaning framework
3. **Баланс** — колесо жизни (8 сфер), AI-guided оценка, фокус-сферы, идентичности, inline rate overlay
4. **Кайдзен** — ежедневная рефлексия → алгоритмы (персональная база знаний), weekly digests
5. **Стратегия** — миссия (3 вопроса), цели (год/квартал) с прогрессом и метриками, goal→habit связи
6. **AI Coach** — связывает всё через Tool Use, proactive nudges, awareness gaps, vacation mode, контекст

Бот = быстрые действия + push-уведомления. Mini App = визуал + управление.

## Stack

**Backend:** TypeScript, Node.js, Express, grammy (Telegram Bot API), Prisma + PostgreSQL (Neon), Anthropic Claude API (AI чат с Tool Use, Sonnet для чата + Haiku для аналитики), Groq Whisper (транскрипция голосовых)

**Frontend (Mini App):** Preact 10 + @preact/signals, Vite 5, Chart.js 4, Telegram Mini App SDK

## Архитектура

```
src/
  index.ts              → точка входа, запуск бота + сервера
  server.ts             → Express: API (public + authed) + статика dist/client/
  bot.ts                → grammy: Telegram бот + callback handlers + message buffer
  config.ts             → env переменные (botUsername, webappUrl, port, etc.)
  db.ts                 → Prisma client + findOrCreateUser

  middleware/
    telegram-auth.ts    → initData HMAC-SHA256 валидация

  api/                  → Express роуты
    energy.ts           → POST /api/energy, POST /api/energy/:logId/triggers + GET /api/config (public)
    dashboard.ts        → GET /api/dashboard
    history.ts          → GET /api/history
    analytics.ts        → GET /api/analytics
    observations.ts     → GET /api/observations
    checkin-trigger.ts  → GET /api/checkin-trigger
    habits.ts           → CRUD /api/habits + start/complete/pause/resume/stats/correlation
    balance.ts          → GET /api/balance (overview, radar, area detail) + POST goals + POST rate
    kaizen-api.ts       → GET /api/reflection/status, /api/algorithms, /api/reflections
    mission.ts          → GET/PUT /api/mission
    goals.ts            → GET/POST/PATCH /api/goals
    strategy.ts         → GET /api/strategy (combined: mission + goals + areas + habits)
    settings.ts         → GET/PUT /api/settings (timezone, vacation, notification prefs)
    digests.ts          → GET /api/digests, GET /api/digests/:weekStart
    diagnostics.ts      → GET /api/diagnostics (public, без auth)

  handlers/             → Telegram bot команды
    start.ts, help.ts, energy.ts, report.ts, kaizen.ts, checkin.ts, habits.ts

  services/             → Бизнес-логика
    ai.ts               → Claude API + 18 Tool Use + system prompt + buildUserContext + awareness context
    voice.ts            → Groq Whisper транскрипция
    energy-analysis.ts  → getSeverity(), analyzeSeverity(), getTriggersForSeverity()
    awareness.ts        → getAwarenessGaps() (11 типов), isOnVacation(), getAwarenessContext()
    instant-recommendations.ts → Рекомендации из knowledge base по энергии
    recommendations.ts  → Расширенные рекомендации
    scheduler.ts        → node-cron: timezone-aware user crons
    checkin-sender.ts   → Timezone-aware энергия чекины
    weekly-digest.ts    → Еженедельный AI-анализ + сохранение в DB
    smart-nudges.ts     → Proactive daily nudges (8 типов по приоритету)
    strategy-cron.ts    → Quarterly goal review + yearly mission review
    kaizen-reminder.ts  → Утреннее напоминание о рефлексии
    balance-cron.ts     → 14-day balance assessment reminder
    habit-streaks.ts    → Расчёт streaks, consistency, stage transitions, strength
    habit-cron.ts       → Ежедневный/еженедельный cron + routine reminders + vacation auto-resume
    habit-correlation.ts → Корреляция привычки ↔ энергия
    monitor.ts          → Error tracking + metrics
    diagnostics.ts      → Health checks + analyzeEnergyHistory

  knowledge/            → Knowledge base
    types.ts, data.ts, micro-actions.ts, energy-facts.ts

  __tests__/            → 19 test files, 117 tests
    energy-analysis.test.ts, awareness.test.ts, meaning-identity.test.ts,
    habit-streaks.test.ts, diagnostics.test.ts, recommendations.test.ts,
    knowledge.test.ts, knowledge-verify.test.ts, micro-actions.test.ts,
    instant-recommendations.test.ts, router.test.ts, telegram-auth.test.ts,
    mission-api.test.ts, goals-api.test.ts, strategy-api.test.ts,
    ai-tools-strategy.test.ts, goal-progress.test.ts, habit-frequency.test.ts,
    digest-api.test.ts

  mini-app/             → Preact frontend (собирается Vite)
    main.tsx            → entrypoint
    app.tsx             → роутинг + screen-enter анимация + loadAppConfig()
    router.ts           → hash-based, параметрический (#balance/health, #kaizen/42)
    telegram.ts         → initData, haptic, syncTheme, openTelegramLink, onActivated

    store/
      energy.ts         → Dashboard data signals
      habits.ts         → Habits data + loading signals
      balance.ts        → Balance overview + radar signals
      kaizen.ts         → Reflection status + algorithms + digests signals
      strategy.ts       → Strategy data (mission + goals) + botUsername signal + loadAppConfig()
      settings.ts       → Settings data (timezone, vacation, notification prefs)

    api/
      client.ts         → HTTP client (get/post/put/patch/delete) + ~35 API methods
      types.ts          → TypeScript интерфейсы для всех API

    components/
      hub/              → Hub.tsx, EnergyCard.tsx, HabitsCard.tsx, BalanceCard.tsx,
                          KaizenCard.tsx, StrategyCard.tsx
      energy/           → EnergyDashboard.tsx, EnergyRings.tsx, Observations.tsx, Analytics.tsx,
                          EnergyCheckinOverlay.tsx, TriggerPicker.tsx
      habits/           → HabitsScreen.tsx, HabitCard.tsx, HabitCreate.tsx, HabitDetail.tsx,
                          RoutineGroup.tsx, RoutineFlow.tsx, DayProgress.tsx, WeekHeatmap.tsx,
                          StageIndicator.tsx, CorrelationCard.tsx, MilestoneToast.tsx,
                          FrequencyPicker.tsx
      balance/          → BalanceScreen.tsx, BalanceDetail.tsx, RadarChart.tsx, StrategyScreen.tsx,
                          BalanceRateOverlay.tsx
      kaizen/           → KaizenScreen.tsx, AlgorithmDetail.tsx, DigestCard.tsx, DigestDetail.tsx
      settings/         → SettingsScreen.tsx
      timeline/         → Timeline.tsx (Chart.js)
      journal/          → Journal.tsx
      shared/           → Card.tsx, BottomNav.tsx, Loading.tsx, Skeleton.tsx

    styles/
      variables.css     → CSS переменные (dark + light theme)
      global.css        → Все стили

prisma/
  schema.prisma         → 15 моделей: User, EnergyLog, Message, Session, Observation,
                          Habit, HabitLog, BalanceRating, Mission, Goal, BalanceGoal,
                          Algorithm, Reflection, WeeklyDigest, ErrorLog, Metric
```

## DB Модели (связи)

```
User (1) ──→ Mission (1:1)
         ──→ Goal (1:many) — lifeArea + timeHorizon + period + status + progress + metric + targetValue + currentValue + milestones
         ──→ BalanceGoal (1:many, unique по area) — targetScore, identity, isFocus
         ──→ BalanceRating (1:many) — area + score + subScores + assessmentType
         ──→ Habit (1:many) ──→ HabitLog (1:many, unique habitId+date)
         ──→ Algorithm (many) ←→ Reflection (через sourceReflectionId)
         ──→ Observation (1:many) — energyType + direction + trigger + context + energyLogId
         ──→ EnergyLog (1:many)
         ──→ Session ──→ Message
         ──→ WeeklyDigest (1:many, unique userId+weekStart) — content (JSON) + summary

User fields: timezone, vacationUntil, vacationReason, notificationPrefs (JSON)
Habit fields: goalId → Goal, targetPerWeek, frequency (daily/weekdays/custom), customDays
Goal fields: progress (0-100), metric, targetValue, currentValue, milestones (JSON)
```

## Привычки

**Мгновенные** (по умолчанию) — тап → сразу complete (без time sheet).

**Длительные** (isDuration: true) — три состояния: Не начата → "Начать" → В процессе (таймер) → "Готово".

**Meaning Framework** (обязателен при создании):
- Build: 4 вопроса (whyToday, whyMonth, whyYear, whyIdentity)
- Break: 3 вопроса (isItBeneficial, breakTrigger, replacement)

**HabitDetail** — секция "Зачем это тебе" ПЕРВАЯ (над strength bar и stats).

**RoutineFlow** — identity intro card перед стартом (если identity есть), whyToday под названием привычки.

**Forgiving Streaks** — grace period (2 пропуска/неделю). Сила привычки (strength 0-100) растёт медленно, падает мягко. Stage-aware: seed +3/-5, growth +2/-3, autopilot +1.5/-2.

**Routine Stacking** — "▶ Рутина" → fullscreen RoutineFlow с пошаговым таймером.

**Pause Mode** — 3/7/14/30 дней. Стрик замораживается. Auto-resume.

**Vacation Mode** — через Settings: 3/7/14/30 дней. Все привычки ставятся на паузу, все уведомления отключаются. Auto-resume через daily cron.

**Flexible Frequency** — daily (default), weekdays, custom days. targetPerWeek для consistency расчёта.

**Goal Linking** — привычка может быть связана с целью (goalId → Goal). Отображается в StrategyScreen под целью.

**Inline Bot Actions** — ✅ Сделал / ⏭ Скип / ⏰ Позже. Routine reminders: 7:00/13:00/20:00.

## Навигация

Hash-based роутер с параметрами. 5-tab bottom nav + settings через gear icon.

| Роут | Компонент | Описание |
|------|-----------|----------|
| `#hub` | Hub | 5 виджетов: энергия, баланс, привычки, стратегия, кайдзен |
| `#balance` | BalanceScreen | Radar chart + area list + кнопка "Миссия и цели" |
| `#balance/strategy` | StrategyScreen | Миссия, фокус-сферы с целями + прогресс, compact areas |
| `#balance/:area` | BalanceDetail | Аспекты, привычки, AI insight |
| `#energy` | EnergyDashboard | Кольца, динамика, наблюдения, AI паттерны |
| `#habits` | HabitsScreen | Прогресс, routine groups, FAB "+" |
| `#kaizen` | KaizenScreen | Рефлексия, алгоритмы, дайджесты, наблюдения |
| `#kaizen/:id` | AlgorithmDetail | Шаги, контекст, "Спросить AI" |
| `#settings` | SettingsScreen | Timezone, vacation, notification toggles |

Bottom nav: 🏠 Главная → ⚖️ Баланс → ⚡ Энергия → 🧠 Кайдзен → 🔋 Привычки

## Аутентификация

`Authorization: tma <Telegram.WebApp.initData>` → HMAC-SHA256 валидация → telegramId → userId.

Middleware: `src/middleware/telegram-auth.ts` — все API кроме /api/diagnostics и /api/config.

## Build & Deploy

```bash
npm run build    # prisma generate && tsc && vite build
npm run dev      # concurrently: tsx watch (port 8080) + vite dev (5173, proxy /api → 8080)
npm test         # vitest run (19 files, 117 tests)
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
| POST | /api/energy | Записать энергию из Mini App (severity + triggers + recommendations) |
| POST | /api/energy/:logId/triggers | Сохранить triggers/observations (с ownership check) |

### Привычки
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/habits | Привычки (grouped by routineSlot) |
| GET | /api/habits/today | Привычки на сегодня + completion status |
| GET | /api/habits/heatmap | Тепловая карта за месяц |
| POST | /api/habits | Создать привычку (+ goalId, frequency, customDays, targetPerWeek) |
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
| POST | /api/balance/rate | Bulk rate areas (массив ratings [{area, score}]) |

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
| GET | /api/digests | Недельные дайджесты (pagination) |
| GET | /api/digests/:weekStart | Дайджест за конкретную неделю |

### Стратегия
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/mission | Миссия пользователя |
| PUT | /api/mission | Обновить миссию (upsert) |
| GET | /api/goals | Цели (фильтры: lifeArea, timeHorizon, status) |
| POST | /api/goals | Создать цель (+ metric, targetValue) |
| PATCH | /api/goals/:id | Обновить цель (+ progress, currentValue, milestones) |
| GET | /api/strategy | Combined: mission + goals + areas + habits (goals include progress + linked habits) |

### Настройки
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/settings | Timezone, vacationUntil, vacationReason, notificationPrefs |
| PUT | /api/settings | Обновить настройки (partial update) |

### Система
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/diagnostics | Health check (без auth) |
| GET | /api/config | Bot username + webapp URL (без auth) |

## AI Bot

### Tool Use (18 инструментов)
| Tool | Описание |
|------|----------|
| `create_habit` | Создать привычку (все поля: duration, isDuration, meaning, trigger, minimalDose, goalId, frequency, customDays, targetPerWeek) |
| `update_habit` | Редактировать привычку по ID |
| `delete_habit` | Удалить привычку (soft delete) |
| `start_energy_checkin` | InlineKeyboard для оценки энергии |
| `get_user_habits` | Список активных привычек с ID |
| `set_timezone` | Установить timezone пользователя (IANA формат) |
| `set_vacation_mode` | Включить/выключить vacation mode |
| `rate_life_area` | Оценка сферы жизни (8 сфер × 1-10 + subScores) |
| `set_balance_goal` | Установить цель для сферы (targetScore, identity, isFocus) |
| `start_balance_assessment` | Данные для AI-guided оценки баланса |
| `save_algorithm` | Сохранить алгоритм в библиотеку знаний |
| `get_algorithms` | Найти алгоритмы из библиотеки |
| `save_reflection` | Сохранить ежедневную рефлексию (кайдзен-час) |
| `set_mission` | Сохранить миссию (3 вопроса → statement) |
| `set_goal` | Установить цель (year/quarter + metric + targetValue) |
| `update_goal_progress` | Обновить прогресс цели (progress, currentValue) |
| `get_goals` | Посмотреть текущие цели |

### AI Context (buildUserContext)
При каждом сообщении бот получает контекст пользователя:
- Последние 5 записей энергии + низкие показатели + рекомендации
- Баланс жизни (8 сфер с оценками, давность)
- Миссия (statement + identity)
- Активные цели (по сферам и горизонтам) с прогрессом
- Фокус-сферы (из BalanceGoal)
- Активные привычки (streak, slot, goalId)
- Алгоритмы (top 5 по usage)
- Рефлексия (вчерашняя или предупреждение)
- Наблюдения за 30 дней + паттерны триггеров
- Awareness gaps (пробелы в данных, приоритизированные)
- Vacation status

### Awareness System (11 типов пробелов)
| Приоритет | Gap | Триггер |
|-----------|-----|---------|
| 100 | no_energy | Нет ни одного замера энергии |
| 90 | no_habits | Нет активных привычек |
| 80 | no_balance | Нет оценки баланса, аккаунт >3 дней |
| 70 | stale_balance | Баланс старше 14 дней |
| 60 | no_mission | Нет миссии, аккаунт >14 дней |
| 55 | no_goals | Нет целей, аккаунт >21 дней |
| 52 | no_reflection | Вчера не было рефлексии |
| 50 | empty_meaning | Привычка без whyToday/whyIdentity |
| 45 | goal_without_habits | Цель без привычек в той же lifeArea |
| 40 | no_focus_areas | Баланс оценён, но нет фокус-сфер |
| 35 | low_area_no_goal | Сфера ≤4/10 без цели |

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
- **Critical** (drop ≥4 или level ≤3 + drop ≥3) → причины + рекомендации
- **Moderate** (drop 2-3 или level ≤3 + drop ≥1) → причины + 1-2 рекомендации
- **Mild** (drop 1) → лёгкий вопрос
- **Improved** (rise ≥2) → "Что помогло?"
- **Stable** → 👍

## Cron Jobs (timezone-aware)

Все user-facing crons работают через hourly poll + `getUsersByLocalHour()`.

| Локальное время | Job | Описание |
|-----------------|-----|----------|
| */15 * (UTC) | Heartbeat | Лог жизнеспособности |
| 0 * (UTC) | Checkin sender | Timezone-aware энергия чекины (утро/вечер) |
| 0 0 (UTC) | Daily habit cron | Streaks, strength, stage transitions, vacation auto-resume |
| 0 0 Mon (UTC) | Weekly habit reset | Freeze counter reset |
| 7:00 local | Morning habits | Напоминание утренних привычек |
| 8:00 local | Kaizen reminder | Напоминание рефлексии (если вчера не было) |
| 9:00 local | **Smart nudges** | AI-powered proactive nudge (1/день, 8 типов) |
| 10:00 local | Balance check | Reminder если >14 дней без оценки |
| 13:00 local | Afternoon habits | Напоминание дневных привычек |
| 20:00 local | Evening habits | Напоминание вечерних привычек |
| Sun local | Weekly digest | AI-анализ + сохранение в WeeklyDigest |
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
