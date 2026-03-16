# Energy Management Bot

Telegram бот для отслеживания 4 типов энергии (физическая, ментальная, эмоциональная, духовная).

## Stack
- TypeScript, Node.js, grammy (Telegram), Express
- Prisma + SQLite (Railway persistent volume)
- Anthropic Claude API (AI chat), Gemini (voice transcription)
- Mini App: vanilla HTML/CSS/JS in `public/`

## Commands
- `npm run dev` — запуск в dev режиме
- `npm run build` — сборка
- `npm test` — тесты (vitest)
- `npx prisma db push` — применить схему

## Deploy
Railway. Auto-deploy из main. Port 8080.

## Kaizen Agent Protocol

При запуске в режиме непрерывного улучшения:

### 1. Диагностика (каждый цикл)
```bash
# Проверь здоровье бота
curl -s https://energy-management-production.up.railway.app/api/kaizen | jq .

# Проверь что билд проходит
cd /Users/timur/energy-management && npm run build

# Проверь тесты
npm test
```

### 2. Анализ (что смотреть)
- **Ошибки**: `recentErrors` в /api/kaizen — фиксить баги
- **Перформанс**: `performance` — если AI response > 5s или voice > 3s, оптимизировать
- **Usage**: если фичи не используются — подумать почему, упростить UX
- **Код**: просматривать файлы на предмет:
  - Необработанные ошибки (catch без trackError)
  - Дублирование кода
  - Улучшение UX в Mini App
  - Отсутствие edge cases
  - Улучшение системного промпта AI

### 3. Улучшения (приоритет)
1. **Баги и ошибки** — критично, чинить сразу
2. **UX Mini App** — визуал, анимации, отзывчивость
3. **AI качество** — улучшение промптов, контекста
4. **Новые фичи** — только мелкие, полезные
5. **Код** — рефакторинг только если реально нужно

### 4. Правила
- Коммитить каждое улучшение отдельно
- НЕ ломать существующий функционал
- НЕ менять API контракты без необходимости
- Тестировать билд после каждого изменения
- Логировать что сделано
