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
