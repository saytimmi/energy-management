# Как контрибьютить

## Процесс

1. Форкни репозиторий
2. Создай ветку от `main`: `git checkout -b feat/my-feature`
3. Внеси изменения, убедись что билд и тесты проходят
4. Открой Pull Request в `main`

## Структура проекта

```
src/
  index.ts              — точка входа (бот + сервер)
  server.ts             — Express: API + статика
  bot.ts                — grammy: Telegram бот
  config.ts             — переменные окружения
  db.ts                 — Prisma client

  api/                  — Express роуты (energy, habits, balance, goals, ...)
  handlers/             — Telegram команды (start, help, checkin, ...)
  services/             — бизнес-логика (ai, scheduler, streaks, nudges, ...)
  middleware/            — telegram-auth (HMAC-SHA256)
  knowledge/            — knowledge base (типы, данные, микро-действия)
  __tests__/            — тесты (vitest)

  mini-app/             — Preact frontend (Vite)
    store/              — сигналы (@preact/signals)
    api/                — HTTP client + типы
    components/         — UI компоненты (hub, energy, habits, balance, kaizen, ...)
    styles/             — CSS (dark/light theme)

prisma/
  schema.prisma         — 15 моделей (User, EnergyLog, Habit, Goal, ...)

docs/                   — документация и спеки
scripts/                — утилиты
```

## Code Style

- **TypeScript strict** — все публичные API типизированы через интерфейсы
- **Prisma** — единственный способ работы с DB, миграции через `prisma migrate`
- **Preact 10** — frontend на `@preact/signals`, без React
- **Express** — API роуты в `src/api/`, каждый файл = один ресурс
- **grammy** — Telegram Bot API, хендлеры в `src/handlers/`
- Файлы до 500 строк, функции до 20 строк
- Именование: camelCase для переменных, PascalCase для типов/компонентов
- Импорты: сначала внешние пакеты, потом внутренние модули

## Тестирование

```bash
# Запустить все тесты
npm test

# Запустить конкретный файл
npx vitest run src/__tests__/habit-streaks.test.ts

# Watch mode
npx vitest src/__tests__/habit-streaks.test.ts
```

- Тесты лежат в `src/__tests__/`
- Используем **vitest** с моками (vi.mock, vi.fn)
- Стиль: London School TDD — мокаем внешние зависимости (Prisma, API)
- Каждый тест-файл соответствует модулю: `energy-analysis.test.ts` -> `services/energy-analysis.ts`
- Перед коммитом всегда проверяй: `npm run build && npm test`

## Коммиты

Conventional Commits:

```
feat: добавить корреляцию привычек и энергии
fix: исправить расчёт streak при pause mode
docs: обновить API документацию
refactor: вынести severity логику в отдельный сервис
test: добавить тесты для weekly digest
chore: обновить зависимости
```

- Одно изменение = один коммит
- Сообщение на английском, краткое, в imperative mood
- Билд и тесты должны проходить на каждом коммите

## PR Review

Что проверяется:

- **Билд**: `npm run build` проходит без ошибок
- **Тесты**: `npm test` — все зелёные, новый код покрыт тестами
- **Типизация**: нет `any`, публичные API типизированы
- **Безопасность**: нет хардкод секретов, input validation на границах
- **Размер**: PR решает одну задачу, файлы до 500 строк
- **Обратная совместимость**: API и DB миграции не ломают существующих клиентов
- **Code style**: единообразие с остальным кодом
