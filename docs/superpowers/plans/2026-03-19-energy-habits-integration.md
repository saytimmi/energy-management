# Energy + Habits Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace slow AI recommendations with instant knowledge-base actions, add a full habit tracker with meaning framework and lifecycle stages, and integrate habits into the Mini App.

**Architecture:** Four sequential phases. Phase A rewrites the knowledge base and post-checkin flow (backend only). Phase B adds Habit models, API, and bot handlers. Phase C builds the Mini App frontend (new Habits tab, modified Energy/Hub/Journal). Phase D adds intelligence (correlation, smart timing). Each phase produces a working, deployable increment.

**Tech Stack:** TypeScript, Prisma + PostgreSQL, Express, Grammy, Preact + Signals, CSS animations, Telegram HapticFeedback, node-cron.

**Spec:** `docs/superpowers/specs/2026-03-19-energy-habits-integration-design.md`

---

## Chunk 1: Phase A — Knowledge Base + Instant Post-Checkin

### Task 1: New MicroAction types and data structure

**Files:**
- Modify: `src/knowledge/types.ts`
- Create: `src/knowledge/micro-actions.ts`
- Create: `src/knowledge/energy-facts.ts`
- Test: `src/__tests__/micro-actions.test.ts`

- [ ] **Step 1: Add MicroAction interface to types.ts**

Add after existing interfaces in `src/knowledge/types.ts`:

```typescript
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type ActionContext = 'home' | 'work' | 'outside' | 'anywhere';
export type ActionIntensity = 'micro' | 'regular' | 'deep';

export interface MicroAction {
  id: string;
  name: string;
  description: string;
  energyType: EnergyType;
  duration: 1 | 2 | 5 | 15 | 30;
  timeOfDay: TimeOfDay[];
  context: ActionContext[];
  intensity: ActionIntensity;
  science: string;
  crossTypeBonus?: EnergyType[];
  canBeHabit: boolean;
  habitSuggestion?: string;
}

export interface EnergyFact {
  id: string;
  text: string;
  category: 'low' | 'high';
  energyTypes: EnergyType[];
}
```

- [ ] **Step 2: Write failing tests for micro-actions**

Create `src/__tests__/micro-actions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EnergyType } from '../knowledge/types';
import { getMicroActions, getEnergyFacts } from '../knowledge/micro-actions';
import { ENERGY_FACTS } from '../knowledge/energy-facts';

describe('MicroActions', () => {
  it('has 10 actions per energy type', () => {
    for (const type of Object.values(EnergyType)) {
      const actions = getMicroActions(type);
      expect(actions.length).toBe(10);
      actions.forEach(a => expect(a.energyType).toBe(type));
    }
  });

  it('every action has required fields', () => {
    for (const type of Object.values(EnergyType)) {
      for (const action of getMicroActions(type)) {
        expect(action.id).toBeTruthy();
        expect(action.name).toBeTruthy();
        expect(action.description).toBeTruthy();
        expect(action.science).toBeTruthy();
        expect(action.timeOfDay.length).toBeGreaterThan(0);
        expect(action.context.length).toBeGreaterThan(0);
        expect([1, 2, 5, 15, 30]).toContain(action.duration);
        expect(['micro', 'regular', 'deep']).toContain(action.intensity);
      }
    }
  });

  it('filters by time of day', () => {
    const morning = getMicroActions(EnergyType.physical, { timeOfDay: 'morning' });
    expect(morning.length).toBeGreaterThan(0);
    morning.forEach(a => expect(a.timeOfDay).toContain('morning'));
  });

  it('sorts micro intensity first', () => {
    const actions = getMicroActions(EnergyType.physical);
    const microIdx = actions.findIndex(a => a.intensity === 'micro');
    const deepIdx = actions.findIndex(a => a.intensity === 'deep');
    if (microIdx !== -1 && deepIdx !== -1) {
      expect(microIdx).toBeLessThan(deepIdx);
    }
  });
});

describe('EnergyFacts', () => {
  it('has at least 10 low and 5 high facts', () => {
    const low = ENERGY_FACTS.filter(f => f.category === 'low');
    const high = ENERGY_FACTS.filter(f => f.category === 'high');
    expect(low.length).toBeGreaterThanOrEqual(10);
    expect(high.length).toBeGreaterThanOrEqual(5);
  });

  it('every fact has required fields', () => {
    for (const fact of ENERGY_FACTS) {
      expect(fact.id).toBeTruthy();
      expect(fact.text).toBeTruthy();
      expect(['low', 'high']).toContain(fact.category);
      expect(fact.energyTypes.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/micro-actions.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 4: Create energy-facts.ts with 20 science-backed facts**

Create `src/knowledge/energy-facts.ts` with all 20 facts from the research. Each fact:
- Has a unique `id`
- `category`: 'low' (shown when energy is low) or 'high' (shown when all energies good)
- `energyTypes`: which energy types this fact is most relevant to
- Text in Russian, punchy, with mechanism

```typescript
import { EnergyType } from './types.js';
import type { EnergyFact } from './types.js';

export const ENERGY_FACTS: EnergyFact[] = [
  // LOW — shown when energy drops
  {
    id: 'cortisol-walk-21',
    text: '20 минут на улице снижают кортизол на 21% в час. Движение — не роскошь, а биохимия восстановления.',
    category: 'low',
    energyTypes: [EnergyType.physical, EnergyType.mental],
  },
  {
    id: 'sigh-stanford',
    text: 'Двойной вдох носом + длинный выдох — самый быстрый способ переключить нервную систему. 30 секунд (Stanford).',
    category: 'low',
    energyTypes: [EnergyType.emotional, EnergyType.mental],
  },
  {
    id: 'dehydration-cognition',
    text: '1-2% обезвоживания уже снижает память и внимание. Один стакан воды = когнитивная перезагрузка.',
    category: 'low',
    energyTypes: [EnergyType.physical, EnergyType.mental],
  },
  {
    id: 'exercise-snacks-48',
    text: 'Exercise snacks по 1-2 минуты 3 раза в день снижают кардио-риск на 48%. Лестница — это уже тренировка.',
    category: 'low',
    energyTypes: [EnergyType.physical],
  },
  {
    id: 'nap-nasa-54',
    text: '26-минутный сон повышает бдительность на 54% и производительность на 34% (NASA). Послеобеденный провал — не лень, а биология.',
    category: 'low',
    energyTypes: [EnergyType.physical, EnergyType.mental],
  },
  {
    id: 'affect-labeling-50',
    text: 'Назвать эмоцию вслух ("я злюсь") снижает активность миндалины на 50%. Слово = уже половина решения.',
    category: 'low',
    energyTypes: [EnergyType.emotional],
  },
  {
    id: 'sunlight-circadian',
    text: 'Утренний свет 5-10 минут запускает 50%+ всплеск кортизола для бодрости И улучшает сон ночью. Бесплатный препарат.',
    category: 'low',
    energyTypes: [EnergyType.physical],
  },
  {
    id: 'brain-20-percent',
    text: 'Мозг — 2% массы тела, но потребляет 20% энергии. Ментальная усталость — не лень, а физический дефицит ресурса.',
    category: 'low',
    energyTypes: [EnergyType.mental],
  },
  {
    id: 'dive-reflex',
    text: 'Холодная вода на лицо 15 секунд запускает dive reflex: пульс падает, нервная система мгновенно переключается.',
    category: 'low',
    energyTypes: [EnergyType.emotional, EnergyType.physical],
  },
  {
    id: 'laughter-cortisol-39',
    text: 'Смех снижает кортизол на 39% и повышает NK-клетки иммунитета. Юмор — это не развлечение, а инструмент восстановления.',
    category: 'low',
    energyTypes: [EnergyType.emotional],
  },
  {
    id: 'sleep-atp',
    text: 'Сон пополняет ATP (клеточную энергию) мозга. Без сна мозг буквально работает на пустом баке.',
    category: 'low',
    energyTypes: [EnergyType.physical, EnergyType.mental],
  },
  {
    id: 'hug-oxytocin',
    text: '20-секундное объятие высвобождает окситоцин и измеримо снижает давление и кортизол. Прикосновение — это лекарство.',
    category: 'low',
    energyTypes: [EnergyType.emotional],
  },
  {
    id: 'helper-high',
    text: 'Помощь другому на 5 минут вызывает "helper\'s high" — выброс эндорфинов, сравнимый с тренировкой. Отдавая — восстанавливаешься.',
    category: 'low',
    energyTypes: [EnergyType.spiritual],
  },
  // HIGH — shown when all energies are good
  {
    id: 'identity-habits-2.7x',
    text: 'Люди с привычками-идентичностью ("я тот, кто следит за энергией") удерживают их в 2.7 раза чаще. Ты уже это делаешь.',
    category: 'high',
    energyTypes: [EnergyType.physical, EnergyType.mental, EnergyType.emotional, EnergyType.spiritual],
  },
  {
    id: 'morning-habits-stronger',
    text: 'Утренние привычки формируются быстрее и крепче остальных (мета-анализ 2024). Твоя утренняя рутина — самый ценный актив.',
    category: 'high',
    energyTypes: [EnergyType.physical, EnergyType.mental],
  },
  {
    id: 'habit-stacking-64',
    text: 'Привязка новой привычки к существующей ("после кофе — 5 приседаний") даёт +64% успеха. Стек > сила воли.',
    category: 'high',
    energyTypes: [EnergyType.physical, EnergyType.mental, EnergyType.emotional, EnergyType.spiritual],
  },
  {
    id: 'consistency-beats-perfection',
    text: '85% consistency даёт почти такие же результаты как 100%, но в разы устойчивее. Не идеально, а стабильно.',
    category: 'high',
    energyTypes: [EnergyType.physical, EnergyType.mental, EnergyType.emotional, EnergyType.spiritual],
  },
  {
    id: 'habit-59-days',
    text: 'Привычка формируется за 59-154 дня, не за 21 (мета-анализ 2024, 2601 человек). Терпение — не опция, а наука.',
    category: 'high',
    energyTypes: [EnergyType.physical, EnergyType.mental, EnergyType.emotional, EnergyType.spiritual],
  },
  {
    id: 'few-habits-succeed',
    text: 'Люди с 1-3 привычками справляются. С 7+ — проваливают почти все. Меньше = больше.',
    category: 'high',
    energyTypes: [EnergyType.physical, EnergyType.mental, EnergyType.emotional, EnergyType.spiritual],
  },
  {
    id: 'brain-energy-5-percent',
    text: 'Мозг тратит лишь на 5% больше энергии при сложной работе vs отдыхе. Ментальная усталость — это истощение внимания, не калорий. Восстановление > еда.',
    category: 'high',
    energyTypes: [EnergyType.mental],
  },
];
```

- [ ] **Step 5: Create micro-actions.ts with 40 actions (10 per type)**

Create `src/knowledge/micro-actions.ts` with full content. Use the research data for all 4 types. Each type gets 10 actions sorted: micro first, then regular, then deep.

Export `getMicroActions(type, options?)` that:
- Returns all actions for a type
- Optional filter: `{ timeOfDay?: TimeOfDay }`
- Always sorted: micro → regular → deep

```typescript
import { EnergyType } from './types.js';
import type { MicroAction, TimeOfDay } from './types.js';

const MICRO_ACTIONS = new Map<EnergyType, MicroAction[]>([
  [EnergyType.physical, [
    // 10 physical actions — micro first, then regular, then deep
    { id: 'pushups-10', name: '10 отжиманий', description: 'Упади и сделай 10. От стены, если тяжело. Кровь побежит через 30 секунд.', energyType: EnergyType.physical, duration: 2, timeOfDay: ['anytime'], context: ['home', 'work'], intensity: 'micro', science: 'Кровоток ↑ → эндорфины → активация симпатики', canBeHabit: true, habitSuggestion: 'После утреннего кофе — 10 отжиманий' },
    { id: 'stairs-3', name: '3 пролёта лестницы быстро', description: 'Найди лестницу и вверх. Быстро. Одышка = сигнал что работает.', energyType: EnergyType.physical, duration: 2, timeOfDay: ['morning', 'afternoon'], context: ['work', 'home'], intensity: 'micro', science: 'VO2 ↑; 1-2 мин vigorous = −48% кардио-риска', canBeHabit: true, habitSuggestion: 'Перед обедом — 3 пролёта лестницы' },
    { id: 'water-breathe', name: 'Стакан воды + 10 глубоких вдохов', description: 'Прямо сейчас. Вода + кислород — два базовых ресурса тела.', energyType: EnergyType.physical, duration: 2, timeOfDay: ['morning'], context: ['anywhere'], intensity: 'micro', science: '−1-2% воды = −когниция; глубокие вдохи оксигенируют', canBeHabit: true, habitSuggestion: 'Сразу после пробуждения — стакан воды' },
    { id: 'cold-face', name: 'Холодная вода на лицо', description: '15 секунд холодной воды на лицо. Мгновенное пробуждение.', energyType: EnergyType.physical, duration: 1, timeOfDay: ['afternoon'], context: ['home', 'work'], intensity: 'micro', science: 'Dive reflex: вагус → пульс ↓ → мгновенная бодрость', crossTypeBonus: [EnergyType.emotional], canBeHabit: false },
    { id: 'chair-squats-5', name: '5 приседаний у стула + 5 подъёмов на носки', description: 'Встал, 5 приседаний, 5 подъёмов на носки. Сел обратно. 60 секунд.', energyType: EnergyType.physical, duration: 2, timeOfDay: ['afternoon'], context: ['work'], intensity: 'micro', science: 'Exercise snack: глюкоза ↓, сидячий вред ↓', canBeHabit: true, habitSuggestion: 'Между встречами — 5 приседаний' },
    { id: 'dance-1-song', name: 'Потанцуй под 1 песню', description: 'Включи любимый трек и двигайся 3 минуты. Дофамин + кардио.', energyType: EnergyType.physical, duration: 5, timeOfDay: ['morning', 'evening'], context: ['home'], intensity: 'regular', science: 'Кардио + дофамин (музыка) + эмоц. подъём', crossTypeBonus: [EnergyType.emotional], canBeHabit: true, habitSuggestion: 'Утром после душа — 1 песня с танцем' },
    { id: 'stretch-5min', name: '5-минутная растяжка', description: 'Шея, плечи, бёдра. Медленно, с дыханием. Тело скажет спасибо.', energyType: EnergyType.physical, duration: 5, timeOfDay: ['afternoon', 'evening'], context: ['home', 'work'], intensity: 'regular', science: 'Снимает мышечное напряжение, парасимпатика через медленное движение', canBeHabit: true, habitSuggestion: 'В 15:00 — 5 минут растяжки' },
    { id: 'sunlight-10min', name: 'Утренний свет 10 минут', description: 'Выйди на свет в первый час после пробуждения. Без очков. Не в телефон.', energyType: EnergyType.physical, duration: 15, timeOfDay: ['morning'], context: ['outside'], intensity: 'regular', science: 'Циркадный ресет: серотонин ↑, мелатонин подготовка, кортизол awakening', crossTypeBonus: [EnergyType.mental], canBeHabit: true, habitSuggestion: 'Сразу после пробуждения — на свет' },
    { id: 'walk-15min', name: 'Прогулка 15 минут', description: 'Выйди и иди. Без цели, без телефона. 15 минут — и кортизол тает.', energyType: EnergyType.physical, duration: 15, timeOfDay: ['anytime'], context: ['outside'], intensity: 'regular', science: '−21% кортизола/час; BDNF ↑; метаболизм глюкозы ↑', crossTypeBonus: [EnergyType.mental, EnergyType.emotional], canBeHabit: true, habitSuggestion: 'После обеда — 15 минут на улице' },
    { id: 'power-nap', name: 'Power nap 15 минут', description: 'Поставь таймер на 15 минут. Ляг. Закрой глаза. Даже если не уснёшь — мозг отдохнёт.', energyType: EnergyType.physical, duration: 15, timeOfDay: ['afternoon'], context: ['home', 'work'], intensity: 'regular', science: 'NASA: +54% alertness, +34% performance; ATP восполнение', crossTypeBonus: [EnergyType.mental], canBeHabit: true, habitSuggestion: 'В 13:00-14:00 — 15 минут power nap' },
  ]],

  [EnergyType.mental, [
    { id: 'look-at-nature', name: 'Посмотри на дерево 2 минуты', description: 'Найди дерево или растение за окном. Смотри 2 минуты. Ничего не делай.', energyType: EnergyType.mental, duration: 2, timeOfDay: ['anytime'], context: ['work', 'home'], intensity: 'micro', science: 'Attention Restoration Theory: мягкий фокус восстанавливает направленное внимание', canBeHabit: false },
    { id: 'breathing-478', name: 'Дыхание 4-7-8, 3 цикла', description: 'Вдох 4 сек, задержка 7, выдох 8. Три раза. Мозг переключится.', energyType: EnergyType.mental, duration: 2, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'micro', science: 'Активация префронтальной коры, снижение DMN-шума', crossTypeBonus: [EnergyType.emotional], canBeHabit: true, habitSuggestion: 'Перед каждой важной задачей — 3 цикла 4-7-8' },
    { id: 'write-3-priorities', name: 'Выпиши 3 приоритета на 2 часа', description: 'Бумага или заметка. 3 вещи на ближайшие 2 часа. Остальное — бонус.', energyType: EnergyType.mental, duration: 2, timeOfDay: ['morning', 'afternoon'], context: ['work'], intensity: 'micro', science: 'Разгрузка рабочей памяти (эффект Зейгарник), фокус префронтальной коры', canBeHabit: true, habitSuggestion: 'В начале рабочего дня — 3 приоритета' },
    { id: 'walk-no-phone', name: 'Прогулка 5 мин без телефона', description: 'Оставь телефон. Выйди. 5 минут. Глаза на горизонт.', energyType: EnergyType.mental, duration: 5, timeOfDay: ['afternoon'], context: ['outside'], intensity: 'regular', science: 'Природа + движение: двойное восстановление рабочей памяти', crossTypeBonus: [EnergyType.physical], canBeHabit: true, habitSuggestion: 'После обеда — 5 минут без телефона на улице' },
    { id: 'instrumental-music', name: 'Инструментальная музыка 5 мин', description: 'Надень наушники. Без слов — только инструменты. Закрой глаза.', energyType: EnergyType.mental, duration: 5, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'regular', science: 'Снижает когнитивную интерференцию; бинауральные ритмы ↑ альфа-волны', canBeHabit: false },
    { id: 'puzzle-1-round', name: '1 раунд словесной игры', description: 'Wordle, кроссворд, судоку — 5 минут. Мозг переключится на другую задачу.', energyType: EnergyType.mental, duration: 5, timeOfDay: ['afternoon'], context: ['anywhere'], intensity: 'regular', science: 'Когнитивное переключение восстанавливает утомлённые attention networks', canBeHabit: false },
    { id: 'teach-1-thing', name: 'Расскажи кому-то 1 вещь', description: 'Что узнал сегодня? Расскажи коллеге или другу. 5 минут.', energyType: EnergyType.mental, duration: 5, timeOfDay: ['evening'], context: ['work', 'home'], intensity: 'regular', science: 'Protégé effect: обучение консолидирует знания, перезаряжает ментальные модели', canBeHabit: true, habitSuggestion: 'Вечером — расскажи 1 инсайт дня' },
    { id: 'nature-20min', name: '20 минут в парке/зелени', description: 'Парк, сквер, сад — 20 минут. Без телефона. Просто будь.', energyType: EnergyType.mental, duration: 15, timeOfDay: ['afternoon'], context: ['outside'], intensity: 'regular', science: '−21.3% кортизола/час (Frontiers 2019); восстановление направленного внимания', crossTypeBonus: [EnergyType.physical, EnergyType.emotional], canBeHabit: true, habitSuggestion: 'В обед — 20 минут в парке' },
    { id: 'pomodoro-25', name: '25 минут глубокой работы', description: 'Телефон в режим полёта. 25 минут одной задачи. Потом перерыв.', energyType: EnergyType.mental, duration: 30, timeOfDay: ['morning'], context: ['work'], intensity: 'deep', science: 'Снижает attention residue; deep work восстанавливает чувство компетентности', canBeHabit: true, habitSuggestion: 'Первый час работы — 25 мин deep work без телефона' },
    { id: 'digital-sunset', name: 'Без экранов 30 мин перед сном', description: 'За полчаса до сна — убери все экраны. Книга, разговор, тишина.', energyType: EnergyType.mental, duration: 30, timeOfDay: ['evening'], context: ['home'], intensity: 'deep', science: 'Защита мелатонина, снижение когнитивного возбуждения, качество сна ↑', canBeHabit: true, habitSuggestion: 'В 22:00 — убрать все экраны' },
  ]],

  [EnergyType.emotional, [
    { id: 'physiological-sigh', name: 'Двойной вдох + длинный выдох, 3 раза', description: 'Два коротких вдоха носом, один длинный выдох ртом. 3 раза. 30 секунд.', energyType: EnergyType.emotional, duration: 1, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'micro', science: 'Stanford: самый быстрый real-time сброс стресса; вагус → парасимпатика', crossTypeBonus: [EnergyType.physical], canBeHabit: true, habitSuggestion: 'При любом стрессе — двойной вдох' },
    { id: 'name-emotion', name: 'Назови эмоцию вслух', description: '"Я замечаю, что сейчас чувствую ___". Скажи вслух или напиши.', energyType: EnergyType.emotional, duration: 1, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'micro', science: 'Affect labeling: −50% активности миндалины (Lieberman, UCLA)', canBeHabit: false },
    { id: 'box-breathing', name: 'Box breathing 4-4-4-4, 5 раз', description: 'Вдох 4, задержка 4, выдох 4, задержка 4. Пять циклов. Две минуты.', energyType: EnergyType.emotional, duration: 2, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'micro', science: 'Протокол Navy SEALs; парасимпатическая активация', canBeHabit: true, habitSuggestion: 'Перед сложным разговором — box breathing' },
    { id: 'text-close-person', name: 'Напиши близкому что-то настоящее', description: 'Не "как дела". Что-то настоящее. "Думаю о тебе" или "спасибо за...".', energyType: EnergyType.emotional, duration: 2, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'micro', science: 'Социальная связь — сильнейший предиктор счастья и долголетия (Harvard)', canBeHabit: true, habitSuggestion: 'Каждый вечер — одно настоящее сообщение' },
    { id: 'gratitude-3', name: '3 благодарности с деталями', description: 'Запиши 3 конкретные вещи, за которые благодарен. С деталями — не "семья", а "как дочка засмеялась за завтраком".', energyType: EnergyType.emotional, duration: 5, timeOfDay: ['morning', 'evening'], context: ['home', 'work'], intensity: 'regular', science: 'Активация reward circuits, серотонин ↑, дофамин ↑, качество сна ↑', canBeHabit: true, habitSuggestion: 'Перед сном — 3 благодарности' },
    { id: 'body-scan-5min', name: 'Сканирование тела 5 минут', description: 'Закрой глаза. Медленно пройдись вниманием от макушки до пяток. Где зажим? Отпусти.', energyType: EnergyType.emotional, duration: 5, timeOfDay: ['afternoon', 'evening'], context: ['home', 'work'], intensity: 'regular', science: 'Reconnects mind-body; снимает соматические паттерны стресса', canBeHabit: true, habitSuggestion: 'В 15:00 — 5 минут body scan' },
    { id: 'laugh-5min', name: 'Посмотри/прочитай что-то смешное', description: '5 минут чистого юмора. Мемы, стендап, смешное видео. Без вины.', energyType: EnergyType.emotional, duration: 5, timeOfDay: ['afternoon'], context: ['anywhere'], intensity: 'regular', science: 'Смех: −39% кортизола, ↑ эндорфины, ↑ NK-клетки иммунитета', canBeHabit: false },
    { id: 'brain-dump', name: 'Brain dump — выгрузи всё на бумагу', description: 'Всё что тревожит — на бумагу. Без фильтра, без структуры. 5 минут.', energyType: EnergyType.emotional, duration: 5, timeOfDay: ['evening'], context: ['home', 'work'], intensity: 'regular', science: 'Экстернализация руминации, разгрузка рабочей памяти от эмоц. процессинга', crossTypeBonus: [EnergyType.mental], canBeHabit: true, habitSuggestion: 'Перед сном — brain dump 5 минут' },
    { id: 'hug-20sec', name: 'Обними кого-то на 20 секунд', description: 'Не быстрое касание — полноценные 20 секунд. Тело начнёт расслабляться.', energyType: EnergyType.emotional, duration: 1, timeOfDay: ['morning', 'evening'], context: ['home'], intensity: 'micro', science: 'Окситоцин ↑, кортизол ↓, давление ↓', canBeHabit: true, habitSuggestion: 'Утром и вечером — обнять близкого' },
    { id: 'cold-face-emotional', name: 'Холодная вода на лицо и запястья', description: 'Когда эмоции зашкаливают — 15 секунд холодной воды. Мгновенный ресет.', energyType: EnergyType.emotional, duration: 1, timeOfDay: ['anytime'], context: ['home', 'work'], intensity: 'micro', science: 'Mammalian dive reflex: пульс ↓, нервная система ресет за 15 сек', crossTypeBonus: [EnergyType.physical], canBeHabit: false },
  ]],

  [EnergyType.spiritual, [
    { id: 'why-matters', name: '"Зачем это важно?" — 1 предложение', description: 'То, чем сейчас занят — зачем? Напиши одно предложение, связывающее с ценностями.', energyType: EnergyType.spiritual, duration: 2, timeOfDay: ['morning'], context: ['work'], intensity: 'micro', science: 'Purpose priming: вентромедиальная ПФК ↑, persistence ↑', canBeHabit: true, habitSuggestion: 'В начале дня — "зачем я это делаю?"' },
    { id: 'look-at-sky', name: 'Посмотри на небо 2 минуты', description: 'Остановись. Подними глаза. Небо, облака, звёзды. 2 минуты тишины.', energyType: EnergyType.spiritual, duration: 2, timeOfDay: ['anytime'], context: ['outside'], intensity: 'micro', science: 'Awe experience: ↓ self-focus, ↑ чувство связи с чем-то большим', canBeHabit: false },
    { id: 'peak-memory', name: 'Вспомни пиковый момент жизни', description: 'Закрой глаза. Вспомни момент когда ты чувствовал "вот ради этого". 2 минуты.', energyType: EnergyType.spiritual, duration: 2, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'micro', science: 'Автобиографическая память о смысле активирует reward + identity circuits', canBeHabit: false },
    { id: 'silent-sitting-5min', name: '5 минут тишины', description: 'Сядь. Закрой глаза. Дыши. Ничего не делай. 5 минут.', energyType: EnergyType.spiritual, duration: 5, timeOfDay: ['morning', 'evening'], context: ['home', 'work'], intensity: 'regular', science: 'Медитация: ↑ ПФК активация, ↓ DMN блуждание', crossTypeBonus: [EnergyType.mental], canBeHabit: true, habitSuggestion: 'Утром после пробуждения — 5 минут тишины' },
    { id: 'read-1-page', name: '1 страница глубокой книги', description: 'Философия, поэзия, мудрость. Одна страница. Не скроллинг — книга.', energyType: EnergyType.spiritual, duration: 5, timeOfDay: ['morning', 'evening'], context: ['home'], intensity: 'regular', science: 'Engagement с трансцендентными идеями активирует meaning-making circuits', canBeHabit: true, habitSuggestion: 'Перед сном — 1 страница глубокой книги' },
    { id: 'help-someone', name: 'Помоги кому-то в малом', description: 'Сегодня — одна маленькая помощь. Коллеге, незнакомцу, близкому.', energyType: EnergyType.spiritual, duration: 5, timeOfDay: ['anytime'], context: ['work', 'home'], intensity: 'regular', science: 'Helper\'s high: эндорфины ↑, чувство значимости ↑', crossTypeBonus: [EnergyType.emotional], canBeHabit: true, habitSuggestion: 'Каждый день — 1 маленькая помощь' },
    { id: 'frisson-music', name: 'Музыка, от которой мурашки', description: 'Та самая музыка. Наушники. Громко. 5 минут чистого кайфа.', energyType: EnergyType.spiritual, duration: 5, timeOfDay: ['anytime'], context: ['anywhere'], intensity: 'regular', science: 'Frisson: дофамин в anticipation circuits; трансцендентный эмоциональный опыт', crossTypeBonus: [EnergyType.emotional], canBeHabit: false },
    { id: 'appreciation-letter', name: 'Напиши 3 предложения благодарности кому-то', description: 'Не обязательно отправлять. Просто напиши кому и за что. 5 минут.', energyType: EnergyType.spiritual, duration: 5, timeOfDay: ['evening'], context: ['home', 'work'], intensity: 'regular', science: 'Активация gratitude + empathy networks; укрепление социальных связей', crossTypeBonus: [EnergyType.emotional], canBeHabit: true, habitSuggestion: 'Вечером — 3 предложения благодарности' },
    { id: 'walk-what-matters', name: 'Прогулка с вопросом "что сейчас важно?"', description: '10 минут. Иди и думай об одном: что сейчас по-настоящему важно?', energyType: EnergyType.spiritual, duration: 15, timeOfDay: ['morning', 'evening'], context: ['outside'], intensity: 'regular', science: 'Walking meditation + экзистенциальная рефлексия: движение + смысл', crossTypeBonus: [EnergyType.physical, EnergyType.mental], canBeHabit: true, habitSuggestion: 'Утром — 10 мин прогулка с вопросом' },
    { id: 'gratitude-learned', name: '"Чему я благодарен за эту неделю?"', description: 'Раз в неделю. Что узнал, чему научился, что получил. Напиши.', energyType: EnergyType.spiritual, duration: 5, timeOfDay: ['evening'], context: ['home'], intensity: 'regular', science: 'Gratitude + growth reflection; reinforces learning identity', canBeHabit: true, habitSuggestion: 'В воскресенье вечером — благодарность за неделю' },
  ]],
]);

export function getMicroActions(
  type: EnergyType,
  options?: { timeOfDay?: TimeOfDay },
): MicroAction[] {
  const actions = MICRO_ACTIONS.get(type) ?? [];
  if (!options?.timeOfDay) return actions;
  return actions.filter(
    a => a.timeOfDay.includes(options.timeOfDay!) || a.timeOfDay.includes('anytime'),
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/__tests__/micro-actions.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/knowledge/types.ts src/knowledge/micro-actions.ts src/knowledge/energy-facts.ts src/__tests__/micro-actions.test.ts
git commit -m "feat: add MicroAction knowledge base with 40 evidence-based actions + 20 energy facts"
```

---

### Task 2: Instant recommendations engine

**Files:**
- Create: `src/services/instant-recommendations.ts`
- Test: `src/__tests__/instant-recommendations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/instant-recommendations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EnergyType } from '../knowledge/types';
import { getInstantRecommendations, type EnergyValues } from '../services/instant-recommendations';

describe('getInstantRecommendations', () => {
  it('returns actions for energies <= 6', () => {
    const values: EnergyValues = { physical: 4, mental: 7, emotional: 5, spiritual: 8 };
    const result = getInstantRecommendations(values, 'afternoon');
    expect(result.recommendations.length).toBeGreaterThan(0);
    const types = result.recommendations.map(r => r.energyType);
    expect(types).toContain(EnergyType.physical);
    expect(types).toContain(EnergyType.emotional);
    expect(types).not.toContain(EnergyType.mental);
  });

  it('returns max 2 energy types even if 3+ are low', () => {
    const values: EnergyValues = { physical: 3, mental: 4, emotional: 5, spiritual: 2 };
    const result = getInstantRecommendations(values, 'morning');
    const uniqueTypes = new Set(result.recommendations.map(r => r.energyType));
    expect(uniqueTypes.size).toBeLessThanOrEqual(2);
  });

  it('returns max 4 recommendations total', () => {
    const values: EnergyValues = { physical: 3, mental: 4, emotional: 2, spiritual: 1 };
    const result = getInstantRecommendations(values, 'morning');
    expect(result.recommendations.length).toBeLessThanOrEqual(4);
  });

  it('returns congratulation when all >= 7', () => {
    const values: EnergyValues = { physical: 8, mental: 7, emotional: 9, spiritual: 7 };
    const result = getInstantRecommendations(values, 'morning');
    expect(result.recommendations.length).toBe(0);
    expect(result.allGood).toBe(true);
  });

  it('includes one energy fact', () => {
    const values: EnergyValues = { physical: 4, mental: 7, emotional: 5, spiritual: 8 };
    const result = getInstantRecommendations(values, 'afternoon');
    expect(result.fact).toBeTruthy();
    expect(result.fact!.text.length).toBeGreaterThan(0);
  });

  it('filters by time of day', () => {
    const values: EnergyValues = { physical: 4, mental: 7, emotional: 8, spiritual: 8 };
    const morning = getInstantRecommendations(values, 'morning');
    const evening = getInstantRecommendations(values, 'evening');
    // Different time of day may yield different actions
    expect(morning.recommendations.length).toBeGreaterThan(0);
    expect(evening.recommendations.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/instant-recommendations.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement instant-recommendations.ts**

Create `src/services/instant-recommendations.ts`:

```typescript
import { EnergyType } from '../knowledge/types.js';
import type { MicroAction, EnergyFact, TimeOfDay } from '../knowledge/types.js';
import { getMicroActions } from '../knowledge/micro-actions.js';
import { ENERGY_FACTS } from '../knowledge/energy-facts.js';

export interface EnergyValues {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
}

interface RecommendationResult {
  recommendations: MicroAction[];
  fact: EnergyFact | null;
  allGood: boolean;
  suggestIds: string[]; // MicroAction IDs for deep link
}

const THRESHOLD = 6;
const MAX_TYPES = 2;
const MAX_PER_TYPE = 2;

// In-memory fact dedup (resets on deploy — acceptable)
const shownFacts = new Map<number, string[]>();

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function pickFact(
  category: 'low' | 'high',
  dominantType: EnergyType,
  telegramId?: number,
): EnergyFact | null {
  let pool = ENERGY_FACTS.filter(
    f => f.category === category && f.energyTypes.includes(dominantType),
  );
  if (pool.length === 0) {
    pool = ENERGY_FACTS.filter(f => f.category === category);
  }
  if (pool.length === 0) return null;

  // Dedup
  const shown = telegramId ? (shownFacts.get(telegramId) ?? []) : [];
  const unseen = pool.filter(f => !shown.includes(f.id));
  const candidates = unseen.length > 0 ? unseen : pool;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  if (telegramId) {
    const updated = [...shown, picked.id].slice(-20); // keep last 20
    shownFacts.set(telegramId, updated);
  }

  return picked;
}

export function getInstantRecommendations(
  values: EnergyValues,
  timeOfDay?: TimeOfDay,
  telegramId?: number,
): RecommendationResult {
  const tod = timeOfDay ?? getTimeOfDay();

  const energyEntries: { type: EnergyType; value: number }[] = [
    { type: EnergyType.physical, value: values.physical },
    { type: EnergyType.mental, value: values.mental },
    { type: EnergyType.emotional, value: values.emotional },
    { type: EnergyType.spiritual, value: values.spiritual },
  ];

  const lowEnergies = energyEntries
    .filter(e => e.value <= THRESHOLD)
    .sort((a, b) => a.value - b.value)
    .slice(0, MAX_TYPES);

  if (lowEnergies.length === 0) {
    const lowestType = energyEntries.sort((a, b) => a.value - b.value)[0].type;
    return {
      recommendations: [],
      fact: pickFact('high', lowestType, telegramId),
      allGood: true,
      suggestIds: [],
    };
  }

  const recommendations: MicroAction[] = [];
  const suggestIds: string[] = [];

  for (const low of lowEnergies) {
    const actions = getMicroActions(low.type, { timeOfDay: tod });

    // Prioritize cross-type bonus
    const otherLowTypes = lowEnergies
      .filter(e => e.type !== low.type)
      .map(e => e.type);

    const sorted = [...actions].sort((a, b) => {
      const aBonus = a.crossTypeBonus?.some(t => otherLowTypes.includes(t)) ? -1 : 0;
      const bBonus = b.crossTypeBonus?.some(t => otherLowTypes.includes(t)) ? -1 : 0;
      return aBonus - bBonus;
    });

    const picked = sorted.slice(0, MAX_PER_TYPE);
    recommendations.push(...picked);
    suggestIds.push(...picked.filter(a => a.canBeHabit).map(a => a.id));
  }

  const dominantType = lowEnergies[0].type;

  return {
    recommendations,
    fact: pickFact('low', dominantType, telegramId),
    allGood: false,
    suggestIds,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/__tests__/instant-recommendations.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/instant-recommendations.ts src/__tests__/instant-recommendations.test.ts
git commit -m "feat: add instant recommendations engine — zero AI, time-of-day aware"
```

---

### Task 3: Replace AI recommendations in checkin handler

**Files:**
- Modify: `src/handlers/checkin.ts:126-177`
- Modify: `src/knowledge/index.ts` (add re-exports)
- Modify: `src/server.ts` (CORS methods)

- [ ] **Step 1: Update knowledge/index.ts to re-export new modules**

Add to `src/knowledge/index.ts`:

```typescript
export { getMicroActions } from './micro-actions.js';
export { ENERGY_FACTS } from './energy-facts.js';
export type { MicroAction, EnergyFact, TimeOfDay, ActionContext, ActionIntensity } from './types.js';
```

- [ ] **Step 2: Rewrite the post-checkin follow-up in checkin.ts**

In `src/handlers/checkin.ts`, replace the block after `pendingCheckIns.delete(telegramId)` (lines ~126-177) with:

```typescript
    pendingCheckIns.delete(telegramId);

    // Format energy values message
    const ENERGY_EMOJIS: Record<string, string> = {
      physical: '🏃', mental: '🧠', emotional: '💛', spiritual: '✨',
    };

    let followUp = `✅ Записал!\n${ENERGY_EMOJIS.physical} Физическая: ${pending.physical}  ${ENERGY_EMOJIS.mental} Ментальная: ${pending.mental}  ${ENERGY_EMOJIS.emotional} Эмоциональная: ${pending.emotional}  ${ENERGY_EMOJIS.spiritual} Духовная: ${pending.spiritual}`;

    // Preserve existing drop detection (compare with previous log)
    if (previousLog) {
      const drops: string[] = [];
      const energyPairs = [
        { label: "Физическая", current: pending.physical!, prev: previousLog.physical },
        { label: "Ментальная", current: pending.mental!, prev: previousLog.mental },
        { label: "Эмоциональная", current: pending.emotional!, prev: previousLog.emotional },
        { label: "Духовная", current: pending.spiritual!, prev: previousLog.spiritual },
      ];
      for (const e of energyPairs) {
        const diff = e.prev - e.current;
        if (diff >= 2) {
          drops.push(`${e.label} упала на ${diff} (было ${e.prev}, стало ${e.current})`);
        }
      }
      if (drops.length > 0) {
        followUp += `\n\n⚠️ Заметил снижение:\n${drops.join("\n")}`;
      }
    }

    // Get instant recommendations from knowledge base (zero AI)
    const result = getInstantRecommendations(
      { physical: pending.physical!, mental: pending.mental!, emotional: pending.emotional!, spiritual: pending.spiritual! },
      undefined,
      telegramId,
    );

    if (result.allGood) {
      followUp += '\n\n🔥 Все энергии в норме!';
    } else {
      const typeLabels: Record<string, string> = {
        physical: '⚡ Физическая', mental: '🧠 Ментальная',
        emotional: '💛 Эмоциональная', spiritual: '✨ Духовная',
      };

      // Group recommendations by energy type
      const byType = new Map<string, typeof result.recommendations>();
      for (const rec of result.recommendations) {
        const group = byType.get(rec.energyType) ?? [];
        group.push(rec);
        byType.set(rec.energyType, group);
      }

      for (const [type, actions] of byType) {
        followUp += `\n\n${typeLabels[type]} просела — вот что поможет прямо сейчас:`;
        for (const action of actions) {
          followUp += `\n→ ${action.name} (${action.duration} мин)`;
        }
      }
    }

    if (result.fact) {
      followUp += `\n\n🧬 ${result.fact.text}`;
    }

    // Build keyboard with "Add to habits" button (InlineKeyboard already imported at top)
    const replyKb = new InlineKeyboard();
    if (result.suggestIds.length > 0 && config.webappUrl) {
      const suggestParam = result.suggestIds.slice(0, 5).join(',');
      replyKb.webApp('📱 Добавить в привычки', `${config.webappUrl}#habits?suggest=${suggestParam}`);
    }

    await ctx.editMessageText(followUp, {
      reply_markup: result.suggestIds.length > 0 && config.webappUrl ? replyKb : undefined,
    });
```

- [ ] **Step 3: Remove old AI recommendation imports and calls**

Remove these imports from `checkin.ts`:
- `import { analyzeEnergyHistory } from "../services/diagnostics.js";`
- `import { getRecommendations, formatRecommendations } from "../services/recommendations.js";`

Add these top-level imports:
- `import { getInstantRecommendations } from "../services/instant-recommendations.js";`
- `import { config } from "../config.js";`

Note: `InlineKeyboard` is already imported at the top of the file — do NOT add a duplicate.

- [ ] **Step 3b: Update CORS methods in server.ts**

In `src/server.ts`, change line 23:
```typescript
res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
```

Also add `express.json()` middleware after CORS block:
```typescript
app.use(express.json());
```

Delete the entire try/catch block that called `analyzeEnergyHistory`, `getRecommendations`, `formatRecommendations`, and `bot.api.sendMessage` for recommendations (lines ~161-176).

- [ ] **Step 4: Run existing tests + build**

Run: `npm test && npm run build`
Expected: Tests pass, build succeeds. Some old recommendation tests may need updating.

- [ ] **Step 5: Update old recommendation tests if needed**

If `src/__tests__/recommendations.test.ts` fails because it imports removed functions, update it to test the new `getInstantRecommendations` or mark old tests as skipped with a note.

- [ ] **Step 6: Commit**

```bash
git add src/handlers/checkin.ts src/knowledge/index.ts src/__tests__/
git commit -m "feat: replace AI recommendations with instant knowledge-base actions in post-checkin"
```

---

## Chunk 2: Phase B — Habit Tracker Backend

### Task 4: Database schema — Habit and HabitLog models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Habit and HabitLog models to schema.prisma**

Add after the Observation model:

```prisma
model Habit {
  id              Int        @id @default(autoincrement())
  userId          Int
  user            User       @relation(fields: [userId], references: [id])
  name            String
  icon            String
  type            String     // "build" | "break"
  routineSlot     String     // "morning" | "afternoon" | "evening"
  sortOrder       Int        @default(0)
  energyType      String?
  frequency       String     @default("daily")
  customDays      String?
  triggerAction   String?
  duration        Int?
  whyToday        String?
  whyMonth        String?
  whyYear         String?
  whyIdentity     String?
  isItBeneficial  String?
  breakTrigger    String?
  replacement     String?
  stage           String     @default("seed")
  stageUpdatedAt  DateTime   @default(now())
  streakCurrent   Int        @default(0)
  streakBest      Int        @default(0)
  consistency30d  Float      @default(0)
  freezesUsedThisWeek Int    @default(0)
  microActionId   String?
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
  status      String   @default("completed")
  note        String?

  @@unique([habitId, date])
}
```

- [ ] **Step 2: Add relations to User model**

Add to User model:
```prisma
  habits       Habit[]
  habitLogs    HabitLog[]
```

- [ ] **Step 3: Generate and apply migration**

Run: `npx prisma migrate dev --name add-habits`
Expected: Migration created and applied

- [ ] **Step 4: Verify Prisma client generates**

Run: `npx prisma generate`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Habit and HabitLog database models with migration"
```

---

### Task 5: Habit CRUD API endpoints

**Files:**
- Create: `src/api/habits.ts`
- Modify: `src/server.ts` (register route)
- Test: `src/__tests__/habits-api.test.ts`

- [ ] **Step 1: Write failing tests for habits API**

Create `src/__tests__/habits-api.test.ts` — test the core logic functions (not HTTP layer) for habit CRUD, completion, and stats. Test:
- Create habit with all required fields
- Get habits grouped by routine slot
- Complete habit for today (creates HabitLog)
- Undo completion (deletes HabitLog)
- Soft delete (isActive=false)
- Slot limit: reject 4th seed/growth habit

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/habits-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Create src/api/habits.ts**

Express router with all endpoints from spec section 7. Key behaviors:
- `GET /api/habits` — returns active habits grouped by `routineSlot`, with today's completion status from HabitLog
- `POST /api/habits` — validates required fields (name, icon, type, routineSlot), checks slot limit (max 3 in seed/growth), creates habit
- `PATCH /api/habits/:id` — updates allowed fields, verifies ownership
- `DELETE /api/habits/:id` — soft delete: `isActive = false`
- `POST /api/habits/:id/complete` — upserts HabitLog for today, recalculates streak
- `DELETE /api/habits/:id/complete` — deletes today's HabitLog, recalculates streak
- `GET /api/habits/:id/stats` — returns streak, consistency30d, best streak, freezes, stage, monthly heatmap (30 days of HabitLog entries)
- `GET /api/habits/today` — shortcut: today's habits with completion status
- `GET /api/habits/heatmap` — all habits monthly completion data

Use `express.json()` middleware for POST/PATCH bodies.

- [ ] **Step 4: Register route in server.ts**

Add to `src/server.ts` in the authed router section:
```typescript
import { habitsRoute } from "./api/habits.js";
// ...
habitsRoute(authedRouter);
```

Also add `express.json()` middleware to authedRouter before route registration (needed for POST/PATCH bodies).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/__tests__/habits-api.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/habits.ts src/server.ts src/__tests__/habits-api.test.ts
git commit -m "feat: add habits CRUD API with completion, stats, and slot limits"
```

---

### Task 6: Streak and consistency calculation service

**Files:**
- Create: `src/services/habit-streaks.ts`
- Test: `src/__tests__/habit-streaks.test.ts`

- [ ] **Step 1: Write failing tests for streak logic**

Test:
- `calculateStreak`: consecutive days from today backward
- `calculateConsistency30d`: completed days / expected days * 100
- Auto-freeze: missed day with freeze available → streak preserved
- Stage transition: seed→growth at day 21 + 70% consistency
- Stage regression: consistency below 50% for 7 days

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement habit-streaks.ts**

Pure functions that take habit + logs and return updated streak/consistency/stage values. Called from API endpoints and cron.

Key functions:
- `calculateStreak(logs: HabitLog[]): number`
- `calculateConsistency30d(logs: HabitLog[], frequency: string, customDays?: string): number`
- `determineStage(habit: Habit, consistency: number): string`
- `applyAutoFreeze(habit: Habit, logs: HabitLog[]): { freezeUsed: boolean; streak: number }`

- [ ] **Step 4: Run tests**

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/habit-streaks.ts src/__tests__/habit-streaks.test.ts
git commit -m "feat: add streak calculation with auto-freeze and stage transitions"
```

---

### Task 7: Habit cron jobs (daily + weekly)

**Files:**
- Modify: `src/services/scheduler.ts`
- Create: `src/services/habit-cron.ts`

- [ ] **Step 1: Create habit-cron.ts with daily and weekly tasks**

```typescript
// Daily midnight: recalculate consistency, check stage transitions, auto-freeze
// Weekly Monday 00:00: reset freezesUsedThisWeek
```

- [ ] **Step 2: Register crons in scheduler.ts**

Add two new cron schedules to `startScheduler()`:
- `0 0 * * *` (midnight daily) → `runDailyHabitCron()`
- `0 0 * * 1` (Monday midnight) → `runWeeklyHabitReset()`

- [ ] **Step 3: Test build**

Run: `npm run build`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add src/services/habit-cron.ts src/services/scheduler.ts
git commit -m "feat: add daily/weekly habit cron jobs for streak recalc and freeze reset"
```

---

### Task 8: Habit bot handlers (nudges + completion via bot)

**Files:**
- Create: `src/handlers/habits.ts`
- Modify: `src/bot.ts` (register callback handler)

- [ ] **Step 1: Create habits.ts bot handler**

Handles:
- `habit_complete:<habitId>` callback → logs completion, sends confirmation with haptic-like emoji
- `habit_skip:<habitId>` callback → "Не сегодня" response
- Missed-2-days nudge function (called from cron): shows user's own "why" words
- Morning/evening routine reminder function: lists today's habits with completion buttons

- [ ] **Step 2: Register in bot.ts**

Add callback query handler for `habit_complete:` and `habit_skip:` prefixes.

- [ ] **Step 3: Wire nudges into habit-cron.ts**

Daily cron also checks for 2-day misses and sends "meaning mirror" messages.

- [ ] **Step 4: Test build**

Run: `npm run build`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add src/handlers/habits.ts src/bot.ts
git commit -m "feat: add habit completion + nudge bot handlers with meaning mirror"
```

---

## Chunk 3: Phase C — Mini App Frontend

### Task 9: Navigation restructure

**Files:**
- Modify: `src/mini-app/router.ts`
- Modify: `src/mini-app/app.tsx`
- Modify: `src/mini-app/components/shared/BottomNav.tsx`
- Modify: `src/mini-app/components/energy/EnergyDashboard.tsx`

- [ ] **Step 1: Update router — add habits, redirect timeline**

Update `src/mini-app/router.ts`:
- Change Route type: `"hub" | "energy" | "habits" | "journal"`
- In `syncRoute()`: if hash is "timeline", redirect to "energy"
- Keep "habits" as valid route

- [ ] **Step 2: Update BottomNav — replace Timeline with Habits**

Replace the timeline nav item with:
```typescript
{ route: "habits", label: "Привычки", icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' }
```

- [ ] **Step 3: Update app.tsx — add Habits route, lazy import**

Replace timeline rendering with habits:
```tsx
{route === "habits" && <HabitsScreen />}
```

- [ ] **Step 4: Move Timeline chart inside EnergyDashboard**

Import Timeline component into EnergyDashboard. Add it as a collapsible section after EnergyRings:
```tsx
<details class="timeline-section">
  <summary>📊 Динамика</summary>
  <Timeline />
</details>
```

- [ ] **Step 5: Test in browser**

Run: `npm run dev`
Navigate to each tab. Verify `#timeline` redirects to `#energy`.

- [ ] **Step 6: Commit**

```bash
git add src/mini-app/router.ts src/mini-app/app.tsx src/mini-app/components/shared/BottomNav.tsx src/mini-app/components/energy/EnergyDashboard.tsx
git commit -m "feat: restructure navigation — add Habits tab, move Timeline into Energy"
```

---

### Task 10: Habits API client + store

**Files:**
- Modify: `src/mini-app/api/types.ts`
- Modify: `src/mini-app/api/client.ts`
- Create: `src/mini-app/store/habits.ts`
- Modify: `src/mini-app/store/index.ts`

- [ ] **Step 1: Add habit types to api/types.ts**

```typescript
export interface HabitData {
  id: number;
  name: string;
  icon: string;
  type: 'build' | 'break';
  routineSlot: 'morning' | 'afternoon' | 'evening';
  duration: number | null;
  energyType: string | null;
  stage: 'seed' | 'growth' | 'autopilot';
  streakCurrent: number;
  streakBest: number;
  consistency30d: number;
  freezesUsedThisWeek: number;
  completedToday: boolean;
  whyToday: string | null;
  whyMonth: string | null;
  whyYear: string | null;
  whyIdentity: string | null;
  isItBeneficial: string | null;
  breakTrigger: string | null;
  replacement: string | null;
  triggerAction: string | null;
  microActionId: string | null;
  stageUpdatedAt: string;
  createdAt: string;
}

export interface HabitStats {
  streakCurrent: number;
  streakBest: number;
  consistency30d: number;
  freezesRemaining: number;
  stage: string;
  heatmap: { date: string; completed: boolean }[];
}

export interface CreateHabitPayload {
  name: string;
  icon: string;
  type: 'build' | 'break';
  routineSlot: string;
  duration?: number;
  energyType?: string;
  triggerAction?: string;
  whyToday?: string;
  whyMonth?: string;
  whyYear?: string;
  whyIdentity?: string;
  isItBeneficial?: string;
  breakTrigger?: string;
  replacement?: string;
  microActionId?: string;
}
```

- [ ] **Step 2: Add habit methods to api/client.ts**

Add `post` and `del` helpers alongside existing `request`. Add methods:
```typescript
habits: () => request<{ morning: HabitData[]; afternoon: HabitData[]; evening: HabitData[] }>('/api/habits'),
createHabit: (data: CreateHabitPayload) => post<HabitData>('/api/habits', data),
completeHabit: (id: number) => post<{ ok: boolean }>(`/api/habits/${id}/complete`, {}),
uncompleteHabit: (id: number) => del<{ ok: boolean }>(`/api/habits/${id}/complete`),
habitStats: (id: number) => request<HabitStats>(`/api/habits/${id}/stats`),
```

- [ ] **Step 3: Create habits store with signals**

Create `src/mini-app/store/habits.ts`:
```typescript
import { signal, computed } from "@preact/signals";
// Signals: habits (grouped), todayProgress, loading state
// Functions: loadHabits, toggleComplete, createHabit
```

- [ ] **Step 4: Re-export from store/index.ts**

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/api/types.ts src/mini-app/api/client.ts src/mini-app/store/habits.ts src/mini-app/store/index.ts
git commit -m "feat: add habits API client and Preact signals store"
```

---

### Task 11: HabitsScreen — main habits view

**Files:**
- Create: `src/mini-app/components/habits/HabitsScreen.tsx`
- Create: `src/mini-app/components/habits/DayProgress.tsx`
- Create: `src/mini-app/components/habits/WeekHeatmap.tsx`
- Create: `src/mini-app/components/habits/RoutineGroup.tsx`
- Create: `src/mini-app/components/habits/HabitCard.tsx`
- Modify: `src/mini-app/styles/global.css`

- [ ] **Step 1: Create DayProgress component**

Top section: animated progress bar (CSS transition on width), streak badge, consistency %.

- [ ] **Step 2: Create WeekHeatmap component**

7 dots (Mon-Sun), colored: green (all done), yellow (partial), gray (future/empty).

- [ ] **Step 3: Create HabitCard component**

Single habit row: circle (empty/filled), name, duration badge. Tap → toggleComplete with haptic feedback + ring fill animation (300ms CSS transition).

- [ ] **Step 4: Create RoutineGroup component**

Container with emoji header (☀️/🌤/🌙), renders HabitCards inside.

- [ ] **Step 5: Create HabitsScreen**

Assembles: DayProgress → WeekHeatmap → RoutineGroups (morning/afternoon/evening) → "Add habit" button.

- [ ] **Step 6: Add CSS styles**

Add habit-specific styles to `global.css`: progress bar, habit card, ring animation, routine group headers.

- [ ] **Step 7: Test in browser**

Run: `npm run dev`, navigate to Habits tab. Verify layout, tap interaction, haptic.

- [ ] **Step 8: Commit**

```bash
git add src/mini-app/components/habits/ src/mini-app/styles/global.css
git commit -m "feat: add HabitsScreen with progress bar, weekly heatmap, and routine groups"
```

---

### Task 12: HabitCreate — creation flow with meaning framework

**Files:**
- Create: `src/mini-app/components/habits/HabitCreate.tsx`

- [ ] **Step 1: Build multi-step creation wizard**

4 steps as described in spec section 8.5:
1. What: name, icon picker (emoji list), duration, routine slot, trigger
2. Type: Build 🟢 or Break 🔴
3. Meaning: 4 horizons (build) or 3 questions (break)
4. Confirm: summary card → "Начать 🌱"

Handle `#habits?suggest=action-id` query param: pre-fill Step 1 from MicroAction data.

State management: local signals within the component for step navigation.

- [ ] **Step 2: Test in browser**

Full creation flow. Verify all steps, validation (required fields), submit → API call → habits list updates.

- [ ] **Step 3: Commit**

```bash
git add src/mini-app/components/habits/HabitCreate.tsx
git commit -m "feat: add habit creation wizard with meaning framework"
```

---

### Task 13: HabitDetail — full detail view

**Files:**
- Create: `src/mini-app/components/habits/HabitDetail.tsx`
- Create: `src/mini-app/components/habits/StageIndicator.tsx`

- [ ] **Step 1: Create StageIndicator**

Visual: 🌱/🌿/🌳 with progress bar showing days in current stage.

- [ ] **Step 2: Create HabitDetail**

Full screen view (opened by tapping habit name): stage + progress, streak/consistency/freezes, "Зачем" section (user's own words), monthly heatmap (30 day grid), "Обновить зачем" button, archive button.

- [ ] **Step 3: Wire navigation**

Tap on habit name in HabitCard → show HabitDetail (use signal for selected habit ID, conditional render in HabitsScreen).

- [ ] **Step 4: Test in browser**

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/components/habits/HabitDetail.tsx src/mini-app/components/habits/StageIndicator.tsx
git commit -m "feat: add habit detail view with stage indicator, heatmap, and why section"
```

---

### Task 14: Hub integration + Journal unification

**Files:**
- Create: `src/mini-app/components/hub/HabitsCard.tsx`
- Modify: `src/mini-app/components/hub/Hub.tsx`
- Modify: `src/mini-app/components/journal/Journal.tsx`

- [ ] **Step 1: Create HabitsCard for Hub**

Card showing: "Привычки X/Y", mini progress bar, dots per routine, streak + consistency.

- [ ] **Step 2: Add HabitsCard to Hub**

Replace `{/* Phase 3: HabitsCard */}` comment with actual component.

- [ ] **Step 3: Update Journal to show habit completions**

Add habit completion entries alongside observations and energy check-ins, sorted chronologically.

- [ ] **Step 4: Test in browser**

- [ ] **Step 5: Commit**

```bash
git add src/mini-app/components/hub/HabitsCard.tsx src/mini-app/components/hub/Hub.tsx src/mini-app/components/journal/Journal.tsx
git commit -m "feat: add habits card to Hub, unify Journal with habit completions"
```

---

### Task 15: Animations — confetti, milestone toasts, completion ring

**Files:**
- Create: `src/mini-app/components/habits/MilestoneToast.tsx`
- Modify: `src/mini-app/styles/global.css` (add animations)

- [ ] **Step 1: Add CSS ring fill animation**

```css
@keyframes ring-fill {
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
}
```

- [ ] **Step 2: Add CSS confetti burst for "all done"**

Lightweight CSS-only confetti particles (no library).

- [ ] **Step 3: Create MilestoneToast**

Slides up from bottom. Shows celebratory message for day 7/21/60 milestones. Auto-dismiss after 4 seconds.

- [ ] **Step 4: Wire milestone detection**

After completing a habit, check if today triggers a milestone (day 7/21/60 of the habit). Show toast if so.

- [ ] **Step 5: Test in browser**

- [ ] **Step 6: Commit**

```bash
git add src/mini-app/components/habits/MilestoneToast.tsx src/mini-app/styles/global.css
git commit -m "feat: add completion animations — ring fill, confetti, milestone toasts"
```

---

## Chunk 4: Phase D — Intelligence Layer + Final

### Task 16: Habit-energy correlation

**Files:**
- Create: `src/services/habit-correlation.ts`
- Create: `src/mini-app/components/habits/CorrelationCard.tsx`
- Modify: `src/api/habits.ts` (add correlation endpoint)

- [ ] **Step 1: Implement correlation calculation**

`getHabitEnergyCorrelation(habitId, userId)`:
- Fetch all HabitLog dates for this habit
- Fetch all EnergyLog entries
- Calculate average energy on habit-completion days vs non-completion days
- Return `{ physical: +1.3, mental: +2.1, ... }` deltas
- Minimum 14 days of data required

- [ ] **Step 2: Add GET /api/habits/:id/correlation endpoint**

- [ ] **Step 3: Create CorrelationCard component**

Shows: "Когда ты делаешь X, эмоциональная: 7.2 vs 5.1, +2.1 🔼". Only shown if 14+ days of data exist.

- [ ] **Step 4: Add to HabitsScreen (bottom) and HabitDetail**

- [ ] **Step 5: Commit**

```bash
git add src/services/habit-correlation.ts src/mini-app/components/habits/CorrelationCard.tsx src/api/habits.ts
git commit -m "feat: add habit-energy correlation calculation and display"
```

---

### Task 17: Smart reminder timing (Phase D)

**Files:**
- Modify: `src/services/habit-cron.ts`
- Modify: `src/handlers/habits.ts`

- [ ] **Step 1: Calculate median completion time per user**

Add `getMedianCompletionTime(userId, routineSlot)` to `habit-cron.ts`:
- Query HabitLog.completedAt for user's habits in a given routine slot
- Calculate median hour:minute
- Return `{ hour, minute }` or null if insufficient data

- [ ] **Step 2: Update routine reminder cron to use personalized timing**

If user has 14+ days of data, send reminder at `medianTime - 5 minutes` instead of default 8:00/21:00.

- [ ] **Step 3: Add stage-aware nudge frequency**

In the missed-day nudge logic:
- Seed stage: nudge after 1 missed day
- Growth stage: nudge after 2 missed days
- Autopilot stage: nudge after 5 missed days

- [ ] **Step 4: Commit**

```bash
git add src/services/habit-cron.ts src/handlers/habits.ts
git commit -m "feat: add smart reminder timing and stage-aware nudge frequency"
```

---

### Task 18: Full build + deploy verification

**Files:** None new

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Success, no errors

- [ ] **Step 3: Verify locally**

Run: `npm run dev`
Test full flow:
1. Hub shows energy card + habits card
2. Energy tab shows rings + collapsible timeline
3. Habits tab: create habit with meaning → complete → see progress → check detail
4. Journal shows both energy and habit entries
5. Bot check-in gives instant recommendations with "Add to habits" button

- [ ] **Step 4: Commit any fixes**

- [ ] **Step 5: Final commit with updated CLAUDE.md**

Update CLAUDE.md to reflect new navigation, new components, habits API endpoints, and Phase 3 status = Done.

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md — Phase 3 (Habits) complete"
```
