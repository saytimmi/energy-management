# QA Full System Test — Energy Management Personal OS

## Ты — QA-инженер. Твоя задача: сломать всё что можно.

Проект: Telegram бот + Mini App (Preact) для управления жизнью.
Stack: TypeScript, Express, Prisma + PostgreSQL, grammy, Preact, Vite.

### Как запускать

```bash
cd /Users/timur/energy-management
npm run build          # должен пройти без ошибок
npm test               # vitest — все тесты должны пройти
npm run dev            # запустить dev-сервер (port 8080 + vite 5173)
```

### Что тестировать

Ты должен протестировать ВСЁ: API endpoints, Mini App компоненты, бот-логику, edge cases, race conditions, валидацию, error handling.

---

## БЛОК 1: API Endpoints — функциональное тестирование

Для каждого endpoint: проверь happy path, edge cases, невалидные данные, пустые данные, граничные значения.

### 1.1 Energy API (новое, Phase 6)

```
POST /api/energy
```
Тесты:
- Happy path: `{ physical: 7, mental: 6, emotional: 8, spiritual: 5, logType: "manual" }` → должен вернуть `{ logId, severity, recommendations, triggerInfo }`
- Граничные значения: physical=1, physical=10 → ок
- Невалидные: physical=0, physical=11, physical=-1, physical=1.5, physical="abc" → 400 error
- Пустое тело: `{}` → 400
- Частично заполненное: `{ physical: 7 }` → 400 (нет остальных)
- Dedup: два запроса за 5 минут → второй обновляет первый, не создаёт новый
- Severity: если предыдущий чекин был 8/8/8/8, а новый 3/8/8/8 → severity.drops должен содержать physical с severity "critical"
- Severity: нет предыдущего чекина → severity.stable=true, drops=[], improvements=[]
- Recommendations: при drops должны быть рекомендации, при stable — пусто
- TriggerInfo: при critical drop → triggerInfo.direction="drop", triggerInfo.triggers непустой массив

```
POST /api/energy/:logId/triggers
```
- Happy path: `{ triggers: ["Плохой сон", "Устал"], energyType: "physical", direction: "drop" }` → ок, observationIds
- Пустые triggers: `{ triggers: [] }` → 400
- Невалидный logId: `/api/energy/999999/triggers` → должен либо 404, либо создать observations
- Без energyType → проверь что не упадёт в 500
- С context: `{ triggers: ["Стресс"], context: "работа до 2 ночи", energyType: "mental", direction: "drop" }` → context сохранён

### 1.2 Balance API

```
POST /api/balance/rate (новое, Phase 6)
```
- Happy path: 8 ratings `[{ area: "health", score: 7 }, ...]` → `{ ok: true, updated: 8 }`
- Частично: 3 из 8 → `updated: 3`
- Невалидные scores: score=0, score=11, score=-1 → пропускаются (updated не считает)
- Невалидная area: `{ area: "invalid", score: 5 }` → пропускается
- Пустой массив: `{ ratings: [] }` → 400
- Без ratings: `{}` → 400
- Повторный запрос → создаёт НОВЫЕ записи (не upsert), проверь что history растёт

```
GET /api/balance
GET /api/balance/radar
GET /api/balance/:area
POST /api/balance/goals
```
- Для каждого: проверь что возвращает данные после rate
- balance/:area — невалидная area → 400
- balance/goals — upsert: повторный POST с тем же area обновляет, не дублирует

### 1.3 Settings API (новое, Phase 7)

```
GET /api/settings
```
- Должен вернуть: `{ timezone, vacationUntil, vacationReason, notificationPrefs }`
- notificationPrefs должен иметь все 7 полей с дефолтами
- Для нового пользователя: vacationUntil=null, defaults для prefs

```
PUT /api/settings
```
- Обновить timezone: `{ timezone: "Europe/Moscow" }` → timezone изменился
- Обновить notificationPrefs: `{ notificationPrefs: { morningBrief: false } }` → morningBrief=false, остальные сохранились
- Vacation: `{ vacationUntil: "2026-04-01T00:00:00Z", vacationReason: "отпуск" }` → установлено
- Снять vacation: `{ vacationUntil: null, vacationReason: null }` → null
- Невалидные данные: пустой body → ничего не меняет, не падает

### 1.4 Config API (новое, Phase 6)

```
GET /api/config (без auth!)
```
- Должен вернуть `{ botUsername: "energy_coach_bot", webappUrl: "..." }`
- НЕ требует Authorization header

### 1.5 Существующие API — regression

Проверь что ВСЕ старые endpoints работают после рефакторинга:

```
GET  /api/dashboard
GET  /api/history?period=week
GET  /api/history?period=month
GET  /api/analytics
GET  /api/observations
GET  /api/checkin-trigger
GET  /api/habits
POST /api/habits
PATCH /api/habits/:id
DELETE /api/habits/:id
POST /api/habits/:id/start
POST /api/habits/:id/complete
DELETE /api/habits/:id/complete
POST /api/habits/:id/pause
POST /api/habits/:id/resume
GET  /api/habits/:id/stats
GET  /api/habits/:id/correlation
GET  /api/mission
PUT  /api/mission
GET  /api/goals
POST /api/goals
PATCH /api/goals/:id
GET  /api/strategy
GET  /api/reflection/status
GET  /api/algorithms
GET  /api/algorithms/:id
GET  /api/reflections
GET  /api/diagnostics
```

Для каждого: status 200, правильная структура, нет 500 ошибок.

---

## БЛОК 2: Unit Tests

```bash
npm test
```

- ВСЕ тесты должны пройти. Если какой-то падает — это баг, залогируй.
- Посмотри coverage: какие файлы не покрыты тестами? Запиши.
- Проверь что новые тесты (energy-analysis.test.ts, awareness.test.ts, meaning-identity.test.ts) проходят.

---

## БЛОК 3: Build & TypeScript

```bash
npm run build
npx tsc --noEmit
```

- Build должен пройти без ошибок
- TypeScript компиляция без ошибок
- Проверь что `dist/` содержит и серверный код и клиентский код (dist/client/)

---

## БЛОК 4: Prisma Schema & Migrations

```bash
npx prisma validate
npx prisma generate
```

- Schema валидна
- Проверь что новые поля на User существуют: vacationUntil, vacationReason, notificationPrefs
- Проверь что все relations корректны (нет orphaned references)

---

## БЛОК 5: Services — логика

### 5.1 Energy Analysis Service (src/services/energy-analysis.ts)

Проверь getSeverity():
- (3, 7) → critical (drop ≥4)
- (2, 5) → critical (level ≤3, drop ≥3)
- (5, 7) → moderate (drop 2)
- (6, 7) → mild (drop 1)
- (7, 7) → stable
- (8, 6) → improved (rise ≥2)
- (1, 1) → stable (нет drop)
- (10, 1) → improved
- (1, 10) → critical

### 5.2 Awareness Service (src/services/awareness.ts)

Проверь getAwarenessGaps():
- Новый пользователь (0 данных) → no_energy (priority 100)
- Есть energy, нет habits → no_habits (90)
- Есть energy+habits, нет balance, account >3 дней → no_balance (80)
- Balance старше 14 дней → stale_balance (70)
- Нет миссии, account >14 дней → no_mission (60)
- Habit без whyToday/whyIdentity → empty_meaning (50)
- Goal без habits в той же lifeArea → goal_without_habits (45)
- Gaps отсортированы по priority descending

Проверь isOnVacation():
- vacationUntil = завтра → true
- vacationUntil = вчера → false
- vacationUntil = null → false

### 5.3 Vacation Mode

Проверь что при включении vacation:
- Все активные привычки получают pausedAt
- User.vacationUntil установлен
- Все notification senders пропускают пользователя (isOnVacation guard)

Проверь vacation auto-resume в runDailyHabitCron():
- User с vacationUntil < now → vacationUntil обнуляется, привычки resumeаются

---

## БЛОК 6: Mini App Components — Smoke Test

Проверь что каждый компонент рендерится без ошибок (если можешь через vite dev или проверь TypeScript):

### 6.1 EnergyCheckinOverlay
- 4 слайдера рендерятся (physical, mental, emotional, spiritual)
- Каждый слайдер: min=1, max=10
- Кнопка "⚡ Записать" вызывает POST /api/energy
- После submit → если есть triggerInfo → показать TriggerPicker
- После submit → если нет triggerInfo → показать success screen

### 6.2 TriggerPicker
- Trigger кнопки рендерятся из triggerInfo.triggers
- Тап → toggle (добавить/убрать ✅)
- "✍️ Свой вариант" → показать input field
- "Готово" с 0 selected → пропустить
- "Готово" с >0 → показать context input → "Сохранить" → POST /api/energy/:logId/triggers

### 6.3 BalanceRateOverlay
- 8 слайдеров (все сферы) рендерятся
- Pre-fill из существующих оценок
- "Сохранить" → POST /api/balance/rate
- После сохранения → overlay закрывается, radar обновляется

### 6.4 SettingsScreen
- Рендерится через #settings route
- Gear icon в Hub → навигация на #settings
- Toggle switches для 5 notification типов
- Vacation presets (3/7/14/30 дней)
- Если vacation активен → показывает badge + кнопка "Снять паузу"
- Timezone отображается

### 6.5 HabitCard (изменённый)
- Тап на мгновенную привычку → сразу complete (НЕ показывает time sheet!)
- Тап на выполненную → uncomplete
- Long press → HabitDetail
- Стрелка `>` → HabitDetail (44px touch target)
- Duration привычка: "Начать" → "Готово"

### 6.6 RoutineFlow (изменённый)
- whyToday текст под названием привычки (если есть)
- Identity intro card перед первой привычкой (если identity есть для lifeArea)
- "Начать →" → убирает intro, начинает flow
- Если identity нет → flow начинается сразу
- minimalDose всё ещё показывается

### 6.7 HabitDetail (изменённый)
- "Зачем это тебе" секция ПЕРВАЯ (над strength bar и stats)
- Strength bar, stats, heatmap, correlation — всё на месте ниже
- Edit mode для meaning работает

### 6.8 Data Sync
- Действия в боте отражаются в app при возврате (onActivated)
- Overlay закрывается → данные перезагружаются

### 6.9 Bot Username Fix
- НИ ОДИН файл не содержит `getBotUsername()` function (удалена)
- `openTelegramLink()` используется вместо window.open
- Проверь файлы: KaizenScreen.tsx, AlgorithmDetail.tsx, StrategyScreen.tsx, BalanceScreen.tsx — НЕТ getBotUsername

---

## БЛОК 7: Edge Cases & Race Conditions

- Двойной тап на привычку → не должно дублировать completion
- Открыть EnergyCheckinOverlay → submit → быстро тапнуть ещё раз → не двойной запрос
- Открыть BalanceRateOverlay → быстро нажать "Сохранить" 3 раза → только 1 запрос
- API запрос без Authorization → 401 (кроме /api/config и /api/diagnostics)
- API запрос с невалидным Authorization → 401
- Очень длинный text в trigger context (5000 символов) → не падает
- Emoji в trigger text → сохраняется корректно
- Пустые строки в triggers → обрабатываются

---

## БЛОК 8: Code Quality Checks

```bash
# Поиск hardcoded bot username
grep -r "energy_coach_bot" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "config.ts"
```
→ Должен быть ТОЛЬКО в config.ts (как fallback default)

```bash
# Поиск getBotUsername
grep -r "getBotUsername" src/ --include="*.tsx" --include="*.ts"
```
→ Должно быть 0 результатов

```bash
# Поиск hardcoded Asia/Shanghai в scheduler
grep -r "Asia/Shanghai" src/services/scheduler.ts
```
→ Должно быть 0 результатов (все timezone теперь из user.timezone)

```bash
# Поиск time-sheet в HabitCard
grep -r "time-sheet\|showTimeSheet\|selectedTime" src/mini-app/components/habits/HabitCard.tsx
```
→ Должно быть 0 результатов (time sheet удалён)

---

## БЛОК 9: Regression — ничего не сломали

Проверь что всё что работало раньше продолжает работать:
- Energy Dashboard: кольца, timeline, observations, analytics
- Habits: create, complete, uncomplete, pause, resume, delete, RoutineFlow, DayProgress, WeekHeatmap
- Balance: radar chart, area list, area detail, strategy screen
- Kaizen: reflection status, algorithms, reflections feed, algorithm detail
- Strategy: mission display, focus areas, goals, compact areas
- Hub: 5 виджетов рендерятся, greeting по времени суток
- Navigation: все 5+1 табов работают (#hub, #energy, #habits, #balance, #kaizen, #settings)
- Deep links: #balance/strategy, #balance/health, #kaizen/42

---

## Формат отчёта

Для каждого найденного бага:

```
### BUG-001: [Краткое описание]
**Блок:** [номер]
**Severity:** Critical / High / Medium / Low
**Steps to reproduce:**
1. ...
2. ...
**Expected:** ...
**Actual:** ...
**File:** src/path/to/file.ts:line
```

В конце — summary:
- Total bugs found
- Critical / High / Medium / Low breakdown
- Areas with most issues
- Рекомендации
