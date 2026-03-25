# API Documentation - Energy Management App

## Аутентификация

Все защищенные эндпоинты требуют заголовок:

```
Authorization: tma <Telegram.WebApp.initData>
```

Middleware (`src/middleware/telegram-auth.ts`) выполняет:

1. Извлечение `initData` из заголовка (префикс `tma `)
2. HMAC-SHA256 валидация подписи через `WebAppData` + bot token
3. Проверка `auth_date` -- токен истекает через 24 часа
4. Парсинг `user` JSON из initData для получения `telegramId`
5. Поиск пользователя в БД по `telegramId` -> установка `req.userId`

**Публичные эндпоинты** (без авторизации):
- `GET /api/config`
- `GET /api/diagnostics`

### Коды ошибок аутентификации

| Код | Тело | Причина |
|-----|------|---------|
| 401 | `{"error": "missing_auth"}` | Заголовок Authorization отсутствует или не начинается с `tma ` |
| 401 | `{"error": "invalid_init_data"}` | Подпись невалидна или токен истек (>24ч) |
| 401 | `{"error": "invalid_user_data"}` | Поле `user` в initData отсутствует или не содержит `id` |
| 404 | `{"error": "user_not_found"}` | Пользователь с таким telegramId не найден в БД |

---

## Энергия

### POST /api/energy

Записать замер энергии из Mini App. Дедупликация: если запись <5 минут назад -- обновляет существующую.

**Тело запроса:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| physical | number (1-10) | да | Физическая энергия |
| mental | number (1-10) | да | Ментальная энергия |
| emotional | number (1-10) | да | Эмоциональная энергия |
| spiritual | number (1-10) | да | Духовная энергия |
| logType | string | да | Тип замера (morning, evening, manual) |

**Ответ 200:**

```json
{
  "logId": 42,
  "severity": {
    "level": "moderate",
    "drops": [{"type": "mental", "from": 8, "to": 5, "drop": 3, "severity": "moderate"}],
    "improvements": []
  },
  "recommendations": [
    {"name": "5-минутная медитация", "duration": 5}
  ],
  "triggerInfo": {
    "energyType": "mental",
    "direction": "drop",
    "triggers": ["Переработка", "Плохой сон", "Стресс"]
  }
}
```

| Код | Ошибка | Причина |
|-----|--------|---------|
| 400 | `"Energy values must be integers 1-10"` | Значение вне диапазона или не integer |
| 500 | `"internal_error"` | Ошибка БД |

### POST /api/energy/:logId/triggers

Сохранить триггеры/наблюдения для замера энергии. Проверяет ownership (logId принадлежит текущему пользователю).

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| logId | number | ID записи энергии |

**Тело запроса:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| triggers | string[] | да | Массив триггеров (непустые строки) |
| energyType | string | да | Тип энергии (physical/mental/emotional/spiritual) |
| direction | string | да | Направление (drop/rise) |
| context | string | нет | Дополнительный контекст |

**Ответ 200:**

```json
{
  "ok": true,
  "observationIds": [1, 2, 3]
}
```

| Код | Ошибка | Причина |
|-----|--------|---------|
| 400 | `"invalid_logId"` | logId не число |
| 400 | `"triggers required"` | Массив пуст или содержит только пробелы |
| 404 | `"log_not_found"` | Запись не найдена или принадлежит другому пользователю |

### GET /api/dashboard

Последний замер энергии + streak (дни подряд с записями).

**Ответ 200:**

```json
{
  "physical": 7,
  "mental": 6,
  "emotional": 8,
  "spiritual": 5,
  "loggedAt": "2026-03-24T10:30:00.000Z",
  "streak": 12
}
```

Если нет записей: `{"error": "no_data"}` (статус 200, не 404).

### GET /api/history

Средние значения энергии по дням за период.

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| period | string | `"week"` | `"week"` (7 дней) или `"month"` (30 дней) |

**Ответ 200:**

```json
[
  {
    "date": "2026-03-20",
    "physical": 7,
    "mental": 6,
    "emotional": 8,
    "spiritual": 5
  }
]
```

Значения округлены до целых. Несколько замеров в день усредняются.

### GET /api/analytics

AI-анализ паттернов энергии за 30 дней. Кеширование 1 час на пользователя.

**Ответ 200 (достаточно данных):**

```json
{
  "hasEnoughData": true,
  "insights": "1. Ваша ментальная энергия стабильно падает к среде...",
  "stats": {
    "avgPhysical": 6.8,
    "avgMental": 5.2,
    "avgEmotional": 7.1,
    "avgSpiritual": 4.9,
    "totalLogs": 28,
    "periodDays": 30
  }
}
```

**Ответ 200 (мало данных):**

```json
{
  "hasEnoughData": false,
  "message": "Нужно минимум 3 записи энергии для анализа паттернов"
}
```

Если AI недоступен: `insights: null` + `"error": "ai_unavailable"`.

### GET /api/observations

Наблюдения пользователя. Дедупликация: удаляет дубли (одинаковые energyType+direction+trigger в пределах 1 часа). Максимум 50 записей.

**Ответ 200:**

```json
{
  "observations": [
    {
      "id": 1,
      "energyType": "mental",
      "direction": "drop",
      "trigger": "Плохой сон",
      "context": null,
      "energyLogId": 42,
      "createdAt": "2026-03-24T10:30:00.000Z"
    }
  ],
  "grouped": {
    "2026-03-24": [...]
  },
  "stats": {
    "typeCounts": {"mental": 5, "physical": 3},
    "directionCounts": {"drop": 6, "rise": 2},
    "triggers": ["Плохой сон", "Кофе"],
    "total": 8
  }
}
```

### GET /api/checkin-trigger

Отправить чекин энергии в Telegram-бот. Server-side дедупликация: 30 секунд cooldown.

**Ответ 200:**

```json
{"ok": true}
```

При повторном вызове в пределах 30 секунд:

```json
{"ok": true, "alreadySent": true}
```

---

## Привычки

### GET /api/habits

Активные привычки, сгруппированные по routineSlot (morning/afternoon/evening). Включает статус выполнения на сегодня.

**Ответ 200:**

```json
{
  "morning": [
    {
      "id": 1,
      "name": "Медитация",
      "icon": "🧘",
      "type": "build",
      "routineSlot": "morning",
      "isDuration": true,
      "duration": 10,
      "stage": "growth",
      "strength": 42,
      "streakCurrent": 7,
      "streakBest": 14,
      "frequency": "daily",
      "customDays": null,
      "targetPerWeek": null,
      "goalId": 3,
      "completedToday": false,
      "inProgress": true,
      "startedAt": "2026-03-24T07:15:00.000Z",
      "isPaused": false,
      "pausedUntil": null
    }
  ],
  "afternoon": [],
  "evening": []
}
```

### GET /api/habits/today

Привычки на сегодня с флагом `completedToday`. Без группировки по слотам.

**Ответ 200:**

```json
[
  {
    "id": 1,
    "name": "Медитация",
    "icon": "🧘",
    "completedToday": true
  }
]
```

### GET /api/habits/heatmap

Тепловая карта выполнения всех привычек за 30 дней.

**Ответ 200:**

```json
[
  {
    "date": "2026-02-23",
    "completedCount": 3,
    "totalCount": 5
  }
]
```

### POST /api/habits

Создать привычку. Лимит: максимум 3 активные привычки в стадиях seed/growth.

**Тело запроса:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| name | string | да | Название |
| icon | string | да | Эмодзи |
| type | string | да | `"build"` или `"break"` |
| routineSlot | string | да | `"morning"`, `"afternoon"`, `"evening"` |
| duration | number | нет | Длительность в минутах |
| isDuration | boolean | нет | Длительная привычка (с таймером) |
| energyType | string | нет | Тип энергии (physical/mental/emotional/spiritual) |
| lifeArea | string | нет | Сфера жизни |
| triggerAction | string | нет | Триггерное действие |
| whyToday | string | нет | Зачем сегодня |
| whyMonth | string | нет | Зачем через месяц |
| whyYear | string | нет | Зачем через год |
| whyIdentity | string | нет | Как связана с идентичностью |
| isItBeneficial | string | нет | Полезна ли (для break-привычек) |
| breakTrigger | string | нет | Триггер (для break-привычек) |
| replacement | string | нет | Замена (для break-привычек) |
| microActionId | string | нет | ID микро-действия |
| minimalDose | string | нет | Минимальная доза |
| frequency | string | нет | `"daily"` (default), `"weekdays"`, `"custom"` |
| customDays | string | нет | Дни недели для custom (JSON) |
| goalId | string/number | нет | ID связанной цели |
| targetPerWeek | string/number | нет | Целевое кол-во раз в неделю |

**Ответ 201:** объект созданной привычки.

| Код | Ошибка | Причина |
|-----|--------|---------|
| 400 | `"Обязательные поля: name, icon, type, routineSlot"` | Не все обязательные поля |
| 400 | `"Максимум 3 активные привычки в стадиях Посев/Рост"` | Лимит привычек |

### PATCH /api/habits/:id

Обновить привычку. Допустимые поля: name, icon, type, routineSlot, sortOrder, duration, energyType, lifeArea, triggerAction, whyToday, whyMonth, whyYear, whyIdentity, isItBeneficial, breakTrigger, replacement, microActionId, frequency, customDays, stage, minimalDose, goalId, targetPerWeek.

**Ответ 200:** обновленный объект привычки.

| Код | Ошибка |
|-----|--------|
| 404 | `"Привычка не найдена"` |

### DELETE /api/habits/:id

Мягкое удаление (`isActive = false`).

**Ответ 200:**

```json
{"success": true}
```

### POST /api/habits/:id/start

Начать длительную привычку (создает HabitLog со статусом `"started"`). Если лог на сегодня уже есть -- возвращает существующий.

**Ответ 201:** объект HabitLog.

### POST /api/habits/:id/complete

Завершить привычку на сегодня. Для длительных -- переводит из `"started"` в `"completed"`. Для мгновенных -- создает лог сразу с `"completed"`. Пересчитывает streak.

**Тело запроса (опционально):**

| Поле | Тип | Описание |
|------|-----|----------|
| note | string | Заметка |

**Ответ 200/201:**

```json
{
  "id": 1,
  "habitId": 5,
  "date": "2026-03-24T00:00:00.000Z",
  "status": "completed",
  "streakCurrent": 8,
  "streakBest": 14
}
```

### DELETE /api/habits/:id/complete

Отменить выполнение привычки на сегодня. Удаляет HabitLog, пересчитывает streak.

**Ответ 200:**

```json
{"success": true, "streakCurrent": 7, "streakBest": 14}
```

### POST /api/habits/:id/pause

Поставить привычку на паузу. Стрик замораживается.

**Тело запроса:**

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| days | number | 7 | Количество дней паузы |

**Ответ 200:** обновленный объект привычки (с `pausedAt` и `pausedUntil`).

### POST /api/habits/:id/resume

Снять привычку с паузы. Обнуляет `pausedAt` и `pausedUntil`.

**Ответ 200:** обновленный объект привычки.

### GET /api/habits/:id/stats

Статистика привычки: streak, consistency, strength, heatmap за 30 дней.

**Ответ 200:**

```json
{
  "streakCurrent": 8,
  "streakBest": 14,
  "consistency30d": 0.73,
  "freezesRemaining": 2,
  "gracePeriod": 2,
  "gracesUsed": 0,
  "strength": 42,
  "stage": "growth",
  "stageUpdatedAt": "2026-03-10T00:00:00.000Z",
  "pausedAt": null,
  "pausedUntil": null,
  "heatmap": [
    {"date": "2026-02-23", "completed": true}
  ]
}
```

### GET /api/habits/:id/correlation

Корреляция привычки с энергией.

**Ответ 200 (достаточно данных):**

```json
{
  "habitName": "Медитация",
  "habitIcon": "🧘",
  "correlation": 0.65,
  "avgEnergyWithHabit": 7.2,
  "avgEnergyWithoutHabit": 5.8,
  "dataPoints": 28
}
```

**Ответ 200 (мало данных):**

```json
{"insufficient": true}
```

---

## Баланс

### GET /api/balance

Обзор 8 сфер жизни с оценками, целями и количеством привычек.

**Ответ 200:**

```json
{
  "areas": [
    {
      "area": "health",
      "label": "Здоровье",
      "icon": "🩺",
      "score": 7,
      "targetScore": 8,
      "identity": "Атлет",
      "isFocus": true,
      "habitCount": 3,
      "lastRatedAt": "2026-03-20T10:00:00.000Z",
      "assessmentType": "quick"
    }
  ],
  "avgScore": 6.5,
  "ratedCount": 6,
  "totalCount": 8,
  "lastAssessmentDate": "2026-03-20T10:00:00.000Z"
}
```

### GET /api/balance/radar

Данные для radar chart. Все 8 сфер, неоцененные = 0.

**Ответ 200:**

```json
{
  "points": [
    {
      "area": "health",
      "label": "Здоровье",
      "icon": "🩺",
      "score": 7,
      "targetScore": 8,
      "isFocus": true
    }
  ]
}
```

### GET /api/balance/:area

Детали сферы жизни: аспекты, привычки, история оценок, auto-метрики.

**Параметры пути:**

| Параметр | Допустимые значения |
|----------|---------------------|
| area | health, career, relationships, finances, family, growth, recreation, environment |

**Ответ 200:**

```json
{
  "area": "health",
  "label": "Здоровье",
  "icon": "🩺",
  "score": 7,
  "subScores": {"sleep": 6, "activity": 8, "nutrition": 7},
  "aspects": [
    {"key": "sleep", "label": "Сон", "score": 6},
    {"key": "activity", "label": "Активность", "score": 8}
  ],
  "assessmentType": "quick",
  "note": null,
  "lastRatedAt": "2026-03-20T10:00:00.000Z",
  "targetScore": 8,
  "identity": "Атлет",
  "isFocus": true,
  "habits": [
    {"id": 1, "name": "Зарядка", "icon": "💪", "streakCurrent": 5, "consistency30d": 0.8, "stage": "growth", "isDuration": false}
  ],
  "autoMetrics": {"avgPhysicalEnergy": 6.8},
  "history": [
    {"score": 7, "note": null, "subScores": null, "assessmentType": "quick", "createdAt": "2026-03-20T10:00:00.000Z"}
  ]
}
```

`autoMetrics` заполняется только для `health` (среднее physical energy за неделю).

| Код | Ошибка |
|-----|--------|
| 400 | `"invalid_area"` |

### POST /api/balance/goals

Установить/обновить цель для сферы (upsert по userId+area).

**Тело запроса:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| area | string | да | Сфера жизни |
| targetScore | number (1-10) | нет | Целевая оценка (clamped 1-10, default 7) |
| identity | string | нет | Идентичность |
| isFocus | boolean | нет | Фокус-сфера |

**Ответ 200:**

```json
{"ok": true, "goal": {"id": 1, "area": "health", "targetScore": 8, "identity": "Атлет", "isFocus": true}}
```

### POST /api/balance/rate

Массовая оценка сфер из Mini App.

**Тело запроса:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| ratings | array | да | Массив оценок |
| ratings[].area | string | да | Сфера жизни |
| ratings[].score | number (1-10) | да | Оценка (integer) |
| ratings[].subScores | object | нет | Оценки аспектов `{"sleep": 6, "activity": 8}` |

Невалидные записи (неизвестная area, score вне 1-10) пропускаются без ошибки.

**Ответ 200:**

```json
{"ok": true, "updated": 5}
```

---

## Кайдзен

### GET /api/reflection/status

Статус рефлексии за вчера + контекст дня (энергия, привычки, наблюдения).

**Ответ 200:**

```json
{
  "done": false,
  "reflection": null,
  "context": {
    "date": "2026-03-23",
    "energy": [
      {"physical": 7, "mental": 6, "emotional": 8, "spiritual": 5, "logType": "morning", "createdAt": "2026-03-23T08:00:00.000Z"}
    ],
    "habits": {
      "completed": [
        {"name": "Медитация", "icon": "🧘", "slot": "morning"}
      ],
      "total": 5
    },
    "observations": [
      {"energyType": "mental", "direction": "drop", "trigger": "Стресс", "context": null}
    ]
  }
}
```

Если рефлексия сделана, поле `reflection` содержит `{id, summary, insights, createdAt}`.

### GET /api/algorithms

Список алгоритмов (персональная база знаний). Сортировка: usageCount desc, createdAt desc.

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| lifeArea | string | Фильтр по сфере |
| q | string | Поиск по title и context (case-insensitive) |

**Ответ 200:**

```json
{
  "algorithms": [
    {
      "id": 1,
      "title": "Восстановление после стресса",
      "icon": "🧘",
      "lifeArea": "health",
      "steps": ["Дыхание 4-7-8", "Прогулка 15 минут"],
      "context": "Когда чувствую напряжение",
      "usageCount": 12,
      "lastUsedAt": "2026-03-23T10:00:00.000Z",
      "createdAt": "2026-03-01T10:00:00.000Z"
    }
  ]
}
```

### GET /api/algorithms/:id

Детали алгоритма. При каждом запросе инкрементируется `usageCount`.

**Ответ 200:**

```json
{
  "id": 1,
  "title": "Восстановление после стресса",
  "icon": "🧘",
  "lifeArea": "health",
  "steps": ["Дыхание 4-7-8", "Прогулка 15 минут"],
  "context": "Когда чувствую напряжение",
  "usageCount": 13,
  "lastUsedAt": "2026-03-24T12:00:00.000Z",
  "sourceReflection": {"id": 5, "date": "2026-03-01", "summary": "..."},
  "createdAt": "2026-03-01T10:00:00.000Z"
}
```

| Код | Ошибка |
|-----|--------|
| 400 | `"invalid_id"` |
| 404 | `"not_found"` |

### PATCH /api/algorithms/:id

Обновить алгоритм.

**Тело запроса:**

| Поле | Тип | Описание |
|------|-----|----------|
| title | string | Новое название |
| steps | string[] | Новые шаги |
| isActive | boolean | Деактивация |

Минимум одно поле обязательно.

**Ответ 200:** обновленный объект алгоритма.

| Код | Ошибка |
|-----|--------|
| 400 | `"no_fields"` |
| 404 | `"not_found"` |

### DELETE /api/algorithms/:id

Мягкое удаление (`isActive = false`).

**Ответ 200:**

```json
{"ok": true}
```

### GET /api/reflections

Лента рефлексий с пагинацией. Включает связанные алгоритмы.

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| page | number | 1 | Страница (min 1) |
| limit | number | 20 | Количество (1-50) |

**Ответ 200:**

```json
{
  "reflections": [
    {
      "id": 1,
      "date": "2026-03-23",
      "summary": "Продуктивный день...",
      "insights": "Утренняя медитация помогла...",
      "algorithms": [{"id": 1, "title": "...", "icon": "🧘"}],
      "createdAt": "2026-03-23T22:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### GET /api/reflections/:date

Рефлексия за конкретную дату. Формат: `YYYY-MM-DD`.

**Ответ 200:**

```json
{
  "id": 1,
  "date": "2026-03-23",
  "summary": "Продуктивный день...",
  "insights": "...",
  "energyContext": "...",
  "habitsContext": "...",
  "algorithms": [{"id": 1, "title": "...", "icon": "🧘", "steps": ["..."]}],
  "createdAt": "2026-03-23T22:00:00.000Z"
}
```

| Код | Ошибка |
|-----|--------|
| 400 | `"invalid_date_format"` |
| 404 | `"not_found"` |

### GET /api/digests

Недельные дайджесты. Последние 10 записей.

**Ответ 200:**

```json
[
  {
    "id": 1,
    "weekStart": "2026-03-17T00:00:00.000Z",
    "content": {"energy": {...}, "habits": {...}, "insights": [...]},
    "summary": "На этой неделе...",
    "createdAt": "2026-03-23T22:00:00.000Z"
  }
]
```

`content` -- JSON-объект с произвольной структурой (генерируется AI).

### GET /api/digests/:weekStart

Дайджест за конкретную неделю. Параметр `weekStart` -- дата начала недели (ISO 8601).

**Ответ 200:** аналогичен элементу массива из `GET /api/digests`.

| Код | Ошибка |
|-----|--------|
| 400 | `"Invalid date"` |
| 404 | `"Digest not found"` |

---

## Стратегия

### GET /api/mission

Миссия пользователя. Если миссии нет -- возвращает объект с null-полями.

**Ответ 200:**

```json
{
  "identity": "Создатель",
  "purpose": "Помогать людям через технологии",
  "legacy": "Инструменты, которые меняют жизни",
  "statement": "Я создаю технологии, которые помогают людям жить осознаннее",
  "updatedAt": "2026-03-20T10:00:00.000Z"
}
```

### PUT /api/mission

Создать или обновить миссию (upsert по userId). Partial update -- отправляйте только изменяемые поля.

**Тело запроса:**

| Поле | Тип | Описание |
|------|-----|----------|
| identity | string | Кем я хочу быть |
| purpose | string | Зачем я живу |
| legacy | string | Что оставлю после себя |
| statement | string | Формулировка миссии |

**Ответ 200:** объект миссии (аналогичен GET).

### GET /api/goals

Список целей с фильтрами. По умолчанию возвращает только активные.

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| lifeArea | string | -- | Фильтр по сфере |
| timeHorizon | string | -- | `"year"` или `"quarter"` |
| status | string | `"active"` | `"active"`, `"completed"`, `"dropped"` |

**Ответ 200:**

```json
[
  {
    "id": 1,
    "lifeArea": "health",
    "title": "Пробежать марафон",
    "description": "Sub-4 hours",
    "timeHorizon": "year",
    "period": "2026",
    "status": "active",
    "progress": 35,
    "metric": "km/week",
    "targetValue": 42,
    "currentValue": 15,
    "milestones": [{"title": "10km", "done": true}],
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-03-20T10:00:00.000Z"
  }
]
```

### POST /api/goals

Создать цель.

**Тело запроса:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| lifeArea | string | да | Сфера жизни |
| title | string | да | Название цели |
| timeHorizon | string | да | `"year"` или `"quarter"` |
| period | string | да | Период (напр. `"2026"`, `"2026-Q1"`) |
| description | string | нет | Описание |
| metric | string | нет | Единица измерения |
| targetValue | string/number | нет | Целевое значение |

**Ответ 200:** объект цели.

| Код | Ошибка |
|-----|--------|
| 400 | `"lifeArea, title, timeHorizon, period required"` |
| 400 | `"Invalid lifeArea: ..."` |
| 400 | `"Invalid timeHorizon: ..."` |

### PATCH /api/goals/:id

Обновить цель. Partial update.

**Тело запроса:**

| Поле | Тип | Описание |
|------|-----|----------|
| title | string | Название |
| description | string | Описание |
| status | string | `"active"`, `"completed"`, `"dropped"` |
| progress | number (0-100) | Прогресс в процентах |
| currentValue | number | Текущее значение метрики |
| milestones | object | JSON с milestones |
| metric | string | Единица измерения |
| targetValue | number | Целевое значение |

**Ответ 200:** обновленный объект цели.

| Код | Ошибка |
|-----|--------|
| 400 | `"Invalid goal ID"`, `"Invalid status"`, `"progress must be 0-100"`, `"No fields to update"` |
| 404 | `"Goal not found"` |

### GET /api/strategy

Комбинированный эндпоинт: миссия + все сферы с целями, идентичностями, привычками. Привычки группируются под связанными целями.

**Ответ 200:**

```json
{
  "mission": {
    "identity": "Создатель",
    "purpose": "...",
    "legacy": "...",
    "statement": "...",
    "updatedAt": "2026-03-20T10:00:00.000Z"
  },
  "focusAreas": [
    {
      "area": "health",
      "label": "Здоровье",
      "icon": "🩺",
      "score": 7,
      "targetScore": 8,
      "identity": "Атлет",
      "isFocus": true,
      "yearGoals": [
        {
          "id": 1,
          "title": "Пробежать марафон",
          "description": null,
          "period": "2026",
          "status": "active",
          "progress": 35,
          "metric": "km/week",
          "targetValue": 42,
          "currentValue": 15,
          "habits": [
            {"id": 5, "name": "Бег", "icon": "🏃", "streak": 12, "consistency": 0.8}
          ]
        }
      ],
      "quarterGoals": [],
      "habits": [],
      "unlinkedHabits": [
        {"id": 2, "name": "Зарядка", "icon": "💪", "streak": 5, "consistency": 0.6}
      ]
    }
  ],
  "otherAreas": [...]
}
```

`habits` и `unlinkedHabits` содержат привычки, не связанные с целями. `focusAreas` -- сферы с `isFocus=true`, `otherAreas` -- остальные.

---

## Настройки

### GET /api/settings

Настройки пользователя. Недостающие notification prefs заполняются дефолтами.

**Ответ 200:**

```json
{
  "timezone": "Europe/Moscow",
  "vacationUntil": "2026-04-01T00:00:00.000Z",
  "vacationReason": "Отпуск на море",
  "notificationPrefs": {
    "morningBrief": true,
    "morningTime": "08:00",
    "afternoonReminder": true,
    "eveningReminder": true,
    "weeklyDigest": true,
    "balanceReminder": true,
    "balanceIntervalDays": 14
  }
}
```

### PUT /api/settings

Обновить настройки (partial update). При включении vacation mode -- все активные привычки ставятся на паузу. При выключении -- все привычки возобновляются.

**Тело запроса:**

| Поле | Тип | Описание |
|------|-----|----------|
| timezone | string | IANA timezone (напр. `"Europe/Moscow"`) |
| vacationUntil | string/null | ISO 8601 дата окончания отпуска. `null` для выключения |
| vacationReason | string/null | Причина отпуска |
| notificationPrefs | object | Объект настроек уведомлений (partial) |

**Ответ 200:** аналогичен GET /api/settings.

---

## Система

### GET /api/config

Публичный эндпоинт. Конфигурация бота для Mini App.

**Ответ 200:**

```json
{
  "botUsername": "energy_bot",
  "webappUrl": "https://example.com"
}
```

### GET /api/diagnostics

Публичный эндпоинт. Health check + метрики + ошибки.

**Ответ 200:**

```json
{
  "timestamp": "2026-03-24T12:00:00.000Z",
  "health": {
    "errors24h": 2,
    "errorsBySource": {"ai": 1, "bot": 1}
  },
  "performance": {
    "ai_response_time": {"avg": 1200, "max": 3500, "count": 45}
  },
  "usage": {
    "totalUsers": 150,
    "activeUsersToday": 23,
    "messagesToday": 89,
    "voiceMessagesToday": 5,
    "observationsToday": 12,
    "sessionsToday": 18,
    "completedSessionsThisWeek": 45,
    "energyLogsThisWeek": 210
  },
  "recentErrors": [
    {
      "source": "ai",
      "message": "Rate limit exceeded",
      "count": 1,
      "context": {"model": "claude-sonnet-4-20250514"},
      "at": "2026-03-24T11:30:00.000Z"
    }
  ]
}
```

---

## Общие ошибки

Все защищенные эндпоинты могут вернуть:

| Код | Тело | Причина |
|-----|------|---------|
| 401 | `{"error": "missing_auth"}` | Нет заголовка Authorization |
| 401 | `{"error": "invalid_init_data"}` | Невалидный или просроченный токен |
| 500 | `{"error": "internal_error"}` | Внутренняя ошибка сервера |

Все даты в ответах -- ISO 8601 строки. Все ID -- целые числа.
