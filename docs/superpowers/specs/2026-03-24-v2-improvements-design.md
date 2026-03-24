# Personal OS v2 — Полный план улучшений

## Философия

**Приложение работает на человека, не человек на приложение.**

- Бот = умный коуч, который видит всё и подсказывает что заполнить, когда уместно
- Mini App = полноценный инструмент, не read-only дашборда
- Всё двустороннее: сделал в боте → видно в app, сделал в app → бот знает
- Система сама ведёт к полноте данных через естественный диалог, без принуждения
- Каскад (миссия→цели→привычки→энергия→рефлексия) должен быть visible и reinforced ежедневно

---

## Фаза 6: Seamless Bot ↔ App

**Цель:** Mini App становится полноценным — в нём можно делать ВСЁ. Бот видит действия из app. Убрать все "→ Telegram" костыли.

### 6.1 In-App Energy Checkin

Сейчас: кнопка "⚡ Записать энергию" в EnergyDashboard вызывает `api.triggerCheckin()` → бот присылает inline keyboard в Telegram → пользователь уходит из app.

**Новый flow:**
- Кнопка "⚡ Записать энергию" открывает **fullscreen overlay** в Mini App
- 4 слайдера (physical/mental/emotional/spiritual), каждый 1-10
- Предзаполнение: если есть предыдущий чекин за сегодня → показать те значения
- Кнопка "Записать" → `POST /api/energy` (новый endpoint)
- После записи: severity analysis прямо в app (показать drop/rise как сейчас в боте)
- Если severity critical/moderate → показать trigger picker (те же кнопки что в боте)
- Trigger picker: preset кнопки + "свой вариант" + "готово"
- После triggers → опциональное текстовое поле "что произошло?"
- Всё сохраняется как EnergyLog + Observation
- **Рефакторинг:** извлечь severity analysis из `src/handlers/checkin.ts` в `src/services/energy-analysis.ts` — shared между bot и API

**Новый API:**
```
POST /api/energy
Body: { physical, mental, emotional, spiritual, logType: "manual" }
Response: { logId, severity: { type, drops[], improvements[] }, recommendations[] }

POST /api/energy/:logId/triggers
Body: { triggers: string[], context?: string, energyType: string, direction: "drop"|"rise" }
Response: { ok: true, observationIds: number[] }
```

**Что остаётся в боте:** бот по-прежнему отправляет scheduled checkins (утро/вечер). Inline keyboard flow остаётся для тех кто отвечает прямо в Telegram. Но теперь это не единственный способ.

### 6.2 In-App Balance Rating

Сейчас: кнопка "Оценить баланс" в BalanceScreen → `window.open(https://t.me/energy_coach_bot?text=баланс)` → уходит в Telegram. Абсурд.

**Новый flow:**
- Кнопка "Оценить баланс" → fullscreen overlay / bottom sheet
- 8 сфер: иконка + название + слайдер 1-10
- Если есть предыдущие оценки → предзаполнить
- Если бот собрал passive data → показать AI-предложение ("здоровье: предлагаю 4, потому что сон проседает")
- Кнопка "Сохранить" → `POST /api/balance/rate` (новый endpoint)
- После сохранения → radar chart обновляется мгновенно
- Опционально: можно тапнуть на сферу чтобы оценить аспекты (sleep, activity и т.д.)

**Новый API:**
```
POST /api/balance/rate
Body: { ratings: Array<{ area: string, score: number, subScores?: Record<string, number> }> }
Response: { ok: true, updated: number }
```

Это bulk endpoint — можно за один запрос оценить все 8 сфер. Каждый rating сохраняется как BalanceRating с `assessmentType: "quick"`.

**Различие типов:** `"quick"` = in-app слайдеры, `"subjective"` = из бота вручную, `"ai_guided"` = глубокий AI assessment с декомпозицией. Все три типа сохраняются в одной таблице и видны в истории.

**AI-guided assessment остаётся через бота** как глубокий вариант (декомпозиция по аспектам, обсуждение). Но quick sliders в app — основной способ.

### 6.3 Убрать все getBotUsername() хардкоды

Сейчас: `getBotUsername()` в 3 файлах возвращает `"energy_coach_bot"`.

**Исправление:**
- `config.ts`: добавить `BOT_USERNAME` из env (или из `bot.api.getMe()` при старте)
- API endpoint `GET /api/config` → `{ botUsername, webappUrl }`
- Mini App при загрузке получает config и использует botUsername
- Deep links через `Telegram.WebApp.openTelegramLink()` (native API вместо window.open)

### 6.4 Data Sync: App ↔ Bot

Сейчас: если бот создал привычку или записал энергию — app узнает только при следующем открытии/перезагрузке.

**Решение (простое, без WebSocket):**
- `Telegram.WebApp.onEvent('activated')` → перезагрузить data stores (energy, habits, balance, kaizen)
- Это срабатывает когда пользователь возвращается в Mini App из Telegram
- Достаточно для MVP — данные обновляются при каждом return to app

### 6.5 Time Sheet Friction Fix

Сейчас: тап на мгновенную привычку → time picker "Во сколько?" → выбрать → "Выполнено". 3 тапа на самое частое действие.

**Новый flow:**
- Обычный тап = **выполнено сейчас** (note: текущее время). Один тап.
- Long press (500ms) = открыть HabitDetail (без изменений)
- Стрелка `>` на карточке → HabitDetail (без изменений)
- Time picker доступен только в HabitDetail → "Отметить за другое время"

Убираем time sheet overlay из HabitCard полностью.

### 6.6 HabitDetail доступность

Сейчас: HabitDetail (meaning, stats, pause, correlation) только через long press 500ms или крошечную стрелку 18px.

**Улучшение:**
- Стрелка `>` увеличить до 44px touch target (Apple HIG minimum)
- Весь правый edge карточки (стрелка area) — 44px wide touch zone
- **Без свайпа** — Telegram Mini App WebView перехватывает горизонтальные свайпы для навигации

---

## Фаза 7: Smart Bot Awareness

**Цель:** Бот видит что пустое/устарело и органично подводит пользователя к заполнению. Уведомления не спамят, а помогают.

### 7.1 Awareness Layer

Новый модуль `src/services/awareness.ts` — анализирует состояние данных пользователя и возвращает приоритизированный список "что заполнить".

```typescript
interface AwarenessGap {
  type: "no_energy" | "no_balance" | "stale_balance" | "no_habits" | "no_mission" |
        "no_goals" | "no_reflection" | "empty_meaning" | "no_focus_areas" |
        "goal_without_habits" | "low_area_no_goal";
  priority: number;        // 1-100, выше = важнее
  area?: string;           // lifeArea если relevant
  suggestion: string;      // что предложить пользователю
  triggerContext?: string;  // в каком контексте это уместно предложить
}

async function getAwarenessGaps(userId: number): Promise<AwarenessGap[]>
```

**Приоритеты (от высокого к низкому):**
1. `no_energy` (100) — ни одного чекина → "расскажи как ты себя чувствуешь"
2. `no_habits` (90) — 0 привычек → после первого чекина предложить создать
3. `no_balance` (80) — 0 оценок баланса → после 3+ дней использования
4. `stale_balance` (70) — оценки старше 14 дней → "обновим?"
5. `no_mission` (60) — нет миссии → после 2+ недель использования
6. `no_goals` (55) — нет целей → после миссии или через 3+ недели
7. `empty_meaning` (50) — привычки без meaning framework → при рефлексии
8. `goal_without_habits` (45) — цель есть, привычек для неё нет
9. `no_focus_areas` (40) — баланс оценён, но фокус не выбран
10. `low_area_no_goal` (35) — сфера ≤4, нет цели → "может поставим цель?"

**Правила:**
- Не предлагать больше 1 gap за разговор
- Не предлагать gap если пользователь пришёл с конкретным запросом
- Уместно предлагать: в конце разговора, после рефлексии, при idle момент
- Бот помнит что уже предлагал (через session context) — не повторяется

### 7.2 Интеграция awareness в AI

`buildUserContext()` добавляет секцию:

```
ПРОБЕЛЫ В ДАННЫХ (предложи заполнить когда уместно):
- Баланс жизни не оценивался 18 дней → предложи "обновим баланс? быстро 8 вопросов"
- Привычка "Зарядка" без meaning → при следующей рефлексии спросить "зачем тебе зарядка?"
- Нет целей для здоровья (оценка 4/10) → "может поставим цель?"
```

Бот НЕ впихивает это в первое же сообщение. Он ждёт уместного момента: конец разговора, рефлексия, или когда пользователь сам затрагивает тему.

### 7.3 Notification Batching

Сейчас: 7:30 habits + 8:00 kaizen + 9:00 nudge = 3 сообщения за 1.5 часа утром.

**Новый flow: Morning Brief (1 сообщение)**

Вместо 3 отдельных cron jobs утром — один `sendMorningBrief()` в 8:00 (по timezone пользователя):

```
☀️ Доброе утро!

⚡ Утренняя рутина: 🧘 Медитация, 🏃 Зарядка, 💧 Вода
[▶ Начать рутину]  ← inline кнопка → открывает Mini App в RoutineFlow

🧠 Рефлексия за вчера не пройдена
[💬 Начать рефлексию]  ← inline кнопка

🎯 Цель "бегать 3/нед": пока 1 раз на этой неделе
```

Компоненты:
- Привычки текущего слота (morning)
- Awareness gap (если есть, max 1)
- Smart nudge (если есть и не совпадает с awareness)
- Quick stats (цель, streak)

**Scheduler change:**
- Удалить отдельные cron: morning habits (7:30), kaizen reminder (8:00), smart nudge (9:00)
- Добавить один: `sendMorningBrief()` в 8:00 по user.timezone
- Afternoon (13:00) и evening (20:30) habit reminders оставить отдельно, но тоже по user.timezone

### 7.4 Fix Timezone Hardcoding

Сейчас: 7 cron jobs hardcoded к Asia/Shanghai. Только energy checkins timezone-aware.

**Исправление (hourly-poll, как energy checkins):**
- ВСЕ user-facing cron jobs → timezone-aware
- Паттерн: cron запускается каждый час (`0 * * * *`), проверяет local time каждого пользователя — как уже сделано для checkins в `scheduler.ts:24`
- Удалить hardcoded `{ timezone: "Asia/Shanghai" }` из всех cron.schedule вызовов

**Какие cron jobs мержатся в Morning Brief:**
- ❌ Удалить: morning habits (7:30), kaizen reminder (8:00), daily nudge (9:00)
- ✅ Заменить одним: `sendMorningBrief()` — hourly cron, фильтрует users где local time = 8:00

**Какие cron jobs остаются (но timezone-aware):**
- Heartbeat (каждые 15 мин) — оставить как есть
- Checkin sender (hourly) — уже timezone-aware
- Daily habit cron (midnight UTC) — оставить UTC
- Weekly habit reset (Mon midnight UTC) — оставить UTC
- Afternoon habits (13:00) → hourly + check local time
- Evening habits (20:30) → hourly + check local time
- Weekly digest (Sun 20:00) → hourly + check local time
- Balance check (daily 10:00) → hourly + check local time
- Quarterly review (1st of Q) → hourly + check local time
- Yearly mission review (Jan 1) → hourly + check local time

### 7.5 Vacation / Sick Mode

Новая фича: глобальная пауза системы.

**Bot command:** "я заболел" / "в отпуске" / "пауза на 5 дней"

**AI tool:**
```typescript
{
  name: "set_vacation_mode",
  input_schema: {
    enabled: boolean,
    days?: number,       // auto-resume через N дней
    reason?: string      // "болезнь" | "отпуск" | "перегрузка"
  }
}
```

**Что происходит:**
- Все привычки → auto-pause (стрики замораживаются)
- Все уведомления → отключаются (кроме manual)
- User model: `vacationUntil: DateTime?`, `vacationReason: String?`
- При auto-resume: бот пишет "с возвращением! как ты?"
- Mini App: banner "⏸ На паузе до 28 марта"

**DB change:** добавить в User:
```prisma
vacationUntil DateTime?
vacationReason String?
```

### 7.6 Notification Preferences (in-app)

Новый экран в Mini App: настройки уведомлений.

**Роут:** `#settings` (новый таб или через Hub → ⚙️)

**Опции:**
- Morning brief: вкл/выкл + время (default 8:00)
- Afternoon reminder: вкл/выкл
- Evening reminder: вкл/выкл
- Weekly digest: вкл/выкл
- Balance reminder: вкл/выкл + частота (7/14/30 дней)

**DB:** JSON field на User:
```prisma
model User {
  // ... existing
  notificationPrefs Json? // shape below
}
```

**NotificationPrefs JSON shape:**
```typescript
interface NotificationPrefs {
  morningBrief: boolean;     // default: true
  morningTime: string;       // default: "08:00", format "HH:MM"
  afternoonReminder: boolean; // default: true
  eveningReminder: boolean;   // default: true
  weeklyDigest: boolean;     // default: true
  balanceReminder: boolean;  // default: true
  balanceIntervalDays: number; // default: 14
}
```

**API:**
```
GET /api/settings → { timezone, notificationPrefs, vacationUntil }
PUT /api/settings → update
```

---

## Фаза 8: Meaning & Identity в Daily Flow

**Цель:** "Зачем" привычки и идентичность видны каждый день, а не спрятаны за long press.

### 8.1 Meaning в RoutineFlow

Сейчас RoutineFlow показывает: иконку, название, таймер, minimalDose. Meaning полей НЕТ.

**Добавить:**
- Под названием привычки: `whyToday` мелким текстом (var(--text2), 12px)
- Если `whyToday` пусто — не показывать (не ломать layout)

```tsx
// RoutineFlow.tsx, routine-flow-card
<h3 class="routine-flow-name">{current.name}</h3>
{current.whyToday && (
  <p class="routine-flow-why">{current.whyToday}</p>
)}
```

### 8.2 Meaning в HabitCard (subtle)

Сейчас HabitCard показывает: icon, name, streak, stage, duration. Meaning НЕТ.

**Добавить:** при раскрытии деталей (не на основной карточке — она должна быть compact):
- В HabitDetail: секция "Зачем" всегда видна первой (сейчас скроллить надо)
- Если meaning не заполнен → бот awareness layer подскажет заполнить

### 8.3 Identity Reinforcement

**В Smart Nudges (утренний brief):**
Когда показываем привычку фокус-сферы, добавлять identity:

```
⚡ Утренняя рутина: 🏃 Зарядка
🪞 Ты становишься: "Человек который бегает каждое утро"
```

Не каждый день — раз в 3-5 дней, чтобы не приелось. Использовать `BalanceGoal.identity` для фокус-сфер.

**В RoutineFlow:**
Перед первой привычкой — motivational card с identity фокус-сферы:

```
🪞 Сегодня ты — человек, который заботится о здоровье
[Начать →]
```

Показывать только если есть identity для lifeArea первой привычки в рутине.

### 8.4 Algorithm usageCount Fix

Баг: `get_algorithms` возвращает алгоритмы но не инкрементит usageCount.

**Fix:** в executeTool для `get_algorithms`:
```typescript
// После поиска, для каждого возвращённого алгоритма:
for (const algo of found) {
  await prisma.algorithm.update({
    where: { id: algo.id },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() }
  });
}
```

---

## Фаза 9: Living Goals & Connections

**Цель:** Цели живут, имеют прогресс, и explicit связаны с привычками.

### 9.1 Goal Progress

**DB change:**
```prisma
model Goal {
  // ... existing
  progress     Int?      @default(0)    // 0-100%
  metric       String?                   // "km", "раз в неделю", "рублей"
  targetValue  Float?                    // 21.1 (для полумарафона)
  currentValue Float?    @default(0)     // 15.0
  milestones   Json?                     // [{ title: "10 км", done: true }, ...]
}
```

**API:**
```
PATCH /api/goals/:id
Body: { progress?, currentValue?, milestones? }
```

**Bot tool update:**
```typescript
{
  name: "update_goal_progress",
  input_schema: {
    goalId: number,
    progress?: number,
    currentValue?: number,
    note?: string
  }
}
```

Бот может обновлять прогресс из разговора: "пробежал 15 км сегодня" → AI: update_goal_progress(goalId=X, currentValue=running_total).

**Mini App:**
- StrategyScreen: FocusAreaCard показывает progress bar для целей
- BalanceDetail: progress bar для целей сферы

### 9.2 Explicit Habit → Goal Link

**DB change:**
```prisma
model Habit {
  // ... existing
  goalId Int?
  goal   Goal? @relation(fields: [goalId], references: [id])
}

model Goal {
  // ... existing
  habits Habit[]
}
```

**При создании привычки:**
- Bot tool `create_habit`: добавить optional `goalId`
- AI автоматически привязывает к цели если есть matching lifeArea + active goal
- Mini App HabitCreate: dropdown "Для какой цели?" (показать active goals)

**Визуализация:**
- StrategyScreen: привычки показываются под конкретной целью, а не просто все из сферы
- HabitDetail: "Для цели: Пробежать полумарафон (60%)"
- Weekly digest: "привычка X для цели Y — consistency 80%"

### 9.3 Frequency Flexibility

Сейчас: все привычки = daily. В schema уже есть `frequency String @default("daily")` и `customDays String?` — но они нигде не используются в UI и логике.

**Реализация (активация существующих полей + новое поле):**
- HabitCreate: выбор частоты: "Каждый день" | "Дни недели" (чекбоксы Пн-Вс) | "N раз в неделю"
- `Habit.frequency`: уже есть, активировать "daily" | "weekly" | "custom"
- `Habit.customDays`: уже есть, активировать — "1,3,5" (пн, ср, пт) или null
- `Habit.targetPerWeek`: **НОВОЕ поле** — 3 (для "N раз в неделю")

**Изменения в логике:**
- `habit-streaks.ts`: consistency calculation учитывает frequency
  - daily: completions / total_days
  - custom days: completions / scheduled_days
  - N per week: completions_this_week / targetPerWeek
- `habit-cron.ts`: routine reminders отправляются только в scheduled days
- HabitsScreen: привычки которые не scheduled на сегодня → показывать серым или не показывать
- Bot tool create_habit: добавить `frequency`, `customDays`, `targetPerWeek`

### 9.4 Weekly Digest Persistence

Сейчас: weekly digest = одно сообщение в Telegram, потом потеряно.

**Решение:**

**DB:**
```prisma
model WeeklyDigest {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  weekStart DateTime // начало недели
  content   Json     // полный WeeklyInsight object
  summary   String   // AI-generated текст дайджеста
  createdAt DateTime @default(now())

  @@unique([userId, weekStart])
}
```

**API:**
```
GET /api/digests → последние 10 дайджестов
GET /api/digests/:weekStart → конкретный дайджест
```

**Mini App:**
- В KaizenScreen или отдельная секция: "📊 Недельные дайджесты"
- Карточки по неделям: дата, ключевые паттерны, тренды энергии
- Тап → полный дайджест

---

## Порядок реализации

### Почему именно такой порядок

**Фаза 6 (Bot ↔ App) — фундамент.** Без in-app actions остальные фазы бессмысленны. Баланс нельзя улучшить если он по-прежнему уводит в Telegram. Meaning нельзя показать в RoutineFlow если привычки трекаются только через бот.

**Фаза 7 (Smart Awareness) — мозг.** Бот становится умным. Это меняет retention: вместо "заполни форму" → "слушай, у тебя здоровье проседает, может поставим цель?". Notification batching убирает главный раздражитель.

**Фаза 8 (Meaning & Identity) — душа.** Каскад замыкается. Пользователь видит "зачем" каждый день. Identity reinforcement. Дифференциатор продукта.

**Фаза 9 (Living Goals) — рост.** Цели живут, прогресс видим, привычки явно привязаны. Frequency flexibility. Digest сохраняется.

### Зависимости

```
Фаза 6 ← независимая (фундамент)
Фаза 7 ← зависит от 6 (awareness использует in-app actions)
Фаза 8 ← зависит от 6 (meaning в RoutineFlow нужен рабочий in-app flow)
Фаза 9 ← зависит от 7 и 8 (goals прогресс через awareness, habit→goal link)
```

### Summary всех изменений

**Новые API endpoints:**
- `POST /api/energy` — in-app energy checkin
- `POST /api/energy/:logId/triggers` — trigger picker
- `POST /api/balance/rate` — bulk balance rating
- `GET /api/config` — bot username, webapp url
- `GET/PUT /api/settings` — notification prefs, timezone, vacation
- `PATCH /api/goals/:id` — progress update (расширение)
- `GET /api/digests` — weekly digest history

**DB миграции:**
- User: `vacationUntil`, `vacationReason`, `notificationPrefs`
- Goal: `progress`, `metric`, `targetValue`, `currentValue`, `milestones`
- Habit: `goalId`, `targetPerWeek` (frequency и customDays уже есть в schema)
- WeeklyDigest: новая модель (+ добавить `digests WeeklyDigest[]` relation на User)

**Новые компоненты Mini App:**
- EnergyCheckinOverlay — fullscreen, 4 слайдера
- TriggerPicker — preset кнопки + custom + done
- BalanceRateOverlay — 8 сфер × слайдер
- SettingsScreen — notification prefs, vacation, timezone
- DigestCard, DigestDetail — weekly digest в app

**Новые сервисы:**
- `awareness.ts` — gap detection + prioritization
- Интеграция awareness в `buildUserContext()`
- Morning brief в `scheduler.ts` (замена 3 отдельных cron)

**Bug fixes (входят в соответствующие фазы):**
- getBotUsername() → config (фаза 6)
- Time sheet friction → single tap (фаза 6)
- Timezone hardcoding → user.timezone (фаза 7)
- Algorithm usageCount → increment (фаза 8)

**Bot tools (новые/обновлённые):**
- `set_vacation_mode` — глобальная пауза (фаза 7)
- `update_goal_progress` — прогресс цели (фаза 9)
- `create_habit` — добавить goalId, frequency, customDays (фаза 9)
