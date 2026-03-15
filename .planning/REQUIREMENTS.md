# Requirements: EnergyBot

**Defined:** 2026-03-14
**Core Value:** Человек понимает какая энергия просела, почему, и получает конкретный способ её восстановить

## v1 Requirements

### Telegram Bot

- [x] **BOT-01**: Бот отправляет утренний check-in — спрашивает оценку каждой из 4 энергий (1-10)
- [x] **BOT-02**: Бот отправляет вечерний check-in — итог дня по энергиям
- [x] **BOT-03**: Пользователь может написать боту в любой момент и отметить уровень энергии
- [x] **BOT-04**: Бот даёт рекомендации по восстановлению на основе методологии 4 энергий
- [ ] **BOT-05**: Бот диагностирует какая энергия просела и почему (на основе истории)

### Mini App

- [x] **APP-01**: Дашборд с визуализацией текущего уровня 4 энергий
- [x] **APP-02**: История изменений энергий за неделю/месяц (графики)
- [x] **APP-03**: AI-аналитика — паттерны просадок, персональные инсайты

### Knowledge Base

- [x] **KB-01**: База практик восстановления для каждого типа энергии
- [x] **KB-02**: Список факторов расхода для каждого типа энергии
- [x] **KB-03**: Правила: нельзя путать способы восстановления (физ выгорание != мотивация)

### Infrastructure

- [x] **INFRA-01**: Telegram Bot API интеграция
- [x] **INFRA-02**: Telegram Mini App (WebApp)
- [x] **INFRA-03**: База данных для хранения истории пользователей
- [x] **INFRA-04**: AI API (Claude/GPT) для персонализированных советов
- [x] **INFRA-05**: Cron/scheduler для утренних и вечерних напоминаний

## v2 Requirements

### Calendar

- **CAL-01**: Встроенный календарь активностей в Mini App
- **CAL-02**: Автоматическая категоризация активностей по типу энергозатрат
- **CAL-03**: Связь активностей из календаря с просадками энергии

### Advanced

- **ADV-01**: Групповая аналитика (сравнение паттернов в команде)
- **ADV-02**: Геймификация (стрики, достижения)
- **ADV-03**: Интеграция с Google Calendar

## Out of Scope

| Feature | Reason |
|---------|--------|
| Публичный бот | Только для своего круга (~20-50 человек) |
| Мобильное приложение | Telegram Mini App достаточно |
| Носимые устройства | Ручной ввод, без фитнес-браслетов |
| Монетизация | Бесплатно для своих |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| KB-01 | Phase 2 | Complete |
| KB-02 | Phase 2 | Complete |
| KB-03 | Phase 2 | Complete |
| BOT-01 | Phase 3 | Complete |
| BOT-02 | Phase 3 | Complete |
| BOT-03 | Phase 3 | Complete |
| BOT-04 | Phase 4 | Complete |
| BOT-05 | Phase 4 | Pending |
| APP-01 | Phase 5 | Complete |
| APP-02 | Phase 5 | Complete |
| APP-03 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*
