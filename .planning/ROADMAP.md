# Roadmap: EnergyBot

## Overview

From scaffolding to a working Telegram bot that helps users track 4 types of energy, understand why each dropped, and get specific recovery recommendations. The journey goes: infrastructure foundation → knowledge base codification → bot check-in loop → intelligent diagnostics and recommendations → Mini App visualization.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure** - Project scaffolding, Telegram bot registration, database, AI API, and scheduler
- [ ] **Phase 2: Knowledge Base** - Codify the 4-energy methodology: recovery practices, drain factors, no-substitution rules
- [ ] **Phase 3: Bot Check-In Loop** - Morning/evening check-ins and on-demand energy logging via the bot
- [ ] **Phase 4: Bot Intelligence** - Energy diagnostics and personalized recovery recommendations powered by the knowledge base
- [ ] **Phase 5: Mini App** - Telegram Mini App with energy dashboard, history charts, and AI analytics

## Phase Details

### Phase 1: Infrastructure
**Goal**: A working project foundation where the bot is registered, reachable, data persists, AI API is connected, and scheduled jobs fire reliably
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A message sent to the bot in Telegram receives a response (even if just "hello")
  2. User data written to the database persists across bot restarts
  3. A call to the AI API (Claude/GPT) returns a response without errors
  4. The Mini App WebApp URL opens inside Telegram without errors
  5. Scheduler fires a test job at a configured time without manual trigger
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Project setup: TypeScript, dependencies, env config, database schema and persistence
- [x] 01-02-PLAN.md — Telegram Bot API + Mini App WebApp registration and connectivity
- [x] 01-03-PLAN.md — AI API (Anthropic Claude) service wrapper
- [ ] 01-04-PLAN.md — Cron scheduler service for periodic jobs

### Phase 2: Knowledge Base
**Goal**: The 4-energy methodology is fully encoded — every energy type has its recovery practices, drain factors, and substitution rules that the bot can query
**Depends on**: Phase 1
**Requirements**: KB-01, KB-02, KB-03
**Success Criteria** (what must be TRUE):
  1. For each of the 4 energy types, a query returns a list of proven recovery practices
  2. For each of the 4 energy types, a query returns a list of drain factors
  3. The system correctly rejects a cross-type substitution (e.g., physical burnout cannot be resolved with emotional recovery)
  4. Knowledge base content is accessible to bot logic without hardcoding in bot handlers
**Plans**: TBD

Plans:
- [ ] 02-01: Knowledge base structure and seeding (practices, drain factors, substitution rules)

### Phase 3: Bot Check-In Loop
**Goal**: Users interact with the bot daily — the bot asks about all 4 energies in the morning and evening, and users can log their energy state at any moment
**Depends on**: Phase 2
**Requirements**: BOT-01, BOT-02, BOT-03
**Success Criteria** (what must be TRUE):
  1. At a configured morning time, the bot sends each registered user a check-in asking to rate all 4 energies (1-10)
  2. At a configured evening time, the bot sends each registered user an end-of-day check-in
  3. A user can message the bot outside of scheduled times and log their current energy level for any of the 4 types
  4. All check-in responses are stored and associated with the correct user and timestamp
**Plans**: TBD

Plans:
- [ ] 03-01: Scheduled morning/evening check-in messages with 4-energy rating flow
- [ ] 03-02: On-demand energy logging command/conversation flow

### Phase 4: Bot Intelligence
**Goal**: The bot analyzes the user's energy history to diagnose which energy dropped and why, then delivers specific recovery recommendations from the knowledge base
**Depends on**: Phase 3
**Requirements**: BOT-04, BOT-05
**Success Criteria** (what must be TRUE):
  1. When a user's energy rating for a specific type drops, the bot identifies it and names the energy type that needs attention
  2. The bot surfaces a likely cause for the drop based on patterns in the user's history (not generic advice)
  3. The bot gives a recovery recommendation specific to the energy type that dropped (not a cross-type substitution)
  4. Recommendations come from the knowledge base methodology, not from unconstrained AI generation
**Plans**: TBD

Plans:
- [ ] 04-01: Energy diagnostics logic (detect drops, identify patterns)
- [ ] 04-02: Recommendation engine (knowledge base + AI personalization)

### Phase 5: Mini App
**Goal**: Users can open the Mini App inside Telegram to see a visual overview of all 4 energies, their history over time, and AI-generated pattern insights
**Depends on**: Phase 4
**Requirements**: APP-01, APP-02, APP-03
**Success Criteria** (what must be TRUE):
  1. Opening the Mini App shows current levels for all 4 energy types as a dashboard
  2. Users can view a chart of energy changes over the past week and month
  3. The Mini App displays AI-generated insights about personal energy patterns (e.g., "your mental energy consistently drops on days after late check-ins")
**Plans**: TBD

Plans:
- [ ] 05-01: Mini App scaffolding and energy dashboard (current levels)
- [ ] 05-02: History charts (week/month view)
- [ ] 05-03: AI analytics panel with pattern insights

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 3/4 | In Progress|  |
| 2. Knowledge Base | 0/1 | Not started | - |
| 3. Bot Check-In Loop | 0/2 | Not started | - |
| 4. Bot Intelligence | 0/2 | Not started | - |
| 5. Mini App | 0/3 | Not started | - |
