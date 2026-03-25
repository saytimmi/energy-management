# Техническая архитектура Energy Management App

## 1. Обзор системы

Приложение состоит из четырёх основных компонентов: Telegram-бот (grammy), Express HTTP-сервер, Mini App (Preact) и внешние AI-сервисы. Все компоненты запускаются из единого процесса Node.js.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Пользователь                                 │
│                                                                     │
│     Telegram Chat                         Telegram Mini App         │
│     (текст, голос, кнопки)                (WebView, Preact SPA)     │
└───────┬───────────────────────────────────────────┬─────────────────┘
        │                                           │
        │  Telegram Bot API                         │  HTTPS
        │  (long polling)                           │  Authorization: tma <initData>
        │                                           │
┌───────▼───────────────────────────────────────────▼─────────────────┐
│                      Node.js процесс (index.ts)                     │
│                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌───────────────────┐   │
│  │  grammy Bot   │   │  Express Server   │   │    Scheduler      │   │
│  │              │   │                  │   │   (node-cron)     │   │
│  │  /start      │   │  /api/config  ←──── public (без auth)   │   │
│  │  /energy     │   │  /api/diagnostics │   │                   │   │
│  │  /report     │   │                  │   │  Hourly poll →    │   │
│  │  /help       │   │  /api/dashboard  │   │  getUsersByLocal  │   │
│  │  /kaizen     │   │  /api/habits     │   │  Hour()           │   │
│  │              │   │  /api/balance    │   │                   │   │
│  │  callbacks:  │   │  /api/energy     │   │  Checkins,        │   │
│  │  habit_*     │   │  /api/kaizen     │   │  habits, nudges,  │   │
│  │  checkin:*   │   │  /api/goals      │   │  digests, balance │   │
│  │  digest_*    │   │  /api/strategy   │   │                   │   │
│  │  goal_*      │   │  /api/settings   │   │                   │   │
│  └──────┬───────┘   │  /api/digests    │   └───────────────────┘   │
│         │           │       ↑          │                            │
│         │           │  telegramAuth    │                            │
│         │           │  middleware      │                            │
│         │           └────────┬─────────┘                            │
│         │                    │                                      │
│  ┌──────▼────────────────────▼──────────────────────────────────┐   │
│  │                    Services Layer                             │   │
│  │  ai.ts, awareness.ts, energy-analysis.ts, habit-streaks.ts,  │   │
│  │  habit-correlation.ts, instant-recommendations.ts,           │   │
│  │  weekly-digest.ts, smart-nudges.ts, monitor.ts, voice.ts    │   │
│  └──────┬───────────────────┬───────────────────┬───────────────┘   │
│         │                   │                   │                    │
└─────────┼───────────────────┼───────────────────┼────────────────────┘
          │                   │                   │
   ┌──────▼──────┐    ┌──────▼──────┐    ┌───────▼───────┐
   │  PostgreSQL  │    │ Claude API  │    │ Groq Whisper  │
   │  (Neon)      │    │ (Sonnet +   │    │ (voice →      │
   │  15 моделей  │    │  Haiku)     │    │  text)        │
   │  Prisma ORM  │    │ 18 tools    │    │               │
   └──────────────┘    └─────────────┘    └───────────────┘
```

**Потоки данных:**

- **Telegram Chat → Bot** — long polling через grammy. Текст буферизуется (3с первое сообщение, 8с серия), голос транскрибируется через Groq Whisper, затем всё уходит в `chat()` (Claude API).
- **Mini App → Express** — HTTPS-запросы с `Authorization: tma <initData>`. HMAC-SHA256 валидация, затем маршрутизация в API-обработчики.
- **Scheduler → Services** — node-cron запускает задачи каждый час, фильтрует пользователей по локальному времени, вызывает соответствующие сервисы.


## 2. Каскад из 6 слоёв

Система организована как замкнутый цикл из шести слоёв. Каждый слой питает следующий и получает обратную связь от предыдущих.

```
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │   🧭 МИССИЯ (зачем я живу)                         │
    │   ↓  3 вопроса: кто я? что несу миру? что останется?│
    │                                                     │
    │   🎯 ЦЕЛИ (год / квартал)                           │
    │   ↓  привязаны к сферам жизни, имеют метрики        │
    │                                                     │
    │   🪞 ИДЕНТИЧНОСТЬ (кем стану)                       │
    │   ↓  BalanceGoal.identity → identity cards           │
    │                                                     │
    │   ⚡ ПРИВЫЧКИ (ежедневные действия)                  │
    │   ↓  goalId → цель, meaning framework, streaks      │
    │                                                     │
    │   🔋 ЭНЕРГИЯ (топливо для действий)                  │
    │   ↓  4 типа × 1-10, severity checkin, triggers      │
    │                                                     │
    │   🧠 КАЙДЗЕН (рефлексия → алгоритмы)                │
    │   ↓  инсайты → новые привычки / коррекция целей     │
    │                                                     │
    └───────────────── цикл ──────────────────────────────┘

    ⚖️ БАЛАНС (колесо жизни) — отдельная метрика,
       измерение удовлетворённости по 8 сферам.
       Не часть каскада, а срез поверх всех слоёв.
```

### Связи между слоями

| Связь | Механизм | Таблицы |
|-------|----------|---------|
| Миссия → Цели | Миссия задаёт направление, цели конкретизируют | `Mission` → `Goal.lifeArea` |
| Цели → Идентичность | У фокус-сферы есть identity ("кем стану") | `Goal` ↔ `BalanceGoal.identity` |
| Цели → Привычки | Привычка привязана к цели через `goalId` | `Goal.id` ← `Habit.goalId` |
| Привычки → Энергия | Корреляция: как привычка влияет на энергию | `HabitLog` ↔ `EnergyLog` (аналитика) |
| Энергия → Кайдзен | Контекст энергии подаётся в рефлексию | `EnergyLog` → `Reflection.energyContext` |
| Кайдзен → Привычки | Алгоритм может породить новую привычку | `Algorithm` → AI → `Habit` |
| Баланс ⊥ | Оценка 8 сфер (1-10), radar chart, focus areas | `BalanceRating`, `BalanceGoal` |


## 3. Архитектура бэкенда

### 3.1 Точка входа (index.ts)

Запуск идёт последовательно с обработкой ошибок:

```
main()
  1. prisma.$connect()          — подключение к PostgreSQL
  2. startServer()              — Express на PORT (default 3000)
  3. setupBot()                 — регистрация команд + menu button
  4. bot.api.deleteWebhook()    — сброс pending updates
  5. bot.start()                — long polling
  6. startScheduler()           — cron-задачи
```

Graceful shutdown через `SIGINT`/`SIGTERM`: остановка scheduler → server → bot → prisma disconnect.

### 3.2 Express-сервер (server.ts)

Два уровня маршрутов — публичные и аутентифицированные:

```
app.use(securityHeaders)       — X-Content-Type-Options, X-Frame-Options, XSS Protection
app.use(cors)                  — allowlist: webappUrl + web.telegram.org варианты
app.use(express.json())
app.use(express.static)        — dist/client/ (Vite build Mini App)

/api (public Router):
  GET  /api/diagnostics        — healthcheck (без auth)
  GET  /api/config             — botUsername, webappUrl (без auth)

/api (authed Router):
  middleware: telegramAuth     — HMAC-SHA256 → userId в req
  GET  /api/dashboard          — последние 4 энергии + streak
  GET  /api/history            — средние по дням (week/month)
  GET  /api/analytics          — AI-анализ паттернов
  ...                          — ещё ~25 роутов (habits, balance, kaizen, goals, etc.)
```

### 3.3 Бот (bot.ts)

**Команды:** `/start`, `/help`, `/energy`, `/report`, `/kaizen` — каждая в отдельном handler-файле.

**Callback queries (inline-кнопки):**
- `action:checkin`, `action:report` — быстрые действия
- `habit_(complete|skip|later):*` — управление привычками
- `digest_habit*` — создание привычки из дайджеста
- `goal_(done|drop):*` — завершение/дроп цели
- `checkin:*` — flow оценки энергии (4 шага)

**Адаптивный буфер сообщений:**

Проблема: пользователь может отправить серию коротких сообщений подряд. Без буфера каждое уходило бы в Claude отдельно.

Решение: `messageBuffers` — Map по userId. Первое сообщение ждёт 3 секунды, каждое следующее сбрасывает таймер на 8 секунд. При срабатывании таймера все сообщения объединяются и отправляются в `chat()` одним запросом.

**Голосовые сообщения:** файл скачивается с Telegram API → отправляется в Groq Whisper → транскрипт буферизуется как текст. Индикатор "typing..." поддерживается во время транскрипции.

### 3.4 Сервисный слой

| Сервис | Ответственность |
|--------|-----------------|
| `ai.ts` | Claude API, 18 Tool Use, system prompt, buildUserContext, обработка tool calls |
| `awareness.ts` | 11 типов awareness gaps, vacation check, контекст для AI |
| `energy-analysis.ts` | Severity: getSeverity(), slot-to-slot сравнение, triggers |
| `instant-recommendations.ts` | Рекомендации из knowledge base без AI |
| `habit-streaks.ts` | Streaks, consistency, strength (0-100), stage transitions |
| `habit-correlation.ts` | Корреляция привычка ↔ энергия (Pearson) |
| `habit-cron.ts` | Daily/weekly cron, routine reminders, vacation auto-resume |
| `weekly-digest.ts` | AI-анализ недели (Haiku), сохранение в WeeklyDigest |
| `smart-nudges.ts` | 8 типов proactive nudges, приоритизация |
| `checkin-sender.ts` | Timezone-aware отправка checkin-напоминаний |
| `scheduler.ts` | Координация всех cron-задач |
| `voice.ts` | Groq Whisper: скачивание файла, транскрипция, rate limiting |
| `monitor.ts` | Error tracking (ErrorLog), метрики (Metric) |
| `diagnostics.ts` | Health checks, analyzeEnergyHistory |

### 3.5 Knowledge Base

```
src/knowledge/
  types.ts         — EnergyType enum, Practice/MicroAction/Fact интерфейсы
  data.ts          — recovery practices по типам энергии (физ/мент/эмоц/дух)
  micro-actions.ts — микродействия (5 мин или меньше) для каждого типа
  energy-facts.ts  — научные факты об энергии для AI-контекста
```

Knowledge base используется в двух местах:
1. `instant-recommendations.ts` — мгновенные рекомендации после чекина (0 токенов AI)
2. `buildUserContext()` — top-3 практики для низкого типа энергии подаются в контекст Claude


## 4. Архитектура фронтенда (Mini App)

### 4.1 Стек и State Management

**Preact 10** + **@preact/signals** — реактивное состояние без Virtual DOM diffing для сигналов. Сигналы обновляют DOM напрямую, минуя reconciliation.

Каждый домен имеет свой store-файл с сигналами:

```
store/
  energy.ts    — dashboard, history, analytics сигналы + load/reset
  habits.ts    — habits array, loading state + loadHabits()
  balance.ts   — overview, radar data + loadBalanceOverview()
  kaizen.ts    — reflection status, algorithms, digests
  strategy.ts  — strategy data (mission + goals), botUsername, loadAppConfig()
  settings.ts  — timezone, vacation, notification prefs
```

Пример паттерна:
```typescript
// store/energy.ts
export const dashboardData = signal<DashboardData | null>(null);
export const loading = signal(false);

export async function loadInitialData() {
  loading.value = true;
  dashboardData.value = await api.getDashboard();
  loading.value = false;
}
```

### 4.2 Роутер

Hash-based роутер с поддержкой параметров. Не используется внешняя библиотека — 40 строк кода.

```
#hub                → Hub (5 виджетов)
#energy             → EnergyDashboard
#habits             → HabitsScreen
#balance            → BalanceScreen
#balance/strategy   → StrategyScreen
#balance/health     → BalanceDetail (area = health)
#kaizen             → KaizenScreen
#kaizen/42          → AlgorithmDetail (id = 42)
#settings           → SettingsScreen
```

`currentRoute` и `currentParam` — computed-сигналы от `currentParsedRoute`. Навигация через `navigate(route, param)` меняет `window.location.hash`. Событие `hashchange` обновляет сигнал.

### 4.3 Иерархия компонентов

```
App
├── screen-enter animation (CSS, key={route})
│
├── Hub
│   ├── EnergyCard      — мини-кольца + последний чекин
│   ├── HabitsCard      — прогресс дня + routine кнопки
│   ├── BalanceCard      — mini radar + score
│   ├── StrategyCard     — миссия + цели
│   └── KaizenCard       — статус рефлексии + алгоритмы
│
├── EnergyDashboard
│   ├── EnergyRings         — 4 кольца SVG
│   ├── EnergyCheckinOverlay — severity-based flow
│   ├── TriggerPicker       — выбор триггеров
│   ├── Timeline            — Chart.js line chart
│   ├── Observations        — список наблюдений
│   └── Analytics           — AI-паттерны
│
├── HabitsScreen
│   ├── DayProgress         — прогресс-бар дня
│   ├── RoutineGroup        — morning/afternoon/evening
│   │   └── HabitCard       — тап → complete / таймер
│   ├── RoutineFlow         — fullscreen пошаговый flow
│   ├── HabitCreate         — форма + FrequencyPicker + meaning
│   ├── HabitDetail         — meaning, stats, heatmap, correlation
│   │   ├── WeekHeatmap
│   │   ├── StageIndicator
│   │   └── CorrelationCard
│   └── MilestoneToast      — confetti на 7/21/30/60/90 дней
│
├── BalanceScreen
│   ├── RadarChart          — Chart.js radar, 8 осей
│   ├── BalanceDetail       — аспекты сферы, привычки, AI insight
│   ├── StrategyScreen      — миссия, цели с прогресс-барами, фокусы
│   └── BalanceRateOverlay  — быстрая оценка сфер
│
├── KaizenScreen
│   ├── AlgorithmDetail     — шаги, контекст, "спросить AI"
│   ├── DigestCard          — карточка дайджеста
│   └── DigestDetail        — полный дайджест недели
│
├── SettingsScreen          — timezone, vacation, notifications
│
└── BottomNav               — 5 табов: hub, balance, energy, kaizen, habits
```

### 4.4 API-клиент

`mini-app/api/client.ts` — обёртка над fetch с автоматическим добавлением `Authorization: tma <initData>`.

```typescript
async function request(method, path, body?) {
  const headers = { Authorization: `tma ${getInitData()}` };
  const res = await fetch(`/api${path}`, { method, headers, body });
  return res.json();
}

// ~35 методов: getDashboard, getHabits, createHabit, completeHabit,
// getBalance, rateAreas, getMission, getGoals, getStrategy, ...
```

### 4.5 Telegram SDK

`mini-app/telegram.ts` — обёртка над `Telegram.WebApp`:
- `initTelegram()` — expand, ready, disable vertical swipes
- `syncTheme()` — CSS-переменные из colorScheme (dark/light)
- `getInitData()` — для авторизации API-запросов
- `hapticFeedback()` — вибрация на действия
- `openTelegramLink()` — переход в чат с ботом
- `onActivated()` — reload данных при возврате из Telegram


## 5. Схема базы данных

### ER-диаграмма

```
User (1)
  ├──→ Mission (1:1, unique userId)
  ├──→ Goal (1:N)
  │      └──→ Habit (1:N, через goalId)
  ├──→ BalanceGoal (1:N, unique userId+area)
  ├──→ BalanceRating (1:N, indexed userId+area+createdAt)
  ├──→ Habit (1:N)
  │      └──→ HabitLog (1:N, unique habitId+date)
  ├──→ HabitLog (1:N, через userId)
  ├──→ EnergyLog (1:N)
  ├──→ Observation (1:N)
  ├──→ Session (1:N)
  │      ├──→ Message (1:N)
  │      └──→ Reflection (1:N)
  ├──→ Algorithm (1:N)
  │      └──← Reflection (через sourceReflectionId)
  ├──→ Reflection (1:N, unique userId+date)
  ├──→ WeeklyDigest (1:N, unique userId+weekStart)
  └──→ Message (1:N)

ErrorLog (standalone)
Metric (standalone)
```

### 15 моделей

| Модель | Ключевые поля | Назначение |
|--------|---------------|------------|
| **User** | telegramId (unique), timezone, vacationUntil, notificationPrefs (JSON) | Профиль пользователя |
| **EnergyLog** | physical/mental/emotional/spiritual (1-10), logType, note | Замер 4 типов энергии |
| **Habit** | name, type (build/break), routineSlot, frequency, customDays, goalId, isDuration, meaning fields (why*), stage, strength, streakCurrent, gracePeriod | Привычка со всей метаинформацией |
| **HabitLog** | habitId+date (unique), status, startedAt, completedAt | Лог выполнения привычки |
| **BalanceRating** | area, score (1-10), subScores (JSON), assessmentType | Оценка сферы жизни |
| **BalanceGoal** | userId+area (unique), targetScore, identity, isFocus | Цель по сфере + идентичность |
| **Mission** | userId (unique), identity, purpose, legacy, statement | Миссия: 3 вопроса → формулировка |
| **Goal** | lifeArea, title, timeHorizon (year/quarter), period, status, progress (0-100), metric, targetValue, currentValue, milestones (JSON) | Цель с прогрессом и метриками |
| **Algorithm** | title, steps (JSON), lifeArea, sourceReflectionId, usageCount | Персональный алгоритм из рефлексии |
| **Reflection** | date (unique per user), summary, insights (JSON), energyContext, habitsContext | Ежедневная рефлексия |
| **WeeklyDigest** | weekStart (unique per user), content (JSON), summary | AI-дайджест недели |
| **Observation** | energyType, direction, trigger, recommendation, energyLogId | Наблюдение о триггере энергии |
| **Session** | status, summary | Сессия разговора с ботом |
| **Message** | role, content, type, sessionId | Сообщение в сессии |
| **ErrorLog** | source, message, stack, count | Трекинг ошибок |
| **Metric** | name, value, tags | Метрики производительности |


## 6. AI-система

### 6.1 Архитектура Tool Use

Claude получает 18 инструментов через Anthropic Tool Use API. При каждом сообщении:

```
1. Пользователь → bufferMessage() → объединение → chat()
2. chat() загружает:
   - историю сессии (до 30 сообщений)
   - buildUserContext() (14 типов данных)
   - system prompt + дата/время + имя + voice note
3. Claude API вызов с tools[]
4. Если stop_reason === "tool_use":
   - Выполнить tool call (create_habit, rate_life_area, etc.)
   - Результат → обратно в Claude
   - Повторять до stop_reason === "end_turn" (макс 5 итераций)
5. Текстовый ответ → пользователю
6. Actions (start_checkin) → inline keyboard
```

### 6.2 Инструменты (18 штук)

| Категория | Tools | Описание |
|-----------|-------|----------|
| Привычки | `create_habit`, `update_habit`, `delete_habit`, `get_user_habits` | CRUD привычек с полным набором полей |
| Энергия | `start_energy_checkin` | Запуск flow с InlineKeyboard |
| Настройки | `set_timezone`, `set_vacation_mode` | Timezone (IANA), vacation mode |
| Баланс | `rate_life_area`, `set_balance_goal`, `start_balance_assessment` | Оценка сфер, цели, AI-guided assessment |
| Кайдзен | `save_algorithm`, `get_algorithms`, `save_reflection` | Алгоритмы + рефлексия |
| Стратегия | `set_mission`, `set_goal`, `update_goal_progress`, `get_goals` | Миссия, цели, прогресс |

Каждый tool имеет подробное описание на русском с примерами, когда вызывать и когда не вызывать. Это критично для качества — Claude использует описания для принятия решений.

### 6.3 buildUserContext (14 точек данных)

При каждом сообщении собирается контекст пользователя:

1. **Последние 5 записей энергии** — значения, давность, тренд
2. **Низкий тип энергии** — если <= 5, подгружаются практики из knowledge base
3. **Баланс жизни** — 8 сфер с оценками и давностью
4. **Миссия** — statement + identity
5. **Активные цели** — по сферам и горизонтам, с прогрессом
6. **Фокус-сферы** — из BalanceGoal (isFocus = true)
7. **Активные привычки** — streak, slot, goalId
8. **Алгоритмы** — top 5 по usage count
9. **Рефлексия** — вчерашняя или предупреждение об отсутствии
10. **Наблюдения** — за 30 дней + паттерны триггеров
11. **Awareness gaps** — приоритизированные пробелы в данных
12. **Vacation status** — активен ли режим паузы
13. **Текущие дата/время** — в timezone пользователя
14. **Тип сообщения** — text или voice (предупреждение о возможных неточностях Whisper)

### 6.4 System Prompt

Промт задаёт личность бота: анти-GPT стиль (строчные, фрагменты, без списков), максимум 1 вопрос за ответ, 2-4 предложения. Включает:
- Описание каскада (6 слоёв)
- Правила использования каждого инструмента
- DATA-тег для пассивного сбора данных из разговора
- Протоколы: миссия (3 вопроса), кайдзен-час (диалог → инсайты → алгоритмы)

### 6.5 Awareness Gaps (11 типов)

Система обнаруживает пробелы в данных пользователя и добавляет их в AI-контекст. Приоритеты от 100 (критично) до 35 (низкий).

| Приоритет | Gap | Триггер |
|-----------|-----|---------|
| 100 | `no_energy` | Ни одного замера |
| 90 | `no_habits` | Нет активных привычек |
| 80 | `no_balance` | Нет оценки, аккаунт > 3 дней |
| 70 | `stale_balance` | Баланс старше 14 дней |
| 60 | `no_mission` | Нет миссии, аккаунт > 14 дней |
| 55 | `no_goals` | Нет целей, аккаунт > 21 дней |
| 52 | `no_reflection` | Вчера не было рефлексии |
| 50 | `empty_meaning` | Привычка без meaning полей |
| 45 | `goal_without_habits` | Цель без привычек |
| 40 | `no_focus_areas` | Баланс есть, фокусов нет |
| 35 | `low_area_no_goal` | Сфера <= 4 без цели |

### 6.6 Smart Nudges

Ежедневно в 9:00 (локальное время) выбирается один nudge с наивысшим приоритетом. Шаблонные nudges расходуют 0 токенов AI. Fallback использует Haiku (~200 токенов).

8 типов: Goal-Habit Gap (90) → Low Consistency (85) → Energy Pattern (80) → Streak at Risk (75) → Milestone (70) → Weekly Goal Review (65) → Balance Drift (60) → AI Fallback (50).


## 7. Система Scheduler / Cron

### Timezone-aware dispatch

Все user-facing cron-задачи работают через единый паттерн:

```
UTC cron (каждый час в :00)
  → getUsersByLocalHour(targetHour)
    → для каждого user: Date.toLocaleString({timeZone: user.timezone})
    → если localHour === targetHour → включить в список
  → вызвать сервис со списком userId[]
```

Это позволяет обслуживать пользователей в разных часовых поясах одним UTC-кроном.

### Все cron-задачи

| Расписание (UTC) | Локальное время | Задача |
|-------------------|-----------------|--------|
| `*/15 * * * *` | — | Heartbeat (лог) |
| `0 * * * *` | — | Timezone-aware checkin sender |
| `0 0 * * *` | — | Daily: streaks, strength, stage transitions, vacation resume |
| `0 0 * * 1` | — | Weekly: freeze counter reset |
| `0 * * * *` | 7:00 | Morning routine reminder |
| `0 * * * *` | 8:00 | Kaizen reminder (если вчера не было) |
| `0 * * * *` | 9:00 | Smart nudge (1 в день, 8 типов) |
| `0 * * * *` | 10:00 | Balance check (если > 14 дней) |
| `0 * * * *` | 13:00 | Afternoon routine reminder |
| `0 * * * *` | 20:00 | Evening routine reminder |
| `0 * * * *` | Вс 20:00 | Weekly digest (AI-анализ + DB) |
| `0 * * * *` | 1 янв/апр/июл/окт 10:00 | Quarterly goal review |
| `0 * * * *` | 1 января 10:00 | Yearly mission review |

Фильтрация по дню недели и дате — отдельные функции `filterUsersByLocalDay()` и `filterUsersByLocalDate()`.


## 8. Аутентификация

### Telegram initData HMAC-SHA256

```
Mini App                    Express Server
   │                              │
   │  Authorization: tma <raw>    │
   │─────────────────────────────>│
   │                              │
   │                    1. Парсинг URLSearchParams
   │                    2. Проверка auth_date (< 24 часов) — anti-replay
   │                    3. Сортировка параметров по ключу
   │                    4. data_check_string = "key=value\nkey=value\n..."
   │                    5. secret = HMAC-SHA256("WebAppData", BOT_TOKEN)
   │                    6. hash = HMAC-SHA256(secret, data_check_string)
   │                    7. timingSafeEqual(hash, provided_hash) — anti-timing
   │                    8. Парсинг user JSON → telegramId
   │                    9. prisma.user.findUnique({telegramId})
   │                   10. req.userId = user.id
   │                              │
   │         200 / 401            │
   │<─────────────────────────────│
```

Защита: HMAC-SHA256 (подлинность), auth_date expiry (anti-replay, 24ч), timing-safe comparison (anti-timing), ownership check на мутациях.


## 9. Ключевые дизайн-решения

### Preact вместо React

Размер бандла критичен для Mini App — загружается внутри Telegram WebView. Preact: ~3KB gzipped vs React ~40KB. API совместим на 95%, миграция тривиальна.

### Signals вместо hooks (useState/useReducer)

Signals обновляют DOM напрямую, минуя Virtual DOM reconciliation. В приложении с частыми обновлениями (таймеры привычек, чекин flow) это даёт заметное преимущество. Signals также проще для кросс-компонентного состояния — не нужен Context API или state manager.

### grammy вместо node-telegram-bot-api

grammy — типизированный (TypeScript-first), активно поддерживаемый фреймворк с middleware-архитектурой. node-telegram-bot-api — legacy, слабая типизация, неактивная поддержка. grammy также поддерживает grammY runner для масштабирования.

### Severity-based checkin

Вместо одинакового flow для всех чекинов — адаптивный подход. Сравнение идёт slot-to-slot (утро с утром прошлого дня), чтобы не путать естественные колебания с реальными изменениями. Critical (drop >= 4) получает полный разбор причин, Stable — просто подтверждение.

### Forgiving streaks

Классические streaks наказывают за один пропуск (streak = 0). Forgiving streaks: grace period (2 пропуска/неделю), сила привычки (strength 0-100) растёт медленно и падает мягко. Stage-aware коэффициенты: seed +3/-5, growth +2/-3, autopilot +1.5/-2. Это снижает тревогу и повышает retention.

### Hash-based routing (не History API)

Telegram Mini App работает в WebView, где History API может конфликтовать с навигацией Telegram. Hash-routing (`#hub`, `#energy`) полностью изолировано от browser history. Реализация — 40 строк без зависимостей.

### Адаптивный буфер сообщений

Telegram-пользователи часто отправляют мысль несколькими сообщениями подряд. Без буфера каждое сообщение — отдельный запрос в Claude (дорого и фрагментированно). Буфер с двумя таймаутами (3с первое, 8с серия) объединяет серию в один запрос.

### Двухмодельная стратегия (Sonnet + Haiku)

Sonnet используется для чата (качество диалога критично). Haiku — для аналитики: weekly digest, smart nudges fallback, паттерн-анализ. Экономия ~10x на аналитических задачах при достаточном качестве.
