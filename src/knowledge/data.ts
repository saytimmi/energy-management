/**
 * Complete methodology data for the 4-energy knowledge base.
 * All text content is in Russian to match the bot's language.
 */

import { EnergyType, Practice, DrainFactor, SubstitutionRule } from './types.js';

// ---------------------------------------------------------------------------
// Recovery Practices
// ---------------------------------------------------------------------------

export const RECOVERY_PRACTICES = new Map<EnergyType, Practice[]>([
  [EnergyType.physical, [
    { id: 'sleep-7-9h', name: 'Сон 7-9 часов', description: 'Качественный сон в тёмной прохладной комнате, ложиться до 23:00', energyType: EnergyType.physical },
    { id: 'morning-light', name: 'Утренний свет', description: 'Выйти на солнечный свет в первые 30 минут после пробуждения', energyType: EnergyType.physical },
    { id: 'walking-8-12k', name: 'Ходьба 8-12к шагов', description: 'Ежедневная ходьба 8000-12000 шагов для базовой физической активности', energyType: EnergyType.physical },
    { id: 'strength-2-4x', name: 'Силовые 2-4 раза/неделю', description: 'Силовые тренировки 2-4 раза в неделю для поддержания мышечной массы', energyType: EnergyType.physical },
    { id: 'protein-1.6-2g', name: 'Белок 1.6-2г/кг', description: 'Потребление белка 1.6-2г на кг массы тела для восстановления', energyType: EnergyType.physical },
    { id: 'water-30-40ml', name: 'Вода 30-40мл/кг', description: 'Питьевой режим 30-40мл воды на кг массы тела в день', energyType: EnergyType.physical },
    { id: 'magnesium', name: 'Магний', description: 'Приём магния для поддержки нервной системы и качества сна', energyType: EnergyType.physical },
    { id: 'sauna-contrast', name: 'Баня/контрастный душ', description: 'Баня или контрастный душ для восстановления и улучшения кровообращения', energyType: EnergyType.physical },
    { id: 'breathing-exhale', name: 'Дыхание с длинным выдохом', description: 'Дыхательные практики с акцентом на длинный выдох для активации парасимпатики', energyType: EnergyType.physical },
    { id: 'schedule-routine', name: 'Режим/рутина', description: 'Стабильный распорядок дня — ложиться и вставать в одно время', energyType: EnergyType.physical },
  ]],

  [EnergyType.mental, [
    { id: 'cycles-90min', name: 'Циклы 90 минут', description: 'Работать блоками по 90 минут с перерывами между ними', energyType: EnergyType.mental },
    { id: 'defocus-10-20min', name: 'Расфокус 10-20 мин', description: 'Перерыв на расфокусировку 10-20 минут после интенсивной работы', energyType: EnergyType.mental },
    { id: 'water-fire-horizon', name: 'Смотреть на воду/огонь/горизонт', description: 'Созерцание воды, огня или горизонта для расфокусировки мозга', energyType: EnergyType.mental },
    { id: 'walk-no-phone', name: 'Прогулка без телефона', description: 'Прогулка без телефона для ментальной перезагрузки', energyType: EnergyType.mental },
    { id: 'meditation-10-15min', name: 'Медитация 10-15 мин', description: 'Медитация 10-15 минут для успокоения ума и восстановления внимания', energyType: EnergyType.mental },
    { id: 'nap-15-25min', name: 'Дневной сон 15-25 мин', description: 'Короткий дневной сон 15-25 минут для перезагрузки когнитивных функций', energyType: EnergyType.mental },
    { id: 'write-out-tasks', name: 'Выписать задачи', description: 'Выгрузить все задачи из головы на бумагу или в список', energyType: EnergyType.mental },
    { id: 'one-main-task', name: '1 главная задача в день', description: 'Определить одну главную задачу на день, остальные — бонус', energyType: EnergyType.mental },
    { id: 'reduce-input', name: 'Снизить входящий поток', description: 'Уменьшить количество входящей информации — уведомления, новости, соцсети', energyType: EnergyType.mental },
  ]],

  [EnergyType.emotional, [
    { id: 'talk-close-person', name: 'Поговорить с близким', description: 'Разговор с близким человеком о переживаниях и чувствах', energyType: EnergyType.emotional },
    { id: 'laughter-humor', name: 'Смех/юмор', description: 'Юмор и смех как способ эмоциональной разрядки', energyType: EnergyType.emotional },
    { id: 'hugs', name: 'Объятия', description: 'Физический контакт — объятия стимулируют выработку окситоцина', energyType: EnergyType.emotional },
    { id: 'community', name: 'Сообщество по интересам', description: 'Участие в сообществе по интересам для чувства принадлежности', energyType: EnergyType.emotional },
    { id: 'group-sport', name: 'Командный спорт', description: 'Групповые спортивные активности для социальной связи', energyType: EnergyType.emotional },
    { id: 'nature', name: 'Природа', description: 'Время на природе для эмоционального восстановления', energyType: EnergyType.emotional },
    { id: 'gratitude-3', name: 'Благодарность 3 вещи/день', description: 'Записывать 3 вещи за которые благодарен каждый день', energyType: EnergyType.emotional },
    { id: 'limit-toxic', name: 'Ограничить токсичных людей', description: 'Минимизировать общение с токсичными людьми', energyType: EnergyType.emotional },
    { id: 'sincere-dialogue', name: 'Искренний диалог', description: 'Открытый и честный разговор без масок', energyType: EnergyType.emotional },
    { id: 'crying', name: 'Плач/выплеск', description: 'Разрешить себе плакать — это естественный механизм эмоциональной разрядки', energyType: EnergyType.emotional },
  ]],

  [EnergyType.spiritual, [
    { id: 'formulate-mission', name: 'Сформулировать миссию', description: 'Определить свою личную миссию и предназначение', energyType: EnergyType.spiritual },
    { id: 'long-term-goal', name: 'Долгосрочная цель', description: 'Поставить цель, которая выходит за рамки повседневности', energyType: EnergyType.spiritual },
    { id: 'charity', name: 'Благотворительность', description: 'Помощь другим через благотворительность', energyType: EnergyType.spiritual },
    { id: 'help-the-weak', name: 'Помощь слабым', description: 'Помогать тем, кто слабее — даёт ощущение значимости', energyType: EnergyType.spiritual },
    { id: 'places-of-silence', name: 'Места тишины', description: 'Посещение мест тишины — храмы, природа, уединение', energyType: EnergyType.spiritual },
    { id: 'prayer-philosophy', name: 'Молитва/философия', description: 'Молитва, чтение философии или религиозных текстов', energyType: EnergyType.spiritual },
    { id: 'reflect-finality', name: 'Размышления о конечности', description: 'Размышления о конечности жизни для расстановки приоритетов', energyType: EnergyType.spiritual },
    { id: 'deep-books', name: 'Глубокие книги', description: 'Чтение книг, которые заставляют думать о смысле', energyType: EnergyType.spiritual },
    { id: 'create-eternal', name: 'Создать что-то вечное', description: 'Создание чего-то, что переживёт тебя — книга, проект, наследие', energyType: EnergyType.spiritual },
  ]],
]);

// ---------------------------------------------------------------------------
// Drain Factors
// ---------------------------------------------------------------------------

export const DRAIN_FACTORS = new Map<EnergyType, DrainFactor[]>([
  [EnergyType.physical, [
    { id: 'lack-of-sleep', name: 'Недосып', description: 'Хронический недостаток сна менее 7 часов', energyType: EnergyType.physical },
    { id: 'stress', name: 'Стресс', description: 'Хронический стресс повышает кортизол и истощает тело', energyType: EnergyType.physical },
    { id: 'alcohol', name: 'Алкоголь', description: 'Алкоголь нарушает качество сна и восстановление', energyType: EnergyType.physical },
    { id: 'nicotine', name: 'Никотин', description: 'Никотин сужает сосуды и ухудшает кровообращение', energyType: EnergyType.physical },
    { id: 'sugar', name: 'Сахар', description: 'Избыток сахара вызывает скачки глюкозы и последующие провалы энергии', energyType: EnergyType.physical },
    { id: 'water-deficit', name: 'Дефицит воды', description: 'Обезвоживание снижает когнитивные и физические функции', energyType: EnergyType.physical },
    { id: 'no-movement', name: 'Отсутствие движения', description: 'Сидячий образ жизни без физической активности', energyType: EnergyType.physical },
    { id: 'overeating', name: 'Переедание', description: 'Переедание отвлекает энергию на пищеварение', energyType: EnergyType.physical },
    { id: 'overtraining', name: 'Перетренированность', description: 'Чрезмерные нагрузки без адекватного восстановления', energyType: EnergyType.physical },
    { id: 'prolonged-sitting', name: 'Длительное сидение', description: 'Сидение более 2 часов подряд без перерыва', energyType: EnergyType.physical },
    { id: 'jet-lag', name: 'Джетлаг', description: 'Сбой циркадных ритмов из-за смены часовых поясов', energyType: EnergyType.physical },
  ]],

  [EnergyType.mental, [
    { id: 'multitasking', name: 'Многозадачность', description: 'Переключение между задачами истощает префронтальную кору', energyType: EnergyType.mental },
    { id: 'notifications', name: 'Уведомления', description: 'Постоянные уведомления разрывают фокус внимания', energyType: EnergyType.mental },
    { id: 'constant-decisions', name: 'Постоянные решения', description: 'Усталость от принятия решений — decision fatigue', energyType: EnergyType.mental },
    { id: 'continuous-focus-3-5h', name: 'Непрерывный фокус 3-5ч', description: 'Работа без перерывов более 3-5 часов подряд', energyType: EnergyType.mental },
    { id: 'scrolling', name: 'Скроллинг', description: 'Бесцельный скроллинг ленты в соцсетях', energyType: EnergyType.mental },
    { id: 'unfinished-tasks', name: 'Незавершённые задачи', description: 'Открытые циклы — незавершённые дела крутятся в голове (эффект Зейгарник)', energyType: EnergyType.mental },
    { id: 'emotional-conflicts', name: 'Эмоциональные конфликты', description: 'Нерешённые конфликты забирают ментальный ресурс', energyType: EnergyType.mental },
    { id: 'perfectionism', name: 'Перфекционизм', description: 'Стремление к идеалу парализует и истощает', energyType: EnergyType.mental },
    { id: 'caffeine-after-15', name: 'Кофеин после 15:00', description: 'Кофеин после 15:00 нарушает качество сна и восстановление', energyType: EnergyType.mental },
  ]],

  [EnergyType.emotional, [
    { id: 'conflicts', name: 'Конфликты', description: 'Межличностные конфликты истощают эмоциональный ресурс', energyType: EnergyType.emotional },
    { id: 'toxic-environment', name: 'Токсичное окружение', description: 'Постоянное нахождение в токсичной среде', energyType: EnergyType.emotional },
    { id: 'complaints', name: 'Жалобы', description: 'Постоянные жалобы окружающих или собственные', energyType: EnergyType.emotional },
    { id: 'feeling-undervalued', name: 'Ощущение недооценённости', description: 'Чувство что тебя не ценят и не замечают', energyType: EnergyType.emotional },
    { id: 'pressure-expectations', name: 'Давление ожиданий', description: 'Давление внешних ожиданий и стандартов', energyType: EnergyType.emotional },
    { id: 'comparison', name: 'Сравнение с другими', description: 'Постоянное сравнение себя с другими', energyType: EnergyType.emotional },
    { id: 'public-criticism', name: 'Публичная критика', description: 'Критика на публике унижает и истощает', energyType: EnergyType.emotional },
    { id: 'lack-of-support', name: 'Отсутствие поддержки', description: 'Нехватка эмоциональной поддержки от близких', energyType: EnergyType.emotional },
    { id: 'isolation', name: 'Изоляция', description: 'Социальная изоляция и одиночество', energyType: EnergyType.emotional },
  ]],

  [EnergyType.spiritual, [
    { id: 'meaningless-work', name: 'Бессмысленная работа', description: 'Работа без смысла и цели, ради денег или по инерции', energyType: EnergyType.spiritual },
    { id: 'betrayal-of-values', name: 'Предательство ценностей', description: 'Действия вопреки собственным ценностям и убеждениям', energyType: EnergyType.spiritual },
    { id: 'living-for-others', name: 'Жизнь ради чужого мнения', description: 'Жизнь ради одобрения окружающих, а не своих целей', energyType: EnergyType.spiritual },
    { id: 'cynicism', name: 'Цинизм', description: 'Цинизм и обесценивание всего вокруг', energyType: EnergyType.spiritual },
    { id: 'only-consuming', name: 'Только потребление', description: 'Только потреблять, ничего не создавать', energyType: EnergyType.spiritual },
    { id: 'no-long-term-goal', name: 'Нет долгосрочной цели', description: 'Отсутствие цели, которая больше чем ты сам', energyType: EnergyType.spiritual },
    { id: 'chasing-status', name: 'Погоня за статусом', description: 'Погоня за внешними атрибутами успеха', energyType: EnergyType.spiritual },
    { id: 'dopamine-mode', name: 'Дофаминовый режим', description: 'Жизнь на быстром дофамине — лайки, скроллинг, мгновенные удовольствия', energyType: EnergyType.spiritual },
  ]],
]);

// ---------------------------------------------------------------------------
// Substitution Rules
// ---------------------------------------------------------------------------

export const SUBSTITUTION_RULES: SubstitutionRule[] = [
  // Cross-type prohibitions
  {
    fromType: EnergyType.physical,
    toType: EnergyType.emotional,
    allowed: false,
    reason: 'Нельзя лечить эмоциональное выгорание спортом',
  },
  {
    fromType: EnergyType.emotional,
    toType: EnergyType.spiritual,
    allowed: false,
    reason: 'Нельзя лечить духовную пустоту развлечениями',
  },
  {
    fromType: EnergyType.mental,
    toType: EnergyType.mental,
    allowed: false,
    reason: 'Нельзя лечить ментальную перегрузку кофе — кофеин это дрейн, а не восстановление',
  },
  {
    fromType: EnergyType.physical,
    toType: EnergyType.physical,
    allowed: false,
    reason: 'Нельзя лечить физическое истощение мотивацией',
  },
  // Spiritual exception: can convert to any type
  {
    fromType: EnergyType.spiritual,
    toType: EnergyType.physical,
    allowed: true,
    reason: 'Духовная энергия может конвертироваться в любую другую',
  },
  {
    fromType: EnergyType.spiritual,
    toType: EnergyType.mental,
    allowed: true,
    reason: 'Духовная энергия может конвертироваться в любую другую',
  },
  {
    fromType: EnergyType.spiritual,
    toType: EnergyType.emotional,
    allowed: true,
    reason: 'Духовная энергия может конвертироваться в любую другую',
  },
];
