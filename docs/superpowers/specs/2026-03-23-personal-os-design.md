# Персональная операционная система — полная спецификация

## Концепция

5 слоёв, работающих в синергии через AI коуча:

1. **Миссия/Видение** — кто я, куда иду (обновляется ~раз в год)
2. **Баланс жизни** — 8 сфер × (текущее + цель), AI-assessment раз в 2 недели
3. **Привычки** — ежедневные действия, привязаны к сферам + типам энергии
4. **Энергия** — 4 типа (физ/мент/эмоц/дух), чекин 2 раза в день
5. **Кайдзен** — ежедневная рефлексия → алгоритмы (персональная база знаний)

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
  vision    String   // Свободный текст: кто я, куда иду, миссия
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}

model BalanceGoal {
  id         Int      @id @default(autoincrement())
  userId     Int
  user       User     @relation(fields: [userId], references: [id])
  area       String   // "health" | "career" | "relationships" | "finances" | "family" | "growth" | "recreation" | "environment"
  targetScore Int     // 1-10, цель
  identity   String?  // "Человек который бегает каждое утро"
  focusPeriod String? // "Q2 2026" — период фокуса, не жёсткий дедлайн
  isFocus    Boolean  @default(false) // Сфера в активном фокусе
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
  usageCount  Int      @default(0) // Сколько раз запрашивал
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
  energyContext String? // Снимок энергии за день (заполняется сервером автоматически)
  habitsContext String? // Какие привычки выполнены/пропущены (заполняется сервером)
  algorithms  Algorithm[] @relation("AlgorithmReflection") // Алгоритмы рождённые из рефлексии
  sessionId   Int?
  session     Session? @relation(fields: [sessionId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([userId, date]) // Одна рефлексия в день, повторный вызов — обновление
}
```

### Изменения существующих моделей

```prisma
model BalanceRating {
  // Существующие поля остаются
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  area      String
  score     Int      // 1-10
  note      String?
  createdAt DateTime @default(now())

  // НОВЫЕ поля:
  subScores Json?    // {"sleep": 4, "activity": 2, ...} — пользовательские оценки аспектов
  assessmentType String @default("subjective") // "subjective" | "ai_guided"

  @@index([userId, area, createdAt]) // Быстрый поиск последней оценки per area
}

model User {
  // Добавить связи:
  mission       Mission?
  balanceGoals  BalanceGoal[]
  algorithms    Algorithm[]
  reflections   Reflection[]
}
```

---

## Связи между данными

```
Mission (видение, идентичность)
  ↓ AI использует как контекст для всех советов
  ↓
BalanceGoal (8 сфер × цель + identity + focusPeriod)
  ↓ Определяет какие привычки AI предлагает
  ↓ AI сравнивает BalanceRating.score vs BalanceGoal.targetScore
  ↓
BalanceRating (текущая оценка, subScores)
  ↓ AI декомпозирует сферу на аспекты, задаёт вопросы
  ↓ Часть данных берёт автоматически:
  │   - BalanceRating["health"].subScores.energy ← AVG(EnergyLog.physical) за 2 недели
  │   - BalanceRating["health"].subScores.activity ← COUNT(HabitLog WHERE habit.lifeArea="health") за 2 недели
  ↓
Habit (lifeArea → BalanceGoal.area, energyType → EnergyLog)
  ↓ Привычка привязана к сфере + типу энергии
  ↓ HabitLog трекает выполнение
  ↓ habit-correlation.ts считает влияние на энергию
  ↓
EnergyLog (4 типа × 1-10)
  ↓ Чекин 2 раза в день (severity-based)
  ↓ Observation сохраняет триггеры
  ↓ Weekly digest анализирует паттерны
  ↓
Reflection (ежедневная рефлексия)
  ↓ AI подкидывает контекст: энергия вчера, привычки, наблюдения
  ↓ Пользователь рефлексирует
  ↓ AI структурирует → может создать Algorithm
  ↓
Algorithm (персональная база знаний)
  ↑ Доступен через чат ("как проводить встречу?")
  ↑ Доступен в mini app (библиотека)
  ↑ AI подсказывает перед событиями (будущее: Google Calendar)
```

---

## AI Bot — новые инструменты (Tool Use)

### 1. `set_mission` — установить/обновить миссию

```typescript
{
  name: "set_mission",
  description: "Сохранить видение/миссию пользователя",
  input_schema: {
    vision: string // Свободный текст
  }
}
```

**Когда вызывается:** Пользователь рассказывает о себе, своих целях, кем хочет быть. AI распознаёт это как миссию и сохраняет.

### 2. `set_balance_goal` — установить цель по сфере

```typescript
{
  name: "set_balance_goal",
  description: "Установить цель и идентичность для сферы жизни",
  input_schema: {
    area: string,       // "health" | "career" | ...
    targetScore: number, // 1-10
    identity: string?,   // "Человек который..."
    focusPeriod: string?, // "Q2 2026"
    isFocus: boolean?    // Эта сфера в активном фокусе
  }
}
```

**Когда вызывается:** После balance assessment, когда обсуждают цели. Или при первичной настройке.

### 3. `rate_life_area` — ОБНОВЛЁННЫЙ

Существующий инструмент, но теперь сохраняет subScores:

```typescript
{
  name: "rate_life_area",
  input_schema: {
    area: string,
    score: number,     // Итоговая оценка 1-10
    note: string?,
    subScores: {       // НОВОЕ: детализация
      [key: string]: number // {"sleep": 4, "activity": 2, ...}
    },
    assessmentType: "subjective" | "ai_guided"
  }
}
```

### 4. `save_algorithm` — сохранить алгоритм

```typescript
{
  name: "save_algorithm",
  description: "Сохранить персональный алгоритм в базу знаний",
  input_schema: {
    title: string,     // "Как проводить встречу"
    icon: string,      // "🤝"
    lifeArea: string?, // Привязка к сфере
    steps: string[],   // ["Повестка заранее", "Таймер 30 мин", ...]
    context: string?   // "После неудачной встречи 22 марта"
  }
}
```

**Когда вызывается:** Во время кайдзен-рефлексии, когда пользователь описывает ситуацию и AI помогает структурировать алгоритм.

### 5. `get_algorithms` — получить алгоритмы

```typescript
{
  name: "get_algorithms",
  description: "Найти алгоритмы пользователя по теме или сфере",
  input_schema: {
    query: string?,    // Поиск по названию/контексту
    lifeArea: string?  // Фильтр по сфере
  }
}
```

**Когда вызывается:** Пользователь спрашивает "как проводить встречу?" или "что у меня есть по карьере?". AI ищет в алгоритмах и отвечает в стиле друга.

### 6. `save_reflection` — сохранить рефлексию

```typescript
{
  name: "save_reflection",
  description: "Сохранить результат кайдзен-рефлексии",
  input_schema: {
    date: string,       // ISO date, за какой день
    summary: string,    // AI-резюме
    insights: string[], // Ключевые инсайты
  }
}
// Обработчик автоматически заполняет:
// - energyContext: fetch EnergyLog за date, stringify
// - habitsContext: fetch HabitLog за date, stringify
// - sessionId: текущая сессия
// Если Reflection за эту дату уже есть → upsert (обновить)
```

### 7. `start_balance_assessment` — начать оценку баланса

```typescript
{
  name: "start_balance_assessment",
  description: "Получить данные для AI-guided оценки сфер жизни",
  input_schema: {
    areas: string[]? // Какие сферы оценить (null = все 8)
  }
}
// Возвращает AI контекст для каждой запрошенной сферы:
// - Последняя BalanceRating (score, subScores, дата)
// - BalanceGoal (targetScore, identity, isFocus)
// - Авто-метрики: AVG(EnergyLog) за 2 нед, COUNT(HabitLog) за 2 нед
// - Список привычек для этой сферы
// AI использует эти данные чтобы задавать конкретные вопросы
```

**Когда вызывается:** Раз в 2 недели по расписанию, по запросу, или AI решает сам в разговоре.

---

## AI Bot — сценарии поведения

### Сценарий 1: Balance Assessment (раз в 2 недели)

**Триггер:** Cron job, каждые 14 дней. Или пользователь просит.

**Flow:**

```
1. AI проверяет последний BalanceRating per area
   → Если прошло <14 дней, не инициирует

2. AI отправляет сообщение:
   "Слушай, давно не смотрели на баланс. Пройдёмся?"

3. Для каждой сферы AI декомпозирует на аспекты:

   ЗДОРОВЬЕ:
   AI: "Как спишь в последнее время?"
   → Ответ пользователя
   AI: "Физическая активность — сколько раз в неделю?"
   → Ответ
   AI: "Питание как?"
   → Ответ
   AI берёт автоматически:
   → AVG(EnergyLog.physical) за 2 недели = 4.2
   → COUNT(HabitLog WHERE habit.lifeArea="health") / days = 0.3

   AI: "По сну, активности, питанию и энергии я бы поставил
        здоровье на 3-4. Согласен?"
   → Пользователь подтверждает/корректирует
   → AI вызывает rate_life_area(area="health", score=3,
       subScores={"sleep":4, "activity":2, "nutrition":3,
                  "energy":4, "wellbeing":3},
       assessmentType="ai_guided")

4. После всех сфер AI показывает сводку:
   "Вот как выглядит твоё колесо:
    🩺 Здоровье 3 (было 4, ↓1)
    🚀 Карьера 8 (было 7, ↑1)
    ...

    Критичные (ниже 5): Здоровье, Отдых
    Сильные (выше 7): Карьера, Финансы

    Хочешь поставить цели или обсудить что-то?"

5. Если пользователь хочет цели:
   AI: "Здоровье сейчас 3. К какому уровню хочешь прийти
        и за какой период?"
   → set_balance_goal(area="health", targetScore=8,
       focusPeriod="Q2 2026", identity="Человек который бегает
       и высыпается")
   AI: "Могу предложить привычки для здоровья.
        Что ближе — сон, активность или питание?"
   → create_habit(...)
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

### Сценарий 2: Кайдзен час (ежедневно, утром)

**Триггер:** Cron job, каждое утро (время настраивается). Или пользователь нажимает "Начать" в mini app.

**Flow:**

```
1. AI собирает контекст вчерашнего дня:
   - EnergyLog за вчера (все чекины)
   - HabitLog за вчера (что выполнено, что пропущено)
   - Observation за вчера (триггеры)
   - [Будущее] Google Calendar — события вчера

2. AI отправляет сообщение:
   "Доброе утро! Давай посмотрим на вчера.

    Энергия: 🦾 7→4 🧬 8→3 🫀 6→5 🔮 7→6
    Ментальная упала сильно.
    Привычки: ✓ пробежка, ✓ чтение, ✗ медитация

    Что вчера было самым сложным?"

3. Пользователь рассказывает о дне
   → AI задаёт уточняющие вопросы (max 1 за ответ)
   → "Что бы ты сделал по-другому?"
   → "Есть ли паттерн который повторяется?"

4. Если есть паттерн → AI предлагает алгоритм:
   "Слушай, это уже третий раз когда встреча без повестки
    убивает ментальную энергию. Давай пропишем алгоритм
    для встреч?"
   → Пользователь описывает шаги
   → AI структурирует
   → save_algorithm(title="Как проводить встречу",
       steps=[...], context="Три неэффективные встречи подряд",
       lifeArea="career")

5. AI сохраняет рефлексию:
   → save_reflection(date="2026-03-22",
       summary="Ментальная энергия упала из-за встречи без повестки.
                Пропущена медитация. Создан алгоритм встреч.",
       insights=["Встречи без повестки = drain",
                  "Медитация пропускается когда поздно встал"])

6. AI завершает:
   "Отлично, записал. У тебя теперь 12 алгоритмов.
    Сегодня фокус — не забудь медитацию 🧘"
```

### Сценарий 3: Запрос алгоритма из чата

**Триггер:** Пользователь пишет боту в любой момент.

**Flow:**

```
Пользователь: "как проводить встречу?"
  ↓
AI вызывает get_algorithms(query="встреча")
  ↓
Находит Algorithm(title="Как проводить встречу")
  ↓
AI отвечает в стиле друга:
  "У тебя есть протокол! Вот основное:
   1. Повестка заранее — отправь за час до
   2. Таймер на 30 минут — строго
   3. Если ушли от темы — 'давай вернёмся к повестке'
   4. В конце — 3 action items за 5 минут

   Работает уже 3 раза с 20 марта 👍"
```

### Сценарий 4: AI подсказывает алгоритм проактивно

**Триггер:** AI видит контекст в разговоре.

**Flow:**

```
Пользователь: "ладно у меня сейчас встреча, поговорим позже"
  ↓
AI проверяет: есть ли Algorithm с lifeArea="career"
  и title содержит "встреч"?
  ↓
AI: "Удачи! Кстати, не забудь протокол — повестка + таймер 30 мин 😉"
```

### Сценарий 5: Квартальный пересмотр целей

**Триггер:** Cron job, раз в квартал (1 января, 1 апреля, 1 июля, 1 октября).

**Flow:**

```
1. AI отправляет:
   "Новый квартал! Давай пересмотрим цели.

    За прошлый квартал:
    🩺 Здоровье: 3 → 5 (+2) — цель была 8
    🚀 Карьера: 7 → 8 (+1) — цель была 9
    ...

    Хочешь обновить цели на этот квартал?"

2. Для каждой сферы:
   AI: "Здоровье дошло до 5. Цель была 8.
        Оставляем 8 или корректируем?"
   → set_balance_goal(...)

3. AI: "Какие 2-3 сферы в фокусе на этот квартал?"
   → Обновляет isFocus
```

### Сценарий 6: Weekly Digest — ОБНОВЛЁННЫЙ

Существующий weekly digest дополняется:

```
Еженедельный дайджест (воскресенье):

1. Энергия: тренды за неделю (уже есть)
2. Привычки: consistency, streaks (уже есть)
3. НОВОЕ — Баланс: "На этой неделе ты сделал 5 привычек
   по Здоровью (цель 8, сейчас 3). Прогресс!"
4. НОВОЕ — Кайдзен: "3 рефлексии, 1 новый алгоритм.
   Паттерн: утренние встречи чаще дренят энергию."
5. НОВОЕ — Фокус: "Твои сферы в фокусе: Здоровье, Развитие.
   Здоровье двигается (3→4), Развитие стоит на месте."
```

---

## Система приоритетов AI

Когда AI предлагает привычки или даёт советы:

```
1. КРИТИЧНО (score 1-4):
   → AI акцентирует: "Здоровье на 3 — это фундамент,
     без него всё остальное посыпется"
   → Предлагает привычки для этой сферы
   → НЕ давит, но регулярно напоминает

2. В ФОКУСЕ (isFocus=true):
   → AI поддерживает: "Ты решил фокусироваться на Развитии —
     как продвигается чтение?"
   → Привязывает рекомендации к фокус-сферам

3. СИЛЬНОЕ (score 8-10):
   → AI усиливает: "Карьера на 8, отлично.
     Что поможет дойти до 9?"
   → НЕ предлагает снижать фокус на сильном

4. СТАБИЛЬНОЕ (score 5-7, не в фокусе):
   → AI не трогает, только отмечает в дайджесте
```

---

## Mini App — новые экраны

### Навигация (5 табов)

```
🏠 Главная  |  ⚖️ Баланс  |  ⚡ Привычки  |  🧠 Кайдзен  |  🔋 Энергия
```

Дневник убирается как отдельный таб:
- Рефлексии → секция "Рефлексии" в Кайдзен
- Observation-записи (триггеры/контекст) → секция "Наблюдения" в Кайдзен (под рефлексиями)
- Journal.tsx переиспользуется как компонент внутри KaizenScreen

**Роутер:** текущий enum-based роутер расширяется поддержкой параметров:
- `#balance` → BalanceScreen
- `#balance/health` → BalanceDetailScreen (area="health")
- `#kaizen` → KaizenScreen
- `#kaizen/42` → AlgorithmDetailScreen (id=42)
- Реализация: `parseRoute(hash)` → `{ route: string, param?: string }`

### Экран: Hub (#hub)

4 виджета-карточки. Тап на карточку → переход на соответствующий таб.

**Виджет Энергия:**
- 4 типа в цветных контейнерах: 🦾 🧬 🫀 🔮
- Значения + badge streak

**Виджет Баланс:**
- Показывает 4 сферы (приоритетные — критичные + в фокусе)
- Прогресс-бар с чёрточкой-целью
- "ещё N сфер →"

**Виджет Привычки:**
- Кольцо прогресса (процент выполнения дня)
- Слоты 🌅 ☀️ 🌙 с чекбоксами
- Streak + consistency

**Виджет Кайдзен:**
- Два состояния:
  - Ожидает: жёлтый glow, кнопка "Начать", AI-подсказка с контекстом вчера
  - Пройдена: зелёный статус, новый алгоритм
- Горизонтальный скролл чипов-алгоритмов

### Экран: Баланс (#balance)

**Верхняя часть:** SVG Radar Chart (колесо баланса)
- 8 осей, значения 0-10
- Заливка — текущие оценки
- Пунктир — цели (BalanceGoal.targetScore)
- Точки на осях цветом: красный (1-4), жёлтый (5-7), зелёный (8-10)

**Нижняя часть:** Список сфер, каждая карточка содержит:
- Иконка в цветном контейнере
- Название сферы
- Текущая оценка → цель
- Прогресс-бар (текущее / цель)
- Мета: N привычек, период фокуса
- Тап → детальный вид сферы (subScores, привычки, история)

### Экран: Кайдзен (#kaizen)

**Кнопка "Спросить AI коуча":**
- Самая верхняя позиция
- Gradient border, lime glow
- Тап → deep link в Telegram: `tg://resolve?domain=${BOT_USERNAME}`
- AI в боте получает контекст: последние алгоритмы, текущие фокус-сферы

**Статус рефлексии:**
- Ожидает (жёлтый) / Пройдена (зелёный)
- AI-подсказка с данными вчерашнего дня
- Кнопка "Начать" → deep link в Telegram с командой /kaizen

**Библиотека алгоритмов (секция "Мои алгоритмы"):**
- Карточки: иконка, название, сфера, дата, кол-во шагов
- Тап → детальный вид алгоритма (шаги, контекст, usage count)
- Поиск по алгоритмам

**Лента рефлексий (секция "Рефлексии"):**
- Карточки по дням: дата, резюме, инсайты
- Тег → связанный алгоритм

### Экран: Баланс Detail (#balance/:area)

Детальный вид одной сферы (тап из списка баланса):

- Текущая оценка + цель + идентичность ("Я человек который...")
- SubScores бар-чарт (сон: 4, активность: 2, питание: 3...)
- Связанные привычки (фильтр habits WHERE lifeArea=area)
- История оценок (график за время)
- AI insight: "За месяц здоровье выросло с 3 до 5. Сработали: пробежка (+0.8 физ энергии), сон до 23:00"

### Экран: Алгоритм Detail (#kaizen/:id)

Детальный вид одного алгоритма:

- Заголовок + иконка
- Сфера жизни
- Шаги (нумерованный список)
- Контекст (из какой ситуации)
- Дата создания
- Использован N раз
- Кнопка "Спросить AI" (deep link в Telegram с контекстом алгоритма)

---

## API — новые endpoints

### Balance

```
GET    /api/balance              → Текущие оценки (последняя per area) + goals
GET    /api/balance/:area        → Детали сферы: subScores, история, привычки
GET    /api/balance/radar        → Данные для radar chart (scores + targets)
POST   /api/balance/goals        → Установить/обновить BalanceGoal
```

### Kaizen

**ВАЖНО:** Существующий `/api/kaizen` — это diagnostics endpoint (без auth). Переименовать в `/api/diagnostics` перед добавлением kaizen reflection routes.

```
GET    /api/reflection/status    → Статус рефлексии сегодня + контекст вчера
                                   Response: { done: boolean, reflection?: Reflection,
                                     context: { energy: EnergyLog[], habits: HabitLog[],
                                     observations: Observation[] } }
GET    /api/algorithms           → Список алгоритмов (фильтр по lifeArea, search по title+context)
GET    /api/algorithms/:id       → Детали алгоритма
PATCH  /api/algorithms/:id       → Обновить алгоритм (title, steps, isActive)
DELETE /api/algorithms/:id       → Архивировать алгоритм (soft delete: isActive=false)
GET    /api/reflections          → Лента рефлексий (pagination: ?page=1&limit=20)
GET    /api/reflections/:date    → Рефлексия за конкретный день
```

### Mission

```
GET    /api/mission              → Текущая миссия/видение
PUT    /api/mission              → Обновить миссию (из mini app)
```

---

## Cron Jobs — новые

```typescript
// Существующие:
// - Утренний/вечерний чекин энергии (scheduler.ts)
// - Еженедельный дайджест (habit-cron.ts)

// НОВЫЕ:
// 1. Balance Assessment — ежедневная проверка, отправка если прошло ≥14 дней
schedule("0 10 * * *", async () => {
  // Для каждого юзера: найти последний BalanceRating
  // Если lastRating.createdAt < 14 дней назад → отправить
  // "Давай посмотрим на баланс"
  // НЕ cron "*/14" (он не работает как "каждые 14 дней")
});

// 2. Кайдзен напоминание — каждое утро
schedule("0 8 * * *", () => {
  // Проверить: есть ли Reflection за вчера?
  // Если нет → отправить напоминание с контекстом
  // "Вчера: энергия ↓, пропущены привычки. Время для рефлексии?"
});

// 3. Квартальный пересмотр целей
schedule("0 10 1 1,4,7,10 *", () => {
  // Сводка за квартал + предложение обновить цели
});
```

---

## Контекст AI (buildUserContext) — обновлённый

Существующая функция `buildUserContext` в ai.ts дополняется:

```typescript
async function buildUserContext(userId: number): string {
  // Существующее:
  const recentEnergy = await getRecentEnergy(userId);
  const habits = await getActiveHabits(userId);
  const observations = await getRecentObservations(userId);

  // НОВОЕ:
  const mission = await prisma.mission.findUnique({ where: { userId } });
  const balanceGoals = await prisma.balanceGoal.findMany({ where: { userId } });
  const latestRatings = await getLatestRatings(userId); // Последняя оценка per area
  const algorithms = await prisma.algorithm.findMany({
    where: { userId, isActive: true },
    orderBy: { usageCount: "desc" },
    take: 10
  });
  const todayReflection = await prisma.reflection.findFirst({
    where: { userId, date: today() }
  });

  return `
    ${mission ? `Миссия: ${mission.vision}` : ""}

    Баланс жизни:
    ${balanceGoals.map(g => {
      const rating = latestRatings.find(r => r.area === g.area);
      return `${g.area}: ${rating?.score ?? "?"}/10 → цель ${g.targetScore}${g.isFocus ? " [ФОКУС]" : ""}${g.identity ? ` (${g.identity})` : ""}`;
    }).join("\n")}

    Алгоритмы (топ): ${algorithms.map(a => a.title).join(", ")}

    Рефлексия сегодня: ${todayReflection ? "✓ пройдена" : "не пройдена"}

    ${/* существующий контекст */}
  `;
}
```

---

## Тема: Light / Dark

CSS variables позволяют переключение. Telegram Mini App SDK даёт `colorScheme`.

```css
/* variables.css — добавить */
:root[data-theme="light"] {
  --bg: #f5f5f7;
  --surface: rgba(255, 255, 255, 0.85);
  --surface-solid: #ffffff;
  --surface2: #f0f0f2;
  --surface-border: rgba(0, 0, 0, 0.06);
  --text: #1d1d1f;
  --text2: #6e6e73;
  --text3: #aeaeb2;
  /* Акценты и энергия — те же цвета, чуть насыщеннее */
}
```

```typescript
// telegram.ts — добавить
const theme = Telegram.WebApp.colorScheme; // "dark" | "light"
document.documentElement.setAttribute("data-theme", theme);
```

Реализация: отдельный этап, после основного функционала.

---

## Google Calendar — будущая интеграция

Не в текущей итерации. План:

```
1. OAuth2 через бота (Google Calendar API)
2. Ежедневно в 00:00 — fetch events за вчера
3. Сохранить в CalendarEvent { userId, title, startTime, endTime, date }
4. Использовать в кайдзен-контексте:
   "Вчера у тебя было: 10:00 встреча с Арманом, 14:00 созвон команды,
    16:00 презентация. Ментальная упала после 14:00.
    Что произошло на созвоне?"
```

---

## Порядок реализации

**Важно:** buildUserContext должен gracefully handle отсутствие данных (null checks). Каждая фаза работает самостоятельно, даже если следующие ещё не реализованы.

### Фаза 1: Фундамент (навигация + роутер + подготовка)
- Переименовать `/api/kaizen` → `/api/diagnostics`
- Расширить роутер: поддержка параметров (`#balance/health`, `#kaizen/42`)
- 5 табов в навигации
- Обновить Hub: 4 виджета (BalanceCard и KaizenCard — заглушки)
- Перенести Journal контент в KaizenScreen (Observations секция)
- Миграция: добавить модели Mission, BalanceGoal, Algorithm, Reflection
- Добавить subScores и assessmentType в BalanceRating
- Добавить индекс на BalanceRating(userId, area, createdAt)

### Фаза 2: Баланс жизни
- API: /api/balance, /api/balance/radar, /api/balance/:area
- Bot tools: set_balance_goal, обновить rate_life_area с subScores, start_balance_assessment
- Bot flow: Balance Assessment (AI-guided, декомпозиция по аспектам)
- Mini App: BalanceCard на Hub (реальные данные), экран Баланс с radar chart
- Mini App: BalanceDetail (#balance/:area) — subScores, привычки, история
- Cron: ежедневная проверка, отправка если ≥14 дней с последней оценки

### Фаза 3: Кайдзен
- API: /api/reflection/status, /api/algorithms (CRUD), /api/reflections
- Bot tools: save_algorithm, get_algorithms, save_reflection
- Bot flow: Кайдзен час (ежедневный, AI подкидывает контекст), проактивные подсказки
- Mini App: KaizenCard на Hub (реальные данные), экран Кайдзен
- Mini App: AlgorithmDetail (#kaizen/:id) — шаги, контекст, "Спросить AI"
- Кнопка "Спросить AI коуча" → deep link Telegram
- Cron: утреннее напоминание кайдзен

### Фаза 4: Миссия + цели + обогащение
- Модель Mission, API: GET/PUT /api/mission
- Bot tool: set_mission
- Bot flow: квартальный пересмотр целей
- Mission на экране Баланса (верхняя секция)
- Обновить buildUserContext: миссия, баланс, алгоритмы, рефлексия
- Обновить weekly digest: баланс + кайдзен секции

### Фаза 5: Polish
- Light/Dark тема (CSS variables + Telegram.WebApp.colorScheme)
- Skeleton loading для всех экранов
- Анимации переходов между экранами
- Premium иконки (🦾 🧬 🫀 и т.д.)

### Фаза 6 (будущее): Google Calendar
- OAuth2 через бота, fetch events, контекст для кайдзена

### Первое использование (onboarding)

Когда данных нет:
- Hub: BalanceCard показывает "Расскажи боту о своих целях — появится колесо баланса"
- Hub: KaizenCard показывает "После первой рефлексии здесь появятся алгоритмы"
- Баланс: пустой radar, кнопка "Оценить баланс" → deep link в бота
- Кайдзен: пустая библиотека, только кнопка "Спросить AI коуча"
