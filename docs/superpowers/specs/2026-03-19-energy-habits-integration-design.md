# Energy + Habits Integration Design

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Upgraded knowledge base, instant post-checkin recommendations, habit tracker with meaning framework, Mini App frontend
**Supersedes:** v2 spec Phase 3 (Habit Tracker). This spec is the authoritative source for habits. Habits are independent of Balance Wheel (Phase 2) — `areaId` link will be added when Phase 2 ships.

---

## 1. Problem

After energy check-in, the bot gives slow (9s AI call), generic recommendations. No way to convert insights into action. No habit tracking. Users measure energy but can't systematically improve it.

## 2. Solution Overview

Three integrated pieces:

1. **Upgraded Knowledge Base** — concrete micro-actions with metadata (duration, time-of-day, context, science)
2. **Instant Post-Checkin Flow** — zero AI tokens, immediate actionable recommendations from knowledge base
3. **Habit Tracker** — habits born from energy insights, with meaning framework and lifecycle stages

The loop: **Measure energy → See what's low → Get micro-actions → Turn into habits → See habits improve energy → Repeat**

---

## 3. Knowledge Base Overhaul

### 3.1 New MicroAction Structure

Replace current flat `Practice` with rich `MicroAction`:

```typescript
interface MicroAction {
  id: string
  name: string                // "10 отжиманий прямо сейчас"
  description: string         // "Упади и сделай 10. Кровь побежит, эндорфины включатся"
  energyType: EnergyType
  duration: 1 | 2 | 5 | 15 | 30  // minutes (1 = sub-minute actions rounded up)
  timeOfDay: ('morning' | 'afternoon' | 'evening' | 'anytime')[]
  context: ('home' | 'work' | 'outside' | 'anywhere')[]
  intensity: 'micro' | 'regular' | 'deep'
  science: string             // "Кровоток ↑ → эндорфины → BDNF"
  crossTypeBonus?: EnergyType[]
  canBeHabit: boolean
  habitSuggestion?: string    // "После утреннего кофе — 10 отжиманий"
}
```

### 3.2 Content Principles

- **Specific:** not "exercise" but "10 pushups right now"
- **Minimum effective dose first:** 2-min actions before 30-min ones
- **Evidence-based:** each action has a science one-liner (mechanism, not citation)
- **Contextual:** filtered by time of day and location
- **Cross-type bonus highlighted:** walking outside = physical + mental + emotional

### 3.3 Sample Actions (Physical Energy)

| Action | Duration | Time | Context | Science |
|--------|----------|------|---------|---------|
| 10 отжиманий (или от стены) | 2м | anytime | home/work | Кровоток ↑, эндорфины, активация симпатики |
| Выйди на 15 минут на улицу | 15м | anytime | outside | −21% кортизола в час (Frontiers 2019) |
| 3 пролёта лестницы быстро | 2м | morning/afternoon | work | VO2 ↑, 1-2 мин = −48% кардио-риска |
| Стакан холодной воды + 10 глубоких вдохов | 2м | morning | anywhere | Регидратация (−1-2% воды = −когниция) |
| Холодная вода на лицо 15 сек | 30с | afternoon | home/work | Dive reflex: мгновенное спокойствие, вагус |
| Power nap (таймер, лёг) | 15м | 13:00-15:00 | home/work | NASA: +54% alertness, +34% performance |
| Потанцуй под 1 любимую песню | 3м | morning/evening | home | Кардио + дофамин (музыка) + эмоц. подъём |

Similar tables for mental, emotional, spiritual — full 10 actions per type, all evidence-based.

### 3.4 Energy Facts Pool

Science-backed facts shown contextually (not motivational fluff):

**When energy is low:**
- "20 минут на улице снижают кортизол на 21% в час. Движение — не роскошь, а биохимия"
- "Двойной вдох + длинный выдох — самый быстрый способ переключить нервную систему (Stanford)"
- "1-2% обезвоживания уже снижает память и внимание. Стакан воды = перезагрузка"
- "Exercise snacks по 1-2 минуты 3 раза в день снижают кардио-риск на 48%"

**When energy is high:**
- "Люди с привычками-идентичностью удерживают их в 2.7 раза чаще. Ты уже это делаешь"
- "Мозг потребляет 20% энергии тела при весе 2%. Следить за энергией = следить за главным органом"
- "Утренние привычки формируются быстрее и крепче остальных (мета-анализ 2024)"

**Selection logic:** random from relevant pool (low/high), matching the dominant energy type that triggered the message. One fact per message, no repeats within 7 days.

---

## 4. Post-Checkin Flow (Bot)

### 4.1 Instant Response (Zero AI)

After all 4 energies rated:

```
✅ Записал!
🏃 Физическая: 4  🧠 Ментальная: 7  💛 Эмоциональная: 5  ✨ Духовная: 8

⚡ Физическая просела — вот что поможет прямо сейчас:
→ Встань, пройдись 15 минут на улице (−21% кортизола)
→ 10 приседаний у стула (2 мин, кровь побежит)

💛 Эмоциональная ниже нормы:
→ Двойной вдох носом + длинный выдох. 3 раза. 30 сек
→ Напиши близкому что-то настоящее прямо сейчас

🧬 20 минут на улице снижают кортизол на 21% в час.

[📱 Добавить в привычки]
```

### 4.2 Selection Algorithm

1. Find all energies ≤ 6 (threshold for recommendations)
2. If more than 2 types are low, pick the 2 lowest — avoid overwhelming the user
3. Determine current time of day → filter MicroActions by `timeOfDay`
4. Sort: `micro` (2min) first, then `regular` (5-15min)
5. Prioritize actions with `crossTypeBonus` matching other low energies
6. Pick top 2 per selected low energy type (max 4 recommendations total)
7. Append 1 science fact from pool, relevant to dominant low type
8. If all energies ≥ 7: congratulate + identity-reinforcing fact

**Fact dedup:** store last shown fact IDs in memory (Map<telegramId, string[]>). Accept that deploys reset this — minor UX issue, not worth a DB table.

### 4.3 "Add to Habits" Button

InlineKeyboard button with `web_app` URL pointing to Mini App habits screen with query params:
`#habits?suggest=walking-15min,breathing-3x,gratitude-3` — pre-fills suggested habits from the recommendations.

### 4.4 Remove Old AI Recommendations

Delete the current `personalizeRecommendation` AI call from post-checkin flow. All recommendations come from knowledge base. Saves ~9 seconds and AI tokens per check-in.

---

## 5. Habit Tracker

### 5.1 Two Types of Habits

- **Build** 🟢 — habits to establish (exercise, breathing, reading)
- **Break** 🔴 — habits to eliminate (smoking, scrolling, sugar)

### 5.2 Meaning Framework ("Выгодно ли это мне?")

**Required fields when creating a Build habit:**

```
1. Что? → "Двойной вдох + длинный выдох, 3 раза"
2. Когда? → "Утро, после кофе" (routine slot + trigger)
3. Зачем — 4 горизонта:
   → Сегодня?      "Сразу спокойнее, засыпаю за 10 минут"
   → Через месяц?  "Спокойнее в конфликтах, не срываюсь"
   → Через год?    "Дочка видит спокойного отца"
   → Версия себя?  "Осознанный, в ресурсе, сильный"
```

**Required fields when creating a Break habit:**

```
1. Что бросаешь? → "Курение"
2. Выгодно ли это организму? → [user writes honest answer]
   "Нет. Быстрее умру, тяжелее дышу, меньше времени с дочкой,
    плохой пример, воняют вещи"
3. Тогда ЗАЧЕМ ты это делаешь? → [user identifies trigger]
   "Когда стресс — автоматически тянусь"
4. Что ВМЕСТО в момент триггера? → [replacement action]
   "Двойной вдох, 30 секунд"
```

### 5.3 Habit Lifecycle Stages

| Stage | Period | Visual | Bot Behavior |
|-------|--------|--------|-------------|
| 🌱 Посев | Days 1-21 | Seedling, progress bar to 21 | Frequent nudges, shows "зачем", celebrates every day |
| 🌿 Рост | Days 22-60 | Growing plant, bar to 60 | Less frequent, shows progress, "уже X дней!" |
| 🌳 Автопилот | 60+ days | Full tree | Minimal contact, shows energy correlation |
| ✨ Можно сменить | Autopilot + user decides | Glowing tree, "free slot" badge | Suggests new habit for freed slot |

**Slot limits:** max 3 habits in Посев/Рост stages. Автопилот habits don't count toward limit. This is evidence-based: 1-3 simultaneous habits = 2.7x success rate.

**When limit reached:** "Add habit" button shows disabled state with message: "3 привычки растут. Доведи одну до автопилота 🌳 или архивируй, чтобы освободить слот." User can archive a habit from its detail view.

### 5.4 Dopamine Fade Protection

When bot detects 2 consecutive missed days for a habit:

**For Build habits:**
```
Ты 2 дня без дыхательной практики.

Ты говорил: "Сразу спокойнее, засыпаю за 10 минут"
Через год: "Дочка видит спокойного отца"

Одна минута. Прямо сейчас?
[✅ Сделал] [⏭ Не сегодня]
```

**For Break habits (if user logs a slip or bot asks):**
```
Тянет закурить?

Ты сам написал: "Быстрее умру, меньше времени с дочкой"
Триггер: стресс
Замена: двойной вдох, 30 секунд

[✅ Не сделал] [🔄 Сделал замену]
```

No guilt, no pressure — just a mirror of the user's own words.

### 5.5 Forgiveness-First Streaks

- Streak shows consecutive days, but **consistency %** is the primary metric (30-day rolling)
- 1 free freeze per week (auto-used on miss, preserves streak)
- Best streak always visible alongside current
- On streak break: "Перерыв — это нормально. 87% за месяц — отличный результат. Новая серия?"
- 85%+ monthly consistency = streak badge preserved

### 5.6 Routine Containers

Habits grouped by time of day:
- ☀️ **Утро** — morning routine (suggested: after waking)
- 🌤 **День** — afternoon actions (suggested: after lunch)
- 🌙 **Вечер** — evening wind-down (suggested: before bed)

Within each container, habits are ordered and completed in sequence (habit stacking). Morning routine can end with energy check-in.

---

## 6. Database Schema

### 6.1 New Models

```prisma
model Habit {
  id              Int        @id @default(autoincrement())
  userId          Int
  user            User       @relation(fields: [userId], references: [id])

  // Core
  name            String     // "Двойной вдох 3 раза"
  icon            String     // emoji
  type            String     // "build" | "break"
  routineSlot     String     // "morning" | "afternoon" | "evening"
  sortOrder       Int        @default(0)
  energyType      String?    // "physical" | "mental" | "emotional" | "spiritual" — for correlation
  frequency       String     @default("daily")  // "daily" | "weekly" | "custom"
  customDays      String?    // JSON: [1,3,5] for Mon/Wed/Fri (when frequency=custom)

  // Trigger (implementation intention)
  triggerAction   String?    // "После утреннего кофе"
  duration        Int?       // minutes

  // Meaning framework - Build habits
  whyToday        String?    // "Сразу спокойнее"
  whyMonth        String?    // "Спокойнее в конфликтах"
  whyYear         String?    // "Дочка видит спокойного отца"
  whyIdentity     String?    // "Осознанный, в ресурсе"

  // Meaning framework - Break habits
  isItBeneficial  String?    // "Нет. Быстрее умру..."
  breakTrigger    String?    // "Когда стресс"
  replacement     String?    // "Двойной вдох, 30 секунд"

  // Lifecycle
  stage           String     @default("seed")  // "seed" | "growth" | "autopilot"
  stageUpdatedAt  DateTime   @default(now())

  // Streaks & Consistency
  streakCurrent   Int        @default(0)
  streakBest      Int        @default(0)
  consistency30d  Float      @default(0)  // 30-day rolling completion %, denormalized
  freezesUsedThisWeek Int    @default(0)  // reset by weekly cron (Monday 00:00)

  // Source (link to micro-action that spawned this habit)
  microActionId   String?    // references MicroAction.id from knowledge base

  isActive        Boolean    @default(true)
  logs            HabitLog[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model HabitLog {
  id          Int      @id @default(autoincrement())
  habitId     Int
  habit       Habit    @relation(fields: [habitId], references: [id])
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  date        DateTime @db.Date
  completedAt DateTime @default(now())
  status      String   @default("completed")  // "completed" | "resisted" | "replacement" | "slipped"
  note        String?

  @@unique([habitId, date])
}
```

### 6.2 Consistency Calculation

30-day rolling `consistency30d` (denormalized on Habit model):
```
consistency30d = (completedDays / expectedDays) * 100
```
Where `expectedDays` accounts for habit frequency, custom days, and freeze days used.

Recalculated: on every HabitLog creation + daily cron at midnight. Stored on Habit model for fast API reads.

### 6.3 Cron Jobs

**Daily cron (midnight):**
- Recalculate `consistency30d` for all active habits
- Stage transitions:
  - Seed → Growth: `daysSinceCreation >= 21 AND consistency30d >= 70%`
  - Growth → Autopilot: `daysSinceCreation >= 60 AND consistency30d >= 80%`
  - Stage regression: if `consistency30d` drops below 50% for 7 consecutive days, stage moves back one level
- Auto-freeze: if habit was missed yesterday AND `freezesUsedThisWeek < 1`, auto-use freeze (preserve streak, increment `freezesUsedThisWeek`)

**Weekly cron (Monday 00:00):**
- Reset `freezesUsedThisWeek` to 0 for all active habits

Both crons extend existing `src/services/scheduler.ts`.

---

## 7. API Endpoints

```
// Habits
GET    /api/habits              → user's active habits (grouped by routineSlot)
POST   /api/habits              → create habit (with meaning framework fields)
PATCH  /api/habits/:id          → update habit
DELETE /api/habits/:id          → soft delete (isActive=false)
POST   /api/habits/:id/complete → log completion for today
DELETE /api/habits/:id/complete → undo today's completion
GET    /api/habits/:id/stats    → streak, consistency, heatmap, energy correlation
GET    /api/habits/today        → today's habits with completion status
GET    /api/habits/heatmap      → monthly heatmap data for all habits
```

All endpoints behind existing Telegram initData auth middleware.

---

## 8. Mini App Frontend

### 8.1 Navigation Change

**Before:** Hub | Energy | Timeline | Journal (4 tabs)
**After:** Hub | Energy | Habits | Journal (4 tabs)

Timeline (chart) moves inside Energy screen as a collapsible section below rings/observations/analytics. Energy screen order: Greeting → EnergyRings → "Динамика" toggle (collapsed by default, shows Chart.js graph) → Observations → Analytics → Checkin button.

`#timeline` hash route redirects to `#energy` for backwards compatibility (bot deep links, bookmarks).

Journal becomes unified log: energy check-ins + habit completions + observations, all in chronological order.

### 8.2 New Components

```
components/
  habits/
    HabitsScreen.tsx      → Main habits screen
    HabitCard.tsx          → Single habit (tap to complete)
    RoutineGroup.tsx       → Morning/Afternoon/Evening container
    DayProgress.tsx        → Top progress bar + streak
    WeekHeatmap.tsx        → Mini weekly heatmap
    HabitDetail.tsx        → Full detail view (why, stats, stage)
    HabitCreate.tsx        → Creation flow with meaning framework
    StageIndicator.tsx     → 🌱→🌿→🌳 visual
    CorrelationCard.tsx    → Habit-energy correlation insight
    MilestoneToast.tsx     → Day 7/21/60 celebrations
```

### 8.3 Habits Screen Layout

```
┌─────────────────────────────────┐
│  Сегодня              Ср, 19 мар│
│  ████████░░  3/5               │  ← animated progress bar
│  🔥 12 дней   📊 87%          │  ← streak + consistency
├─────────────────────────────────┤
│  Пн Вт Ср Чт Пт Сб Вс        │  ← week heatmap
│  🟢 🟢 🟡 ⬜ ⬜ ⬜ ⬜        │
├─────────────────────────────────┤
│  ☀️ Утро                       │
│  ┌───────────────────────────┐ │
│  │ ○ Двойной вдох 3р    30с │ │  ← tap = fill + haptic
│  │ ● Стакан воды        1м  │ │  ← done, green
│  │ ○ 10 отжиманий       2м  │ │
│  └───────────────────────────┘ │
│                                │
│  🌤 День                       │
│  ┌───────────────────────────┐ │
│  │ ○ Прогулка без тел.  15м │ │
│  └───────────────────────────┘ │
│                                │
│  🌙 Вечер                      │
│  ┌───────────────────────────┐ │
│  │ ○ 3 благодарности    5м  │ │
│  │ ○ Без экранов 30м    30м │ │
│  └───────────────────────────┘ │
│                                │
│  [+ Добавить привычку]         │
├─────────────────────────────────┤
│  💡 Когда ты делаешь дыхание   │
│     Эмоциональная: 7.2 vs 5.1  │
│     +2.1 🔼                    │  ← correlation card (after 2w)
└─────────────────────────────────┘
```

### 8.4 Habit Detail View (tap on habit name/long press)

```
┌─────────────────────────────────┐
│  ← Двойной вдох 3 раза         │
│                                │
│  🌿 Рост — день 34/60          │
│  ██████░░░░                    │
│                                │
│  🔥 12 дней (лучший: 18)       │
│  📊 87% за месяц               │
│  ❄️ 1 freeze осталось          │
│                                │
│  ── Зачем ──                   │
│  Сегодня: Сразу спокойнее      │
│  Месяц: Не срываюсь            │
│  Год: Дочка видит спокойного   │
│       отца                     │
│  Я: Осознанный, в ресурсе      │
│  [✏️ Обновить]                  │
│                                │
│  ── Месяц ──                   │
│  🟢🟢🟡🟢🟢🟢🟢              │
│  🟢🟢🟢⬜🟢🟢🟡              │
│  🟢🟢🟢🟢⬜⬜⬜              │  ← monthly heatmap
│  🟢🟢...                      │
│                                │
│  ── Влияние на энергию ──      │
│  Эмоциональная: +2.1           │
│  Ментальная: +1.3              │
└─────────────────────────────────┘
```

### 8.5 Habit Creation Flow

Multi-step, mandatory fields:

**Step 1 — What:** name, icon, duration, routine slot (morning/afternoon/evening), trigger ("после чего?")

**Step 2 — Type:** Build 🟢 or Break 🔴

**Step 3a — Build meaning:**
- Выгодно сегодня? → text input
- Через месяц? → text input
- Через год? → text input
- Версия себя? → text input

**Step 3b — Break meaning:**
- Выгодно ли это организму? → text input
- ЗАЧЕМ ты это делаешь? (триггер) → text input
- Что ВМЕСТО? → text input (can link to a MicroAction)

**Step 4 — Confirm:** summary card, "Начать 🌱"

When coming from bot recommendations (`#habits?suggest=...`), Step 1 is pre-filled with the MicroAction data. User just adds meaning.

### 8.6 Animations & Interactions

- **One-tap complete:** tap habit → ring fills clockwise (300ms), haptic medium, check appears
- **Progress bar:** smooth fill animation on each completion
- **All done:** confetti burst (CSS particles) + science fact toast
- **Stage transition:** special animation when 🌱→🌿 or 🌿→🌳 (plant growing)
- **Milestone toast:** slides up from bottom on day 7/21/60 with celebratory message
- **Streak freeze:** ❄️ icon pulse when auto-freeze saves streak

### 8.7 Hub Integration

New card on Hub screen:

```
┌─────────────────────────────────┐
│  Привычки                 3/5  │
│  ████████░░                    │
│  ☀️ ●●○  🌤 ○  🌙 ○○         │  ← dots per routine
│  🔥 12 дней   📊 87%          │
└─────────────────────────────────┘
```

Tap → navigates to #habits.

---

## 9. Bot Changes

### 9.1 Post-Checkin (modified `handleCheckinCallback`)

Replace current AI recommendation flow with:
1. Save energy log (existing)
2. Call `getInstantRecommendations(energyValues, timeOfDay)` — pure function, no async, no AI
3. Format recommendations with micro-actions + science fact
4. Add "📱 Добавить в привычки" web_app button
5. Remove `analyzeEnergyHistory` + `getRecommendations` + `personalizeRecommendation` calls

### 9.2 Habit Nudges (new)

**Phase B (fixed timing):**
- **Morning routine:** send at configured time (default 8:00)
- **Evening routine:** send at configured time (default 21:00)
- **Missed 2 days:** send "meaning mirror" message (user's own words)
- **Max 3 habit messages per day** — never spam

**Phase D (smart timing):**
- Send routine reminders 5 min before user's median completion time (learned from HabitLog.completedAt)
- Break habit check-ins at detected trigger times

### 9.3 Milestone Messages

Bot sends celebration on day 7, 21, 60:
```
🌿 Дыхательная практика — 21 день!
Привычка переходит в стадию Рост.
Ты говорил: "Дочка видит спокойного отца"
Она уже это видит. Продолжай.
```

### 9.4 Habit Completion via Bot

Quick buttons in routine reminders:
```
☀️ Утренние привычки:
[✅ Дыхание] [✅ Вода] [✅ Отжимания]
```
One tap = logged. Same as Mini App but faster for quick completion.

---

## 10. Implementation Phases

### Phase A: Knowledge Base + Post-Checkin (backend only)
- New MicroAction data structure and content (40 actions: 10 per energy type)
- Energy facts pool (20 facts)
- `getInstantRecommendations()` function
- Replace AI recommendations in checkin handler
- Tests

### Phase B: Habit Tracker Backend
- Prisma schema + migration
- Habit CRUD API endpoints
- Completion logging + streak/consistency calculation
- Stage transition cron
- Habit nudge bot handlers

### Phase C: Mini App Frontend
- Navigation restructure (Timeline → inside Energy)
- Habits screen (routine groups, one-tap completion, progress bar)
- Habit creation flow with meaning framework
- Habit detail view (stage, heatmap, why, correlation)
- Hub card for habits
- Journal integration (unified log)
- Animations (ring fill, confetti, stage transitions)

### Phase D: Intelligence Layer
- Habit-energy correlation calculation (after 2 weeks of data)
- Correlation cards in habit detail
- Smart reminder timing (median completion time)
- Stage-aware nudge frequency

---

## 11. Tech Decisions

- **No AI tokens for recommendations** — all from knowledge base, instant
- **Preact + Signals** — consistent with existing Mini App stack
- **CSS animations** — no heavy animation libraries, keep bundle small
- **Telegram HapticFeedback** — for one-tap completion satisfaction
- **web_app buttons** — bot → Mini App deep linking with query params
- **Daily cron** — streak recalculation, stage transitions, freeze resets (extend existing scheduler)
