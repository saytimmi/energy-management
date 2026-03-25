# Деплой и настройка

## Переменные окружения

| Переменная | Обязательная | Описание |
|------------|:------------:|----------|
| `TELEGRAM_BOT_TOKEN` | да | Токен Telegram-бота от @BotFather |
| `ANTHROPIC_API_KEY` | нет* | API-ключ Anthropic (Claude). Без него AI-чат не работает |
| `GROQ_API_KEY` | нет | API-ключ Groq (Whisper). Без него голосовые не транскрибируются |
| `DATABASE_URL` | нет* | PostgreSQL connection string (Neon). По умолчанию: `file:./data/energy.db` (SQLite) |
| `WEBAPP_URL` | нет | URL Mini App (например `https://energy-management-production.up.railway.app`). Без него нет кнопки "Energy App" в боте |
| `BOT_USERNAME` | нет | Username бота без @. По умолчанию: `energy_coach_bot` |
| `PORT` | нет | Порт сервера. По умолчанию: `3000`. Railway задаёт автоматически |
| `OWNER_TELEGRAM_ID` | нет | Telegram ID владельца. Нужен для /kaizen команды |
| `GITHUB_TOKEN` | нет | GitHub Personal Access Token. Нужен для `/kaizen improve` (GitHub Actions dispatch) |

*ANTHROPIC_API_KEY и DATABASE_URL технически опциональны, но без них приложение бесполезно.

## Railway Setup

### 1. Создание проекта

1. Зайти на [railway.app](https://railway.app), авторизоваться через GitHub
2. New Project -> Deploy from GitHub repo -> выбрать `energy-management`
3. Railway автоматически определит Node.js и создаст сервис

### 2. Настройка переменных

Settings -> Variables -> добавить все обязательные переменные:
- `TELEGRAM_BOT_TOKEN` -- от BotFather
- `ANTHROPIC_API_KEY` -- от console.anthropic.com
- `DATABASE_URL` -- от Neon (см. ниже)
- `WEBAPP_URL` -- URL Railway сервиса (появится после первого деплоя)
- `BOT_USERNAME` -- username бота без @

### 3. Деплой

Railway деплоит автоматически при push в main. Конфигурация в `railway.toml`:

```toml
[build]
builder = "nixpacks"

[build.nixpacks]
buildCmd = "npm run build"

[deploy]
startCommand = "npx prisma db push --accept-data-loss && node dist/index.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

Build: `npm run build` (prisma generate + tsc + vite build). Start: миграция Prisma + запуск сервера.

### 4. Домен

Settings -> Networking -> Generate Domain. Полученный URL (например `energy-management-production.up.railway.app`) использовать как `WEBAPP_URL`.

## Database (Neon PostgreSQL)

### Настройка

1. Зайти на [neon.tech](https://neon.tech), создать проект
2. Скопировать connection string из Dashboard (формат: `postgresql://user:password@host/dbname?sslmode=require`)
3. Добавить в Railway как `DATABASE_URL`

### Миграции

Prisma schema: `prisma/schema.prisma` (15 моделей). Миграции применяются автоматически при старте через `npx prisma db push --accept-data-loss`.

Для ручного применения:
```bash
npx prisma db push
```

Для просмотра данных:
```bash
npx prisma studio
```

## Telegram Bot Setup

### BotFather

1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` -> задать имя и username
3. Скопировать токен в `TELEGRAM_BOT_TOKEN`

### Webhook

Бот использует long polling (grammy), webhook не нужен. Бот запускается автоматически при старте сервера.

### Mini App

1. В BotFather: `/mybots` -> выбрать бота -> Bot Settings -> Menu Button
2. Задать URL Mini App = `WEBAPP_URL`
3. Бот автоматически устанавливает Menu Button при старте (`setChatMenuButton` в `setupBot()`)

### Команды бота

Бот автоматически регистрирует команды при старте:
- `/start` -- Главное меню
- `/energy` -- Записать энергию
- `/report` -- Анализ и рекомендации
- `/help` -- Справка

## Локальная разработка

### Запуск

```bash
npm install
cp .env.example .env  # заполнить переменные
npm run dev
```

`npm run dev` запускает concurrently:
- **Backend**: `tsx watch src/index.ts` на порту 8080
- **Frontend (Vite)**: dev-сервер на порту 5173, proxy `/api` -> `http://localhost:8080`

Mini App доступно на `http://localhost:5173`. API -- на `http://localhost:8080/api/*`.

### Тесты

```bash
npm test          # vitest run (19 файлов, 117+ тестов)
npm run build     # проверка что TypeScript + Vite собираются без ошибок
```

### Структура билда

```
dist/
  index.js          # серверный код (tsc)
  client/           # Mini App (vite build)
```

В production Express раздаёт `dist/client/` как статику + API роуты.

## Production Checklist

Перед выходом в production:

- [ ] Все переменные окружения заданы в Railway (TELEGRAM_BOT_TOKEN, ANTHROPIC_API_KEY, DATABASE_URL, WEBAPP_URL)
- [ ] `npm run build` проходит без ошибок
- [ ] `npm test` -- все тесты зелёные
- [ ] DATABASE_URL указывает на Neon PostgreSQL (не SQLite)
- [ ] WEBAPP_URL совпадает с Railway доменом
- [ ] BOT_USERNAME совпадает с реальным username бота
- [ ] Бот отвечает на /start в Telegram
- [ ] Mini App открывается через кнопку "Energy App"
- [ ] `GET /api/diagnostics` возвращает 200 OK
- [ ] OWNER_TELEGRAM_ID задан для /kaizen команды
- [ ] Нет секретов в коммитах (.env в .gitignore)
