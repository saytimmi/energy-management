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
    start.ts, help.ts, energy.ts, report.ts, kaizen.ts, checkin.ts, habits.ts
  services/             → Бизнес-логика
    ai.ts               → Claude API + Tool Use (create_habit, start_checkin, get_habits)
    voice.ts            → Gemini транскрипция
    scheduler.ts        → node-cron расписание
    checkin-sender.ts   → Отправка чекинов по расписанию
    diagnostics.ts      → Health checks
    recommendations.ts  → AI рекомендации (legacy, не используется в post-checkin)
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
      habits.ts         → Signals: habitsData, todayProgress + actions
      index.ts          → Re-exports
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
        EnergyRings.tsx     → SVG кольца с анимацией
        Observations.tsx    → Список наблюдений
        Analytics.tsx       → AI паттерны
        utils.ts            → Хелперы (getTimeAgo, getDayWord, getNoteWord)
      habits/
        HabitsScreen.tsx    → Главный экран привычек
        HabitCard.tsx       → Карточка привычки (ring-based, one-tap completion)
        HabitCreate.tsx     → Создание на 1 экране (auto-icon, без wizard)
        HabitDetail.tsx     → Детальный вид (стадия, heatmap, editable meaning framework)
        RoutineGroup.tsx    → Группа утро/день/вечер
        DayProgress.tsx     → Прогресс-бар дня + стрик
        WeekHeatmap.tsx     → Мини-тепловая карта недели
        StageIndicator.tsx  → 🌱→🌿→🌳 визуал стадий
        CorrelationCard.tsx → Корреляция привычка ↔ энергия
        MilestoneToast.tsx  → Тост-уведомления (день 7/21/60)
      timeline/
        Timeline.tsx    → Chart.js график энергии (теперь внутри EnergyDashboard)
      journal/
        Journal.tsx     → Единый дневник (энергия + привычки + наблюдения)
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
| `#hub` | Hub | Виджеты-карточки: энергия, привычки (+ будущие: баланс, задачи) |
| `#energy` | EnergyDashboard | Кольца энергии, динамика (collapsible), наблюдения, AI паттерны, кнопка чекина |
| `#habits` | HabitsScreen | Привычки: прогресс, routine groups, one-tap completion, meaning framework |
| `#journal` | Journal | Единый дневник (энергия + привычки + наблюдения) |

Bottom nav: Главная → Энергия → Привычки → Дневник

`#timeline` → redirect на `#energy` (backwards compat)

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
| GET | /api/habits | Привычки юзера (grouped by routineSlot) |
| POST | /api/habits | Создать привычку (с meaning framework) |
| PATCH | /api/habits/:id | Обновить привычку |
| DELETE | /api/habits/:id | Soft delete привычки |
| POST | /api/habits/:id/complete | Отметить выполнение |
| DELETE | /api/habits/:id/complete | Отменить выполнение |
| GET | /api/habits/:id/stats | Стрик, consistency, heatmap |
| GET | /api/habits/:id/correlation | Корреляция привычка ↔ энергия |
| GET | /api/habits/today | Привычки на сегодня |
| GET | /api/habits/heatmap | Тепловая карта за месяц |

## Стратегия: глубина ядра, не ширина фич

Решение от 2026-03-22: вместо 6 отдельных систем — идеально работающий ежедневный цикл.
Исходный спек: `docs/superpowers/specs/2026-03-18-energy-app-v2-design.md` (пересмотрен, фазы 2/4/5 отменены)

### Завершено

| Что | Когда |
|-----|-------|
| Frontend Foundation (Preact + Vite, auth, hub) | ✅ |
| Habit Tracker + Knowledge Base (meaning framework, micro-actions, streaks, stages) | ✅ |
| Bot Intelligence Overhaul (AI tool use, severity checkin, slot-to-slot, habits UX) | ✅ 2026-03-22 |
| Life Balance через AI (lifeArea на привычках, rate_life_area tool, BalanceRating модель) | ✅ 2026-03-22 |

### Приоритеты (что делать дальше)

| # | Что | Почему |
|---|-----|--------|
| 1 | **Привычки РАБОТАЮТ** — проверить на телефоне, починить если Telegram кэширует старый UI | Базовый цикл не работает = всё остальное бесполезно |
| 2 | **Weekly AI digest** — бот раз в неделю присылает анализ: тренды энергии, какие привычки помогают, что ломает | Замыкает feedback loop |
| 3 | **Balance check через AI** — бот раз в 2 недели спрашивает оценку 8 сфер, предлагает привычки для просевших | Колесо баланса без отдельного UI |
| 4 | **Визуал Mini App** — polish карточек, анимации, адаптация к разным экранам | UX refinement |

### Отменено (не нужно)

| Что | Причина |
|-----|---------|
| ~~SVG Balance Wheel экран~~ | Заменён на AI-опрос в чате + lifeArea на привычках |
| ~~Task Manager~~ | Пользователь уже использует Google Calendar + Claude App |
| ~~Achievement System (XP/уровни)~~ | Стрики + confetti уже есть. Геймификация = overkill |
| ~~AI Intelligence как отдельная фаза~~ | AI улучшается итеративно, не отдельной системой |

## AI Bot Architecture (обновлено 2026-03-22)

### AI Tool Use
Бот использует Anthropic function calling. AI может выполнять реальные действия:
- `create_habit` — создаёт привычку в БД (name, icon, type, routineSlot, lifeArea + meaning fields)
- `start_energy_checkin` — отправляет InlineKeyboard для оценки энергии
- `get_user_habits` — возвращает список активных привычек
- `rate_life_area` — сохраняет оценку сферы жизни (8 сфер × 1-10)

**Важно:** AI НЕ должен говорить "создал/записал/зафиксировал" без вызова tool.

### Severity-based Checkin Response
После чекина система анализирует изменения **slot-to-slot** (утро с утром, вечер с вечером):
- **Critical** (drop ≥4 или level ≤3 с drop) → 🚨 расширенные причины + 3-4 рекомендации
- **Moderate** (drop 2-3) → 📉 базовые причины + 1-2 рекомендации
- **Improved** (rise ≥2) → 📈 "Что помогло?" + позитивные причины → сохраняет как rise observation
- **Stable** → 👍

Вечерний чекин дополнительно показывает intraday delta (утро → вечер).

### Message Buffer
Адаптивный: 3 сек для первого сообщения, 8 сек для серии.

### System Prompt Rules
- Max 1 вопрос за ответ
- Фокус строго на энергии, без болтовни
- Не имитировать UI текстом — использовать tools
- max_tokens: 1024
- Незакрытые `<!--DATA:` блоки автоматически удаляются

### Habit Creation UX
1 экран: название → auto-icon (по ключевым словам) → время → тип → создать.
После создания автоматически открывается Detail для заполнения meaning framework (необязательно).

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
