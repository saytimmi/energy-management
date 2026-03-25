# Energy Management App v2 — Full System Design

> **For agentic workers:** This is the spec document. Use `superpowers:writing-plans` to create the implementation plan from this spec.

**Goal:** Transform the energy tracking Telegram bot into a comprehensive life management system with balance wheel, habit tracker, smart task manager, and AI coaching — implemented in phases.

---

## 1. Product Vision

A Telegram bot + Mini App that acts as a personal AI life coach. Four interconnected layers:

1. **Monitoring** — energy (daily) + life balance wheel (bi-weekly)
2. **Strategy** — wheel shows where life is out of balance
3. **Tactics** — habits and tasks = concrete daily actions
4. **AI Coach** — connects everything, adapts, learns the user

**Unique differentiator:** No competitor connects daily energy levels + life balance + habits + tasks + AI coaching in one system. Most balance wheel apps are assessment-only. Most habit trackers are dumb checklists.

---

## 2. Architecture Overview

### 2.1 Bot vs Mini App Split

**Bot (chat) — quick actions + push:**
- Morning/evening energy check-ins (existing)
- Micro balance check-ins (2 rotating areas/day, 10 sec)
- Habit completion via buttons (one tap = done)
- Push reminders for overdue tasks, missed habits, check-in time
- AI coach dialogues
- Quick add: natural language → AI parses → task created
- Achievement notifications
- Weekly surprise insights
- Monthly AI letter

**Mini App — visual + management:**
- Hub dashboard with widget cards
- Life balance wheel visualization + history
- Habit tracker: create, configure, stats, streaks
- Calendar: week/month view, tasks on timeline
- Task manager: create, prioritize, deadlines
- Analytics: trends, correlations, AI insights
- Achievements gallery + profile with level/XP
- Settings: areas, notification preferences

### 2.2 Navigation Pattern: Hub-and-Spoke

Main screen = hub with widget cards showing key metrics at a glance:
- Energy card (4 types, latest values)
- Balance wheel mini-preview (radar/spider chart)
- Today's habits (X/Y completed)
- Today's tasks (X pending, next deadline)
- Streak + Level + XP progress bar

Tap any card → deep dive into that section. Back button → hub. Max 2 navigation levels.

### 2.3 Frontend Architecture

**Migration from vanilla JS to Preact + Vite:**
- Preact (3KB) for component architecture
- Vite for build tooling, HMR in dev
- CSS Modules or vanilla CSS (keep it light)
- Chart.js (already used) for graphs
- Telegram Mini App SDK for theme sync, haptic feedback, back button

**Build pipeline:**
- `vite build` compiles Mini App → outputs to `dist/client/`
- Express serves `dist/client/` as static files (replaces current `public/` serving)
- `npm run dev` uses `concurrently` to run Vite dev server + `tsx watch` for backend
- Production build: `prisma generate && tsc && vite build`
- Vite config: `base: './'` for relative paths in Telegram WebView

**Project structure:**
```
public/           → static assets only (favicon, etc.)
src/
  mini-app/
    main.tsx                  → entry point
    app.tsx                   → root component, router
    router.ts                 → simple hash-based router
    store/
      index.ts                → central state management
      energy.ts               → energy state
      balance.ts              → balance wheel state
      habits.ts               → habits state
      tasks.ts                → tasks state
      achievements.ts         → achievements + XP state
      user.ts                 → user profile + level
    components/
      hub/
        Hub.tsx               → main dashboard
        EnergyCard.tsx        → energy widget
        BalanceCard.tsx       → balance wheel mini
        HabitsCard.tsx        → today's habits
        TasksCard.tsx         → today's tasks
        ProgressBar.tsx       → level + XP
      balance/
        BalanceWheel.tsx      → full wheel view (SVG/Canvas)
        AreaRating.tsx        → rate a single area
        BalanceHistory.tsx    → compare wheels over time
        AreaDetail.tsx        → single area deep dive
      habits/
        HabitList.tsx         → habits for today
        HabitCreate.tsx       → create/edit habit
        HabitStats.tsx        → streak, completion rate
        HabitItem.tsx         → single habit row
      tasks/
        TaskList.tsx          → today's tasks
        TaskCreate.tsx        → create/edit task
        TaskCalendar.tsx      → calendar view
        TaskItem.tsx          → single task row
      achievements/
        AchievementGallery.tsx → all achievements
        AchievementCard.tsx    → single achievement
        LevelProgress.tsx      → level details
      shared/
        Card.tsx              → reusable card component
        Rating.tsx            → 1-10 slider/buttons
        Modal.tsx             → bottom sheet modal
        Toast.tsx             → XP popup, notifications
        EmptyState.tsx        → no-data placeholder
        Haptic.ts             → Telegram haptic wrapper
        Theme.ts              → Telegram theme integration
    api/
      client.ts               → API client (fetch wrapper)
      types.ts                → shared TypeScript types
    styles/
      variables.css           → design tokens
      global.css              → base styles
```

### 2.4 Authentication

All Mini App API requests include Telegram `initData` for authentication:

1. Mini App sends `Telegram.WebApp.initData` as `Authorization: tma <initData>` header
2. Server middleware validates `initData` using bot token (HMAC-SHA256)
3. Extracts `telegramId` from validated data
4. Resolves `userId` (Int) via existing `db.getOrCreateUser(telegramId)`
5. Attaches `userId` to request object for handlers

Existing endpoints that use `?telegramId=` query param will be migrated to this auth pattern during Phase 1.

---

## 3. Data Architecture

### 3.1 Existing Schema (preserved as-is)

All existing models (`User`, `EnergyLog`, `Message`, `Session`, `Observation`, `ErrorLog`, `Metric`) remain unchanged. All existing data is preserved. New models follow the same conventions: `Int` IDs with autoincrement, `Int` foreign keys.

### 3.2 Updated User Model (new relation fields)

```prisma
model User {
  id           Int            @id @default(autoincrement())
  telegramId   BigInt         @unique
  firstName    String
  lastName     String?
  username     String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  // existing relations
  energyLogs   EnergyLog[]
  messages     Message[]
  sessions     Session[]
  observations Observation[]
  // new relations (added incrementally per phase)
  lifeAreas       LifeArea[]
  lifeAreaScores  LifeAreaScore[]
  habits          Habit[]
  habitLogs       HabitLog[]
  tasks           Task[]
  recommendations Recommendation[]
  userInsights    UserInsight[]
  userAchievements UserAchievement[]
  userStats       UserStats?
  digests         Digest[]
}
```

### 3.3 New Prisma Models

```prisma
// === LIFE BALANCE (Phase 2) ===

model LifeArea {
  id              Int      @id @default(autoincrement())
  userId          Int
  user            User     @relation(fields: [userId], references: [id])
  name            String              // "Здоровье и тело"
  icon            String              // emoji
  color           String              // hex color
  isDefault       Boolean  @default(true)
  isCustom        Boolean  @default(false)
  sortOrder       Int
  scores          LifeAreaScore[]
  habits          Habit[]
  tasks           Task[]
  recommendations Recommendation[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model LifeAreaScore {
  id        Int      @id @default(autoincrement())
  areaId    Int
  area      LifeArea @relation(fields: [areaId], references: [id])
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  score     Int                  // 1-10
  type      String               // "micro" | "full"
  createdAt DateTime @default(now())
}

// === HABITS (Phase 3) ===

model Habit {
  id            Int        @id @default(autoincrement())
  userId        Int
  user          User       @relation(fields: [userId], references: [id])
  areaId        Int?
  area          LifeArea?  @relation(fields: [areaId], references: [id])
  name          String
  icon          String               // emoji
  frequency     String               // "daily" | "weekly" | "custom"
  targetCount   Int        @default(1)
  customDays    String?              // JSON: [1,3,5] for Mon/Wed/Fri
  streakCurrent Int        @default(0)
  streakBest    Int        @default(0)
  isActive      Boolean    @default(true)
  sortOrder     Int        @default(0)
  logs          HabitLog[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}

model HabitLog {
  id          Int      @id @default(autoincrement())
  habitId     Int
  habit       Habit    @relation(fields: [habitId], references: [id])
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  date        DateTime @db.Date          // date only, for deduplication
  completedAt DateTime @default(now())
  note        String?

  @@unique([habitId, date])             // prevent double-logging per day
}

// === TASKS (Phase 4) ===

model Task {
  id                 Int       @id @default(autoincrement())
  userId             Int
  user               User      @relation(fields: [userId], references: [id])
  areaId             Int?
  area               LifeArea? @relation(fields: [areaId], references: [id])
  title              String
  description        String?
  priority           String    @default("p4")    // p1/p2/p3/p4
  deadline           DateTime?
  scheduledDate      DateTime? @db.Date
  scheduledTime      String?                     // "09:00"
  estimatedMinutes   Int?
  status             String    @default("pending") // pending/done/skipped/moved
  effectivenessScore Int?                         // 1-5, user rates after completion
  aiSuggested        Boolean   @default(false)
  recurring          String?                      // "daily" | "weekly" | "weekdays" | null
  parentTaskId       Int?
  parentTask         Task?     @relation("Subtasks", fields: [parentTaskId], references: [id])
  subtasks           Task[]    @relation("Subtasks")
  completedAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

// === AI INTELLIGENCE (Phase 6) ===

model Recommendation {
  id           Int       @id @default(autoincrement())
  userId       Int
  user         User      @relation(fields: [userId], references: [id])
  type         String                // "habit" | "task" | "practice" | "insight"
  content      String
  reason       String?
  areaId       Int?
  area         LifeArea? @relation(fields: [areaId], references: [id])
  source       String    @default("ai") // "ai" | "system"
  status       String    @default("suggested") // suggested/accepted/rejected/completed
  outcomeScore Int?                 // 1-5, user feedback
  createdAt    DateTime  @default(now())
  resolvedAt   DateTime?
}

model UserInsight {
  id              Int      @id @default(autoincrement())
  userId          Int
  user            User     @relation(fields: [userId], references: [id])
  category        String               // pattern/preference/trigger/strength/weakness
  content         String               // "жаворонок, пик 9-12"
  confidence      Float    @default(0.5) // 0-1
  source          String               // "ai_detected" | "user_stated"
  lastConfirmedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// === ACHIEVEMENTS & GAMIFICATION (Phase 5) ===

model Achievement {
  id          Int                @id @default(autoincrement())
  code        String             @unique  // "streak_7", "first_checkin"
  name        String
  description String
  icon        String                      // emoji
  category    String                      // streak/milestone/mastery/insight/surprise
  tier        String    @default("bronze") // bronze/silver/gold/platinum
  condition   String                      // JSON, see condition schema below
  isHidden    Boolean   @default(false)   // surprise achievements
  users       UserAchievement[]
}

model UserAchievement {
  id            Int         @id @default(autoincrement())
  userId        Int
  user          User        @relation(fields: [userId], references: [id])
  achievementId Int
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  progress      Int         @default(0)  // 0-100
  unlockedAt    DateTime?
  notified      Boolean     @default(false)
  createdAt     DateTime    @default(now())

  @@unique([userId, achievementId])
}

model UserStats {
  id                   Int      @id @default(autoincrement())
  userId               Int      @unique
  user                 User     @relation(fields: [userId], references: [id])
  level                Int      @default(1)
  xp                   Int      @default(0)
  totalCheckIns        Int      @default(0)
  totalTasksDone       Int      @default(0)
  totalHabitsLogged    Int      @default(0)
  longestStreak        Int      @default(0)
  currentOverallStreak Int      @default(0)
  avgEffectiveness     Float?
  stage                String   @default("newcomer") // newcomer/building/established/advanced
  freezeDaysUsed       Int      @default(0)
  freezeDaysResetAt    DateTime?
  updatedAt            DateTime @updatedAt
}

// === WEEKLY/MONTHLY DIGESTS (Phase 6) ===

model Digest {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  type      String               // "weekly_surprise" | "monthly_letter"
  content   String               // AI-generated text
  period    String               // "2026-W12" or "2026-03"
  createdAt DateTime @default(now())
}
```

### 3.4 Achievement Condition Schema

Achievement conditions are JSON objects evaluated by the achievement engine. Format:

```typescript
type AchievementCondition =
  | { type: "streak"; metric: "checkin" | "habit" | "task" | "overall"; days: number }
  | { type: "milestone"; metric: "totalCheckIns" | "totalTasksDone" | "totalHabitsLogged"; count: number }
  | { type: "mastery"; metric: "avgEffectiveness"; threshold: number; periodDays: number }
  | { type: "balance"; metric: "allAreasAbove"; threshold: number }
  | { type: "custom"; evaluator: string }  // for surprise/edge-case achievements

// Examples:
{ "type": "streak", "metric": "checkin", "days": 7 }           // 7-day check-in streak
{ "type": "milestone", "metric": "totalTasksDone", "count": 50 } // 50 tasks completed
{ "type": "mastery", "metric": "avgEffectiveness", "threshold": 4.0, "periodDays": 7 } // avg effectiveness > 4.0 for a week
{ "type": "balance", "metric": "allAreasAbove", "threshold": 7 }  // all 8 areas scored 7+
{ "type": "custom", "evaluator": "earlyBird" }                  // checked in before 6 AM
```

### 3.5 Streak Recalculation

`Habit.streakCurrent` and `Habit.streakBest` are denormalized for performance. They are recalculated:
- On every `HabitLog` creation
- Via a daily cron job (midnight) that recalculates all active habits
- Freeze day logic: if `UserStats.freezeDaysUsed < 1` this week and habit was missed yesterday, auto-freeze instead of breaking streak

### 3.6 Default Life Areas (8 + customizable)

| # | Area | Icon | Color |
|---|------|------|-------|
| 1 | Здоровье и тело | 💪 | #4CAF50 |
| 2 | Карьера / Бизнес | 💼 | #2196F3 |
| 3 | Финансы | 💰 | #FF9800 |
| 4 | Отношения / Семья | ❤️ | #E91E63 |
| 5 | Друзья / Окружение | 👥 | #9C27B0 |
| 6 | Личностный рост | 📚 | #00BCD4 |
| 7 | Отдых / Развлечения | 🎯 | #FFEB3B |
| 8 | Духовность / Смысл | 🧘 | #795548 |

User can rename or replace up to 3 areas. Custom areas have `isCustom: true`.

---

## 4. Feature Details

### 4.1 Life Balance Wheel

**Assessment frequency:**
- **Daily micro-checkin** — 2 rotating areas via bot buttons, 10 seconds
- **Full assessment every 2 weeks** — all 8 areas, bot sends reminder

**Wheel visualization (Mini App):**
- SVG radar/spider chart with 8 axes
- Current scores as filled polygon
- Option to overlay previous period for comparison
- Tap an axis → area detail (score history, linked habits, linked tasks)

**Bot flow for micro-checkin:**
```
Bot: "Быстрая проверка! Как дела с 💪 Здоровье? (1-10)"
User: [taps 7]
Bot: "А 💼 Карьера? (1-10)"
User: [taps 5]
Bot: "Записал! Карьера чуть ниже — хочешь поставить задачу на улучшение?"
```

**Bot flow for full assessment:**
```
Bot: "Время для полной оценки баланса жизни! Оцени каждую сферу 1-10."
[Shows all 8 areas sequentially with inline keyboard 1-10]
[After completion: shows wheel visualization image + comparison with last time]
[AI generates insight about changes]
```

### 4.2 Habit Tracker

**Core mechanics:**
- Create habits tied to life areas
- Daily/weekly/custom frequency
- One-tap completion via bot buttons OR Mini App
- Streaks with resilient design (freeze days, percentage-based)

**Bot morning ritual (enhanced):**
```
Bot: "Доброе утро! Оцени энергию:"
[4 energy ratings as before]
Bot: "Привычки на сегодня:"
[✅ Зарядка] [✅ Медитация] [✅ Чтение]
[User taps each one to complete — haptic feedback + XP toast]
```

**Streak system (resilient):**
- 1 free freeze day per week (auto-used if missed)
- 85%+ completion rate = streak preserved
- Streak recovery: double check-in next day
- Focus on trends: "На 30% лучше чем месяц назад"
- Never punish: "Перерыв — это нормально. Новая серия?"

**Stats in Mini App:**
- Completion rate chart (weekly/monthly)
- Current streak + best streak
- Heatmap (GitHub-style) for each habit
- Correlation: habit completion vs energy levels

### 4.3 Smart Task Manager

**Task properties:**
- Title, description
- Linked life area (optional)
- Priority: p1-p4 (AI can auto-suggest)
- Deadline + scheduled date/time
- Estimated duration
- Recurring option
- Subtasks
- Effectiveness score (post-completion, 1-5)

**AI-powered planning:**
- Morning: bot suggests optimal task order based on current energy
- "Ментальная энергия 8 → сложные задачи утром"
- "Физическая энергия 4 → перенесу тренировку, предложу прогулку"
- AI learns which task types user completes vs postpones

**Quick add via bot:**
```
User: "завтра встреча с клиентом в 14:00"
AI parses → Task { title: "Встреча с клиентом", scheduledDate: tomorrow, scheduledTime: "14:00", area: "Карьера" }
Bot: "Создал задачу: Встреча с клиентом, завтра 14:00, 💼 Карьера. Верно?"
```

**Effectiveness tracking:**
```
[After task completion]
Bot: "Задача выполнена! Насколько она приблизила к цели? (1-5)"
User: [taps 4]
[System saves, AI learns patterns]
```

**AI patterns over time:**
- "Задачи типа 'встречи' ты оцениваешь на 4.2, 'документация' — на 2.1. Может разбить документацию на мелкие шаги?"
- "По вторникам ты выполняешь 90% задач, по пятницам — 50%. Планирую меньше на пятницу."

**Push reminders (bot):**
- Overdue tasks: "У тебя просрочена задача: [title]. Выполнить / Перенести / Удалить?"
- Approaching deadline: "Дедлайн через 2 часа: [title]"
- End of day: "Сегодня не выполнено 3 задачи. Перенести на завтра?"

### 4.4 Calendar View (Mini App)

- Week view (default): days as columns, tasks + habits as blocks
- Month view: days as cells, dot indicators for tasks/habits
- Tap day → list of tasks + habits for that day
- Tap-based reschedule: tap task → modal with date picker (no drag — unreliable in Telegram WebView due to scroll conflicts)
- Color-coded by life area

### 4.5 Achievement System

**XP rewards:**
| Action | XP |
|--------|----|
| Energy check-in | 10 |
| Micro balance check-in | 5 |
| Full balance assessment | 50 |
| Habit completion | 15 |
| Task completion | 20 |
| Task with effectiveness 5 | +10 bonus |
| AI recommendation followed | 25 |
| Daily streak maintained | 5 |

**Variable rewards:**
- Random 2x-3x XP multiplier (unpredictable)
- Surprise achievements (hidden until unlocked)
- Weekly AI insight as unexpected reward
- Monthly personalized letter from AI

**Levels:** Each level = 100 x level XP (level 1 = 100, level 5 = 500, etc.)

**Achievement categories:**
- **Streak:** 3/7/14/30/60/100 day streaks
- **Milestone:** first check-in, 50 tasks, 100 habits, all areas > 7
- **Mastery:** effectiveness > 4.0 for a week, area +4 points in a month
- **Insight:** first AI insight, followed AI recommendation with good result
- **Surprise:** hidden achievements (e.g., "checked in at 5 AM", "perfect week")

**Progressive onboarding (feature unlocking):**
| Stage | Days | Available Features |
|-------|------|--------------------|
| newcomer | 1-7 | Energy check-ins + 1 habit |
| building | 8-21 | + Balance wheel + 3 habits |
| established | 22-60 | + Tasks + full wheel + calendar |
| advanced | 60+ | + Analytics + AI experiments |

**Note:** Phases 2-4 build all features as fully accessible. Phase 5 retroactively adds the gating layer based on `UserStats.stage`. Until Phase 5, all features are available to all users.

### 4.6 AI Intelligence Layer

**User Knowledge Graph (UserInsight):**
AI updates after every conversation:
- Patterns: "жаворонок", "спад энергии после обеда"
- Preferences: "не любит спорт утром", "предпочитает чтение перед сном"
- Triggers: "конфликты → эмоциональный спад", "дедлайны → ментальная перегрузка"
- Strengths: "высокая дисциплина в привычках", "быстро восстанавливает физическую энергию"

**Context engine (fed to AI before every response):**
- Current energy levels
- Time of day + day of week
- UserInsights (top patterns by confidence)
- Today's pending tasks + habits
- Recent balance scores (lowest areas)
- Recommendation history (what worked/didn't)

**Closed-loop recommendations:**
1. AI suggests action → saved as Recommendation
2. User accepts/rejects
3. If accepted + completed → user rates outcome (1-5)
4. AI learns: this type of recommendation works/doesn't for this user
5. Future recommendations weighted by historical success

**Weekly surprise digest:**
AI finds unexpected correlation in user data and sends it as a discovery:
"Заметил: когда ты спишь >7ч, ментальная энергия на следующий день выше на 40%. За последние 2 недели это подтвердилось 5 из 6 раз."

**Monthly letter:**
AI writes personalized reflection:
- What changed this month (energy trends, balance shifts)
- Which habits stuck, which didn't
- Patterns broken or formed
- Gentle suggestion for next month's focus

### 4.7 Identity Shift (External → Internal Motivation)

As user progresses through stages:
- **newcomer/building:** Heavy gamification (XP, streaks, achievements)
- **established:** Mix of gamification + reflective questions from AI
- **advanced:** Less XP notifications, more deep insights, reflective prompts, identity-based messaging ("Ты человек, который заботится о своей энергии")

---

## 5. API Endpoints (New)

All endpoints require Telegram `initData` authentication (see section 2.4).

```
// Balance (Phase 2)
GET    /api/balance/areas         → user's life areas
POST   /api/balance/areas         → create/update custom area
DELETE /api/balance/areas/:id     → delete custom area
GET    /api/balance/scores        → score history
POST   /api/balance/scores        → submit score(s)
GET    /api/balance/wheel         → latest wheel data for visualization

// Habits (Phase 3)
GET    /api/habits                → user's habits
POST   /api/habits                → create habit
PATCH  /api/habits/:id            → update habit
DELETE /api/habits/:id            → delete habit
POST   /api/habits/:id/log        → log completion
GET    /api/habits/:id/stats      → habit statistics

// Tasks (Phase 4)
GET    /api/tasks                 → tasks (filterable by date, status, area)
POST   /api/tasks                 → create task
PATCH  /api/tasks/:id             → update task
DELETE /api/tasks/:id             → delete task
POST   /api/tasks/:id/complete    → complete + rate effectiveness
GET    /api/tasks/today           → AI-ordered tasks for today
POST   /api/tasks/quick-add       → natural language → parsed task

// Achievements (Phase 5)
GET    /api/achievements          → all achievements + user progress
GET    /api/stats                 → user stats (level, XP, streaks)

// AI (Phase 6)
GET    /api/insights              → user's knowledge graph
GET    /api/recommendations       → active recommendations
POST   /api/recommendations/:id   → accept/reject/rate recommendation
GET    /api/digest/weekly          → latest weekly digest
GET    /api/digest/monthly         → latest monthly letter
```

---

## 6. Implementation Phases

### Phase 1: Frontend Foundation
- Migrate Mini App from vanilla JS to Preact + Vite
- Set up build pipeline (Vite + tsc, concurrently for dev)
- Implement Telegram initData authentication middleware
- Implement hub dashboard with card components
- Port existing energy dashboard/timeline to new architecture
- Telegram theme sync + haptic feedback integration

### Phase 2: Life Balance Wheel
- Database models (LifeArea, LifeAreaScore) + migration
- API endpoints for balance (with auth middleware)
- Bot handlers for micro and full assessments
- SVG wheel visualization in Mini App
- History comparison view
- Default area seeding on first user access

### Phase 3: Habit Tracker
- Database models (Habit, HabitLog) + migration
- API endpoints for habits (with auth middleware)
- Bot handlers for habit check-off (inline buttons in morning ritual)
- Mini App habit list, create, stats views
- Streak system with resilient design (freeze days, recalculation cron)

### Phase 4: Smart Task Manager
- Database models (Task) + migration
- API endpoints for tasks (with auth middleware)
- Bot handlers for quick-add (AI parsing), reminders, push notifications
- Mini App task list, create, calendar views
- AI-powered daily planning (task ordering by energy)
- Reminder cron jobs (overdue, deadline approaching, end-of-day)

### Phase 5: Achievement System
- Database models (Achievement, UserAchievement, UserStats) + migration
- Achievement engine (evaluate conditions on relevant events)
- XP system with variable rewards
- Seed default achievements
- Progressive onboarding gating layer
- Mini App achievement gallery + level/XP display on hub

### Phase 6: AI Intelligence Layer
- Database models (UserInsight, Recommendation, Digest) + migration
- UserInsight extraction from AI conversations
- Enhanced context engine for AI prompts
- Closed-loop recommendation tracking (suggest → accept → rate)
- Weekly digest cron job
- Monthly letter cron job

---

## 7. Design Principles

1. **Any action < 2 seconds** — tap, not type
2. **Haptic feedback on every action** — Telegram HapticFeedback API
3. **Theme sync** — follow user's Telegram theme via themeParams
4. **Max 2 navigation levels** — hub → detail, never deeper
5. **Glanceable cards** — understand in 1 second
6. **Motivation through meaning** — identity shift, not just points
7. **Resilient streaks** — never punish, always encourage
8. **AI learns** — every interaction makes the system smarter
9. **Progressive disclosure** — features unlock as user grows
10. **Bot = quick actions, App = deep dives**
