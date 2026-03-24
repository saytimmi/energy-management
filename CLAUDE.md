# Energy Management App — Personal OS

Telegram бот + Mini App — персональная операционная система для управления жизнью.

## ТЕКУЩИЙ ФОКУС

Реализация Personal OS по спеку и планам. **Выполняй фазы последовательно.**

```
Спек:    docs/superpowers/specs/2026-03-23-personal-os-design.md
Фаза 1:  docs/superpowers/plans/2026-03-24-phase1-foundation.md   ✅ ЗАВЕРШЕНА
Фаза 2:  docs/superpowers/plans/2026-03-24-phase2-balance.md      ✅ ЗАВЕРШЕНА
Фаза 3:  docs/superpowers/plans/2026-03-24-phase3-kaizen.md       ✅ ЗАВЕРШЕНА
Фаза 4:  docs/superpowers/plans/2026-03-24-phase4-strategy.md     ✅ ЗАВЕРШЕНА
Фаза 5:  docs/superpowers/plans/2026-03-24-phase5-polish.md      ← СЛЕДУЮЩАЯ
```

**Правила:** Не добавляй ничего от себя. Следуй плану шаг за шагом. Каждая фаза зависит от предыдущей. Прочитай план Phase 4 и выполняй задачи последовательно.

## Каскад системы

```
🧭 МИССИЯ (зачем я живу) → 🎯 ЦЕЛИ (год/квартал) → 🪞 ИДЕНТИЧНОСТЬ (кем стану)
→ ⚡ ПРИВЫЧКИ (ежедневно) → 🔋 ЭНЕРГИЯ (топливо) → 🧠 КАЙДЗЕН (рефлексия) → цикл
⚖️ БАЛАНС = метрика (не цель, а измерение удовлетворённости, отдельно от каскада)
```

## Что есть сейчас

Шесть слоёв:
1. **Мониторинг** — ежедневная оценка 4 типов энергии (физ/мент/эмоц/дух)
2. **Стратегия** — колесо баланса жизни (8 сфер) через AI-опрос в чате
3. **Тактика** — привычки (мгновенные + длительные) = конкретные ежедневные действия
4. **Кайдзен** — ежедневная рефлексия → алгоритмы (персональная база знаний)
5. **Миссия + Цели** — видение, конкретные результаты по сферам
6. **AI Coach** — связывает всё, адаптируется, учится

Бот = быстрые действия + push. Mini App = визуал + управление.

## Stack

**Backend:** TypeScript, Node.js, Express, grammy (Telegram Bot API), Prisma + PostgreSQL (Neon), Anthropic Claude API (AI чат с Tool Use), Groq Whisper (транскрипция голосовых)

**Frontend (Mini App):** Preact 10 + @preact/signals, Vite 5, Chart.js 4, Telegram Mini App SDK

## Архитектура

```
src/
  index.ts              → точка входа, запуск бота + сервера
  server.ts             → Express: API + статика dist/client/
  bot.ts                → grammy: Telegram бот + message buffer
  config.ts             → env переменные
  db.ts                 → Prisma client
  middleware/
    telegram-auth.ts    → initData HMAC-SHA256 валидация
  api/                  → Express роуты (за auth middleware)
    dashboard.ts, history.ts, analytics.ts, observations.ts,
    checkin-trigger.ts, habits.ts, kaizen.ts
  handlers/             → Telegram bot команды
    start.ts, help.ts, energy.ts, report.ts, kaizen.ts, checkin.ts, habits.ts
  services/             → Бизнес-логика
    ai.ts               → Claude API + Tool Use + system prompt
    voice.ts            → Groq Whisper транскрипция
    scheduler.ts        → node-cron расписание
    checkin-sender.ts   → Отправка чекинов по расписанию
    weekly-digest.ts    → Еженедельный AI-анализ паттернов
    diagnostics.ts      → Health checks
    instant-recommendations.ts → Рекомендации из knowledge base
    habit-streaks.ts    → Расчёт streaks, consistency, stage transitions
    habit-cron.ts       → Ежедневный/еженедельный cron для привычек
    habit-correlation.ts → Корреляция привычки ↔ энергия
    monitor.ts          → Error tracking
  knowledge/            → Knowledge base
    types.ts, data.ts, micro-actions.ts, energy-facts.ts
  mini-app/             → Preact frontend (собирается Vite)
    main.tsx, app.tsx, router.ts, telegram.ts
    store/  energy.ts, habits.ts
    api/    client.ts, types.ts
    components/
      hub/       Hub.tsx, EnergyCard.tsx, HabitsCard.tsx
      energy/    EnergyDashboard.tsx, EnergyRings.tsx, Observations.tsx, Analytics.tsx, utils.ts
      habits/    HabitsScreen.tsx, HabitCard.tsx, HabitCreate.tsx, HabitDetail.tsx,
                 RoutineGroup.tsx, RoutineFlow.tsx, DayProgress.tsx, WeekHeatmap.tsx,
                 StageIndicator.tsx, CorrelationCard.tsx, MilestoneToast.tsx
      timeline/  Timeline.tsx (Chart.js, внутри EnergyDashboard)
      journal/   Journal.tsx
      shared/    Card.tsx, BottomNav.tsx, Loading.tsx
    styles/  variables.css, global.css
prisma/
  schema.prisma → User, EnergyLog, Message, Session, Observation, Habit, HabitLog, BalanceRating, ErrorLog, Metric
```

## Привычки

**Мгновенные** (по умолчанию) — тап → time sheet "Во сколько?" → подтверждение.

**Длительные** (isDuration: true) — три состояния: Не начата → "Начать" → В процессе (таймер) → "Готово". При создании: toggle "На время" + пресеты длительности.

**Meaning Framework** (обязателен при создании) — Step 2 wizard:
- Build: 4 вопроса (whyToday, whyMonth, whyYear, whyIdentity)
- Break: 3 вопроса (isItBeneficial, breakTrigger, replacement)

**Forgiving Streaks** — grace period (2 пропуска/неделю без потери стрика). "Сила привычки" (strength 0-100) растёт медленно, падает мягко. Stage-aware: seed +3/-5, growth +2/-3, autopilot +1.5/-2.

**Routine Stacking** — кнопка "▶ Рутина" в RoutineGroup → fullscreen RoutineFlow с пошаговым таймером. Summary в конце.

**Pause Mode** — поставить привычку на паузу (3/7/14/30 дней). Стрик замораживается. Auto-resume по дате.

**Minimal Dose** — опциональное поле minimalDose ("5 мин растяжки"). Показывается в RoutineFlow.

**Inline Bot Actions** — 3 кнопки в Telegram: ✅ Сделал / ⏭ Скип / ⏰ Позже. Скип использует grace day. Позже = напоминание через 1 час. Routine reminders: 7:30/13:00/20:30.

**Weekly AI Insights** — Claude Haiku анализирует корреляции привычка↔энергия, находит паттерны, предсказывает stage transitions. Strength bars в дайджесте.

## Навигация

Hash-based роутер. Hub-and-spoke: главный → тап на карточку → детальный вид → назад.

| Роут | Компонент | Описание |
|------|-----------|----------|
| `#hub` | Hub | Виджеты: энергия, привычки |
| `#energy` | EnergyDashboard | Кольца, динамика, наблюдения, AI паттерны |
| `#habits` | HabitsScreen | Прогресс, routine groups, FAB "+" |
| `#journal` | Journal | Записи с trigger/context |

Bottom nav: Главная → Энергия → Привычки → Дневник

## Аутентификация

`Authorization: tma <Telegram.WebApp.initData>` → HMAC-SHA256 валидация через bot token → telegramId → userId.

Middleware: `src/middleware/telegram-auth.ts` — все API кроме /api/kaizen.

## Build & Deploy

```bash
npm run build    # prisma generate && tsc && vite build
npm run dev      # concurrently: tsx watch (port 8080) + vite dev (5173, proxy /api → 8080)
npm test         # vitest run
```

Railway auto-deploy из main. Порт задаётся через env `PORT` (дефолт 3000, vite proxy на 8080).

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/dashboard | Последние 4 энергии + streak |
| GET | /api/history?period=week\|month | Средние по дням |
| GET | /api/analytics | AI-анализ паттернов |
| GET | /api/observations | Наблюдения (trigger, direction) |
| GET | /api/checkin-trigger | Запуск чекина (dedup 30с) |
| GET | /api/kaizen | Диагностика (без auth) |
| GET | /api/habits | Привычки (grouped by routineSlot) |
| GET | /api/habits/today | Привычки на сегодня с completion status |
| GET | /api/habits/heatmap | Тепловая карта за месяц |
| POST | /api/habits | Создать привычку |
| PATCH | /api/habits/:id | Обновить привычку |
| DELETE | /api/habits/:id | Soft delete |
| POST | /api/habits/:id/start | Начать длительную привычку |
| POST | /api/habits/:id/complete | Завершить привычку |
| DELETE | /api/habits/:id/complete | Отменить выполнение |
| POST | /api/habits/:id/pause | Поставить на паузу (body: {days}) |
| POST | /api/habits/:id/resume | Возобновить после паузы |
| GET | /api/habits/:id/stats | Стрик, consistency, strength, heatmap |
| GET | /api/habits/:id/correlation | Корреляция привычка ↔ энергия |
| GET | /api/mission | Миссия пользователя |
| PUT | /api/mission | Обновить миссию (upsert) |
| GET | /api/goals | Цели (фильтры: lifeArea, timeHorizon, status) |
| POST | /api/goals | Создать цель |
| PATCH | /api/goals/:id | Обновить цель |
| GET | /api/strategy | Стратегия (mission + goals + areas + habits) |

## AI Bot

### Tool Use
- `create_habit` — создаёт привычку (все поля: duration, isDuration, triggerAction, minimalDose, meaning)
- `update_habit` — редактирует привычку по ID (название, время, смысл, длительность)
- `delete_habit` — удаляет привычку по ID (soft delete)
- `start_energy_checkin` — InlineKeyboard для оценки энергии
- `get_user_habits` — список активных привычек с ID
- `rate_life_area` — оценка сферы жизни (8 сфер × 1-10)

AI автоматически парсит привычки из голоса/текста, заполняет максимум полей, подбирает icon, lifeArea, energyType.

### Правила поведения
- Анти-GPT стиль: запрет на списки (•/-/1.), жирный текст, формальные обороты
- Пишет строчными, фрагментами, как друг в телеграме ("слушай", "ну смотри")
- Max 1 вопрос за ответ, 2-4 предложения
- НЕ говорить "создал/записал" без вызова tool
- НЕ имитировать UI текстом

### Severity-based Checkin
Slot-to-slot сравнение (утро с утром):
- **Critical** (drop ≥4 или level ≤3 с drop) → причины + рекомендации (quick ≤15мин + day-long)
- **Moderate** (drop 2-3) → причины + 1-2 рекомендации
- **Improved** (rise ≥2) → "Что помогло?"
- **Stable** → 👍

Умная логика времени: ночью (00-06) предупреждает что оценка занижена, после 23:00 учитывает усталость.

Dedup: сервер 5мин cooldown (update existing), клиент — если checkin уже в процессе, повторный тап игнорируется.

## Дизайн: Glass Dark Premium

Вдохновлён Bearable, Streaks, Apple Fitness:
- Тёплый тёмный фон `#0c0d12` (blue tint)
- Glassmorphism: `backdrop-filter: blur(20px)` + `border: 1px solid rgba(255,255,255,0.06)`
- Ambient glow за энергетическими кольцами
- Gradient icon containers для привычек (цвет по lifeArea)
- Accent: `#c8ff73` (lime green) с glow на CTA

## Что НЕ нужно

- Task Manager → пользователь использует Google Calendar + Claude App
- Achievement System (XP/уровни) → стрики + confetti достаточно
- Фичи вне текущих фаз — только то что в планах

## Kaizen Protocol

```bash
curl -s https://energy-management-production.up.railway.app/api/diagnostics | jq .
npm run build
npm test
```

Коммитить каждое улучшение отдельно, не ломать функционал, тестировать билд.
