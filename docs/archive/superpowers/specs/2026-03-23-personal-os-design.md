# Персональная операционная система — полная спецификация

## Концепция

6 слоёв + измерительный инструмент, работающих в синергии через AI коуча:

```
🧭 МИССИЯ (зачем я живу) — обновляется ~раз в год
   ↓ определяет направление
🎯 ЦЕЛИ (что я достигну) — год + квартал, конкретные результаты
   ↓ из целей вытекают действия
🪞 ИДЕНТИЧНОСТЬ (кем я стану) — per area, постоянная трансформация
   ↓ определяет привычки
⚡ ПРИВЫЧКИ (что я делаю каждый день) — привязаны к сферам + энергии
   ↓ влияют на
🔋 ЭНЕРГИЯ (топливо) — 4 типа, чекин 2 раза в день
   ↓ рефлексия замыкает цикл
🧠 КАЙДЗЕН (чему я научился) — ежедневная рефлексия → алгоритмы
   ↓ обратно к целям

⚖️ БАЛАНС = МЕТРИКА (отдельно от каскада)
   Не цель, а измерение удовлетворённости. AI-guided раз в 2 недели.
```

**Ключевое различие:** Цель = конкретный результат ("пробежать полумарафон"). Баланс = субъективная удовлетворённость сферой (3/10). Привычки вытекают из целей. Баланс — диагностика.

**AI коуч** — связующий слой. Видит всё, инициирует сам, находит паттерны.

**Принцип:** пассивное — автоматически, активное — только кайдзен час.

---

## Изменения в базе данных

### Новые модели

```prisma
model Mission {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique
  user      User     @relation(fields: [userId], references: [id])
  // 3 вопроса для формирования миссии:
  identity  String?  // "Кто я?" — ценности, роли, суть
  purpose   String?  // "Каково моё место в мире?" — вклад, предназначение
  legacy    String?  // "Что я оставлю после себя?" — наследие, влияние
  statement String?  // Сводная формулировка миссии (AI генерирует из 3 ответов)
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}

model Goal {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  lifeArea    String   // "health" | "career" | ...
  title       String   // "Пробежать полумарафон"
  description String?  // Детали
  timeHorizon String   // "year" | "quarter"
  period      String   // "2026" | "Q2 2026"
  status      String   @default("active") // "active" | "completed" | "dropped"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, lifeArea, status])
}

model BalanceGoal {
  id         Int      @id @default(autoincrement())
  userId     Int
  user       User     @relation(fields: [userId], references: [id])
  area       String   // "health" | "career" | ...
  targetScore Int     // 1-10, целевая удовлетворённость (метрика, не цель)
  identity   String?  // "Человек который бегает каждое утро" — кем я стану в этой сфере
  isFocus    Boolean  @default(false) // Сфера в активном фокусе этого квартала
  updatedAt  DateTime @updatedAt
  createdAt  DateTime @default(now())

  @@unique([userId, area])
}

model Algorithm {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  title       String   // "Как проводить встречу"
  icon        String   // "🤝"
  lifeArea    String?  // Привязка к сфере
  steps       Json     // Массив шагов ["Повестка заранее", ...]
  context     String?  // Из какой ситуации родился
  sourceReflectionId Int?
  sourceReflection   Reflection? @relation("AlgorithmReflection", fields: [sourceReflectionId], references: [id])
  usageCount  Int      @default(0)
  lastUsedAt  DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Reflection {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  date        DateTime // Дата рефлексии (за какой день)
  summary     String   // AI-сгенерированное резюме
  insights    Json?    // Ключевые инсайты ["insight1", ...]
  energyContext String? // Снимок энергии (заполняется сервером)
  habitsContext String? // Привычки дня (заполняется сервером)
  algorithms  Algorithm[] @relation("AlgorithmReflection")
  sessionId   Int?
  session     Session? @relation(fields: [sessionId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([userId, date])
}
```

### Изменения существующих моделей

```prisma
model BalanceRating {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  area      String
  score     Int      // 1-10 субъективная удовлетворённость
  note      String?
  createdAt DateTime @default(now())
  subScores Json?    // {"sleep": 4, "activity": 2, ...}
  assessmentType String @default("subjective") // "subjective" | "ai_guided"

  @@index([userId, area, createdAt])
}

model User {
  // Добавить связи:
  mission       Mission?
  balanceGoals  BalanceGoal[]
  goals         Goal[]
  algorithms    Algorithm[]
  reflections   Reflection[]
}
```

---

## Связи между данными

```
Mission (identity + purpose + legacy → statement)
  ↓ AI использует как контекст для всех советов
  ↓
Goal (конкретные результаты: "Пробежать полумарафон")
  ↓ Год → Квартал → из квартальных целей вытекают привычки
  ↓
BalanceGoal (identity per area + isFocus + targetScore как метрика)
  ↓ Идентичность определяет какие привычки AI предлагает
  ↓
Habit (lifeArea → Goal/BalanceGoal.area, energyType → EnergyLog)
  ↓ Привычка привязана к сфере (implicit link to goals through area)
  ↓
EnergyLog (4 типа × 1-10)
  ↓ Чекин 2 раза в день (severity-based)
  ↓
Reflection (ежедневная рефлексия) → Algorithm (персональная база знаний)
  ↓ Корректировка целей, новые алгоритмы, замыкание цикла

BalanceRating = МЕТРИКА (отдельно)
  AI-guided раз в 2 недели, декомпозиция по аспектам
  Информирует о проблемах, но НЕ является целью
```

---

## AI Bot — инструменты (Tool Use)

### 1. `set_mission` — установить миссию

```typescript
{
  name: "set_mission",
  description: "Сохранить миссию пользователя (3 вопроса + сводка)",
  input_schema: {
    identity: string?,   // "Кто я?" — ответ пользователя
    purpose: string?,    // "Каково моё место в мире?"
    legacy: string?,     // "Что я оставлю после себя?"
    statement: string?   // AI-сводка из 3 ответов
  }
}
```

**Когда вызывается:** AI проводит через 3 вопроса последовательно, структурирует ответы, генерирует statement.

**Flow формирования миссии:**
```
AI: "Давай определим твою миссию. Первый вопрос — кто ты?
     Не должность и не роль. Что тебя определяет как человека?
     Какие ценности для тебя ключевые?"
→ Ответ

AI: "Второй — каково твоё место в мире?
     Что ты даёшь другим? Какой вклад вносишь?
     Что бы люди потеряли если бы тебя не было?"
→ Ответ

AI: "И третий — что ты оставишь после себя?
     Какой след? Что будет жить дольше тебя?"
→ Ответ

AI формулирует statement из 3 ответов, предлагает пользователю:
"Вот как я это вижу: [statement]. Резонирует?"
→ Корректировка → save
```

### 2. `set_goal` — установить цель (НОВОЕ)

```typescript
{
  name: "set_goal",
  description: "Установить конкретную цель для сферы жизни",
  input_schema: {
    lifeArea: string,    // "health" | "career" | ...
    title: string,       // "Пробежать полумарафон"
    description: string?, // Детали
    timeHorizon: string,  // "year" | "quarter"
    period: string        // "2026" | "Q2 2026"
  }
}
```

**Когда вызывается:**
- При квартальном пересмотре (AI-initiated)
- После balance assessment (если сфера критичная)
- По запросу пользователя

### 3. `get_goals` — получить цели (НОВОЕ)

```typescript
{
  name: "get_goals",
  description: "Получить цели пользователя",
  input_schema: {
    lifeArea: string?,    // Фильтр по сфере
    timeHorizon: string?, // "year" | "quarter"
    status: string?       // "active" | "completed"
  }
}
```

### 4. `set_balance_goal` — идентичность и фокус по сфере

```typescript
{
  name: "set_balance_goal",
  description: "Установить идентичность и фокус для сферы жизни",
  input_schema: {
    area: string,
    targetScore: number?, // Целевая удовлетворённость (метрика)
    identity: string?,    // "Человек который..."
    isFocus: boolean?     // В фокусе этого квартала
  }
}
```

### 5. `rate_life_area` — оценка баланса (обновлённый)

```typescript
{
  name: "rate_life_area",
  input_schema: {
    area: string,
    score: number,
    note: string?,
    subScores: { [key: string]: number },
    assessmentType: "subjective" | "ai_guided"
  }
}
```

### 6. `save_algorithm` — сохранить алгоритм

```typescript
{
  name: "save_algorithm",
  input_schema: {
    title: string, icon: string, lifeArea: string?,
    steps: string[], context: string?
  }
}
```

### 7. `get_algorithms` — найти алгоритмы

```typescript
{
  name: "get_algorithms",
  input_schema: { query: string?, lifeArea: string? }
}
```

**Поиск:** ILIKE по title + context. Возвращает top 5 по relevance.

### 8. `save_reflection` — сохранить рефлексию

```typescript
{
  name: "save_reflection",
  input_schema: { date: string, summary: string, insights: string[] }
}
// Сервер автоматически: energyContext, habitsContext, sessionId
// Upsert: если за дату уже есть → обновить
```

### 9. `start_balance_assessment` — данные для оценки

```typescript
{
  name: "start_balance_assessment",
  input_schema: { areas: string[]? }
}
// Возвращает per area: последний rating, goals, auto-metrics, habits
```

---

## AI Bot — сценарии поведения

### Сценарий 1: Формирование миссии (первый раз или годовой пересмотр)

**Триггер:** Онбординг, или cron раз в год, или по запросу.

**Flow:** AI ведёт через 3 вопроса последовательно:
1. "Кто я?" — ценности, роли, суть
2. "Каково моё место в мире?" — вклад, предназначение
3. "Что я оставлю после себя?" — наследие

AI формулирует statement, пользователь подтверждает/корректирует.
→ `set_mission(identity, purpose, legacy, statement)`

### Сценарий 2: Квартальный пересмотр целей (ОБНОВЛЁННЫЙ)

**Триггер:** Cron раз в квартал (1 янв/апр/июл/окт).

```
1. AI показывает итоги квартала:
   "За Q1 2026:
    🩺 Здоровье: баланс 3→5, цель 'бегать 3/нед' — выполнена на 60%
    🚀 Карьера: баланс 7→8, цель 'запустить продукт' — в процессе
    ..."

2. Для каждой сферы в фокусе:
   AI: "Здоровье — цель была 'бегать 3 раза в неделю'.
        Получилось в среднем 2 раза. Что мешало?"
   → Обсуждение → корректировка

3. AI: "Какие цели на Q2?"
   → Год: "Пробежать полумарафон" (остаётся)
   → Квартал: "Довести до 3 раз в неделю + наладить питание"
   → set_goal(lifeArea="health", title="Бегать 3/нед + питание",
       timeHorizon="quarter", period="Q2 2026")

4. AI: "Какие 2-3 сферы в фокусе?"
   → set_balance_goal(area="health", isFocus=true)

5. AI: "Нужны новые привычки для этих целей?"
   → create_habit(...)
```

### Сценарий 3: Balance Assessment (раз в 2 недели)

Без изменений — AI декомпозирует сферы на аспекты, задаёт вопросы, предлагает оценку. Теперь также показывает прогресс по целям:

```
AI: "По здоровью: сон 4, активность 3, питание 3.
     Кстати, твоя цель на квартал — 'бегать 3/нед'.
     На прошлой неделе было 2 раза. Ставлю здоровье на 4. Ок?"
```

**Аспекты декомпозиции по сферам:**
```
🩺 Здоровье:   сон, активность, питание, самочувствие, энергия(авто)
🚀 Карьера:    удовлетворённость, рост, доход, навыки, влияние
💞 Отношения:  глубина, частота, конфликты, поддержка, intimacy
💎 Финансы:    доход/расход, подушка, инвестиции, долги, контроль
🏡 Семья:      время вместе, качество, обязанности, гармония
📚 Развитие:   обучение, чтение, новые навыки, вызовы, прогресс
🧘 Отдых:      хобби, отпуск, перезагрузка, удовольствие, баланс
🌿 Среда:      жильё, рабочее место, комфорт, порядок, эстетика
```

### Сценарий 4: Кайдзен час (ежедневно, утром)

Без изменений — AI подкидывает контекст вчерашнего дня (энергия, привычки, наблюдения, [будущее: calendar events]). Пользователь рефлексирует → AI структурирует → может создать алгоритм.

### Сценарий 5: Запрос алгоритма

Без изменений — пользователь спрашивает → `get_algorithms` → AI отвечает в стиле друга.

### Сценарий 6: Проактивная подсказка алгоритма

Без изменений — AI видит контекст → предлагает протокол.

### Сценарий 7: Weekly Digest (обновлённый)

```
1. Энергия: тренды за неделю (уже есть)
2. Привычки: consistency, streaks (уже есть)
3. НОВОЕ — Цели: "Цель 'бегать 3/нед': на этой неделе 2 раза."
4. НОВОЕ — Баланс: прогресс по фокус-сферам
5. НОВОЕ — Кайдзен: N рефлексий, N алгоритмов, паттерны
```

---

## Система приоритетов AI

```
1. КРИТИЧНО (balance score 1-4):
   → Акцент: "Здоровье на 3 — фундамент"
   → Предлагает привычки + цели для сферы

2. В ФОКУСЕ (isFocus=true):
   → Поддержка: "Как продвигается цель X?"
   → Привязывает рекомендации к целям квартала

3. СИЛЬНОЕ (score 8-10):
   → Усиление: "Карьера на 8, что поможет до 9?"
   → НЕ снижать фокус на сильном

4. СТАБИЛЬНОЕ (score 5-7, не в фокусе):
   → Не трогать, только в дайджесте
```

---

## Mini App — экраны

### Навигация (5 табов)

```
🏠 Главная  |  ⚖️ Баланс  |  ⚡ Привычки  |  🧠 Кайдзен  |  🔋 Энергия
```

Дневник → секции "Рефлексии" и "Наблюдения" в Кайдзен.

**Роутер:** расширить поддержкой параметров:
`#balance`, `#balance/strategy`, `#balance/health`, `#kaizen`, `#kaizen/42`
`parseRoute(hash)` → `{ route, param? }`

### Экран: Hub (#hub) — 4 виджета

**Энергия:** 🦾 🧬 🫀 🔮 в цветных контейнерах + streak
**Баланс:** Топ-4 сферы (критичные + фокус), прогресс-бар, "ещё N →"
**Привычки:** Кольцо прогресса + слоты 🌅 ☀️ 🌙 с чекбоксами + streak + consistency
**Кайдзен:** Статус (ожидает/пройдена) + чипы алгоритмов

### Экран: Баланс (#balance)

**Кнопка "🧭 Миссия и цели"** → переход на Strategy (#balance/strategy)
**Radar chart** (SVG): текущие оценки (заливка) vs целевые (пунктир)
**Список 8 сфер:** иконка, название, кол-во привычек, badge "фокус", оценка, → в детали

### Экран: Стратегия (#balance/strategy) — НОВЫЙ

**Миссия** — 3 блока:
- 🪞 Кто я: identity
- 🌍 Моё место: purpose
- 🏛️ Наследие: legacy
- Сводная формулировка (statement)
- "Редактировать →"

**В фокусе Q[N] [year]** — развёрнутые карточки:
- Area header (иконка, название, баланс X/10, badge "фокус")
- Идентичность: "Кем я стану" — текст
- Цель года: конкретный результат
- Цель квартала: конкретный milestone → привязанные привычки (чипы)

**Остальные сферы** — компактный список:
- Иконка, название, годовая цель текстом, оценка баланса, → в детали

### Экран: Баланс Detail (#balance/:area)

- Оценка X/10 + целевая + прогресс-бар + идентичность
- SubScores (аспекты, AI-оценка)
- Цели для сферы (год + квартал)
- Привязанные привычки (с корреляцией энергии)
- AI insight
- История оценок (график)

### Экран: Кайдзен (#kaizen)

- **"💬 Спросить AI коуча → Telegram"** — gradient, lime glow, deep link
- **Статус рефлексии** — ожидает (жёлтый CTA) / пройдена (зелёный)
- **📂 Мои алгоритмы** — карточки (иконка, название, сфера, шаги, usage)
- **📝 Рефлексии** — лента по дням (дата, резюме, linked алгоритм)
- **👁 Наблюдения** — мигрировано из Journal (trigger, context, direction)

### Экран: Алгоритм Detail (#kaizen/:id)

- Заголовок + иконка + сфера + мета (дата, usage)
- Шаги (нумерованный список)
- Контекст (из какой ситуации)
- "💬 Спросить AI про алгоритм → Telegram"

### Экран: Энергия (#energy) — без изменений

Существующий EnergyDashboard: кольца, динамика, наблюдения, AI паттерны.

---

## API — endpoints

### Strategy & Balance

```
GET    /api/strategy             → Всё для Strategy screen: mission + goals + identities + focus
GET    /api/balance              → Текущие оценки per area + targetScores
GET    /api/balance/radar        → Данные для radar chart
GET    /api/balance/:area        → Детали сферы: subScores, goals, habits, история
POST   /api/balance/goals        → Установить/обновить BalanceGoal (identity, isFocus, targetScore)
GET    /api/goals                → Цели (фильтр: lifeArea, timeHorizon, status)
POST   /api/goals                → Создать цель
PATCH  /api/goals/:id            → Обновить цель (title, status)
```

### Kaizen

**ВАЖНО:** `/api/kaizen` → переименовать в `/api/diagnostics`

```
GET    /api/reflection/status    → Статус рефлексии + контекст вчера
GET    /api/algorithms           → Список (фильтр lifeArea, search title+context)
GET    /api/algorithms/:id       → Детали
PATCH  /api/algorithms/:id       → Обновить
DELETE /api/algorithms/:id       → Архивировать (isActive=false)
GET    /api/reflections          → Лента (pagination)
GET    /api/reflections/:date    → За конкретный день
```

### Mission

```
GET    /api/mission              → identity + purpose + legacy + statement
PUT    /api/mission              → Обновить
```

---

## Cron Jobs

```typescript
// Существующие: energy checkin, weekly digest

// 1. Balance Assessment — ежедневная проверка, отправка если ≥14 дней
schedule("0 10 * * *", checkBalanceAssessment);

// 2. Кайдзен — утреннее напоминание
schedule("0 8 * * *", sendKaizenReminder);

// 3. Квартальный пересмотр целей
schedule("0 10 1 1,4,7,10 *", sendQuarterlyReview);

// 4. Годовой пересмотр миссии
schedule("0 10 1 1 *", sendMissionReview);
```

---

## Контекст AI (buildUserContext)

```typescript
async function buildUserContext(userId: number): string {
  // Существующее:
  const recentEnergy = ...;  const habits = ...;  const observations = ...;

  // НОВОЕ (все с null-safe):
  const mission = await prisma.mission.findUnique({ where: { userId } });
  const goals = await prisma.goal.findMany({
    where: { userId, status: "active" }, orderBy: { timeHorizon: "asc" }
  });
  const balanceGoals = await prisma.balanceGoal.findMany({ where: { userId } });
  const latestRatings = await getLatestRatings(userId);
  const algorithms = await prisma.algorithm.findMany({
    where: { userId, isActive: true }, orderBy: { usageCount: "desc" }, take: 10
  });
  const todayReflection = await prisma.reflection.findFirst({
    where: { userId, date: today() }
  });

  return `
    ${mission?.statement ? `Миссия: ${mission.statement}` : ""}

    Цели:
    ${goals.map(g => `${g.lifeArea} (${g.timeHorizon}): ${g.title}`).join("\n")}

    Баланс:
    ${balanceGoals.map(g => {
      const r = latestRatings.find(r => r.area === g.area);
      return `${g.area}: ${r?.score ?? "?"}/10${g.isFocus ? " [ФОКУС]" : ""}${g.identity ? ` → ${g.identity}` : ""}`;
    }).join("\n")}

    Алгоритмы: ${algorithms.map(a => a.title).join(", ")}
    Рефлексия сегодня: ${todayReflection ? "✓" : "не пройдена"}
    ${/* existing context */}
  `;
}
```

---

## Тема: Light / Dark

```css
:root[data-theme="light"] {
  --bg: #f5f5f7;
  --surface: rgba(255, 255, 255, 0.85);
  --surface-solid: #ffffff;
  --text: #1d1d1f;
  --text2: #6e6e73;
  /* Акценты — адаптировать для контраста на белом */
}
```

```typescript
const theme = Telegram.WebApp.colorScheme;
document.documentElement.setAttribute("data-theme", theme);
```

---

## Google Calendar — будущая интеграция

```
1. OAuth2 через бота (Google Calendar API)
2. Ежедневно fetch events за вчера
3. CalendarEvent { userId, title, startTime, endTime, date }
4. Контекст для кайдзен: "Вчера 3 встречи, ментальная упала после 14:00"
```

---

## Порядок реализации

**Принцип:** buildUserContext gracefully handles null. Каждая фаза самостоятельна.

### Фаза 1: Фундамент
- `/api/kaizen` → `/api/diagnostics`
- Роутер: параметры (`#balance/strategy`, `#balance/health`, `#kaizen/42`)
- 5 табов в навигации
- Hub: 4 виджета (BalanceCard + KaizenCard заглушки)
- Journal → Kaizen (Observations секция)
- Миграция: Mission, Goal, BalanceGoal, Algorithm, Reflection
- BalanceRating: subScores, assessmentType, index

### Фаза 2: Баланс
- API: /api/balance, /api/balance/radar, /api/balance/:area
- Bot tools: set_balance_goal, rate_life_area (subScores), start_balance_assessment
- Bot flow: AI-guided assessment (декомпозиция аспектов)
- Mini App: Balance screen (radar + list), Balance Detail
- Cron: проверка ≥14 дней

### Фаза 3: Кайдзен
- API: /api/reflection/status, /api/algorithms (CRUD), /api/reflections
- Bot tools: save_algorithm, get_algorithms, save_reflection
- Bot flow: Кайдзен час, проактивные подсказки
- Mini App: Kaizen screen, Algorithm Detail
- Cron: утреннее напоминание

### Фаза 4: Стратегия (миссия + цели)
- API: /api/mission, /api/goals, /api/strategy
- Bot tools: set_mission (3 вопроса), set_goal, get_goals
- Bot flow: квартальный пересмотр, годовой пересмотр миссии
- Mini App: Strategy screen (#balance/strategy)
- buildUserContext: полный контекст
- Weekly digest: цели + баланс + кайдзен секции

### Фаза 5: Polish
- Light/Dark тема
- Skeleton loading
- Анимации переходов
- Premium иконки (🦾 🧬 🫀)

### Фаза 6 (будущее): Google Calendar
- OAuth2, fetch events, контекст для кайдзена

### Onboarding (первое использование)

- Hub: BalanceCard → "Расскажи боту о целях"
- Hub: KaizenCard → "После первой рефлексии появятся алгоритмы"
- Balance: пустой radar → "Оценить баланс" → deep link
- Strategy: пустая → "Определить миссию" → deep link
- Kaizen: пустая → только "Спросить AI коуча"
