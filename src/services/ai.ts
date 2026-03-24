import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import prisma from "../db.js";
import { getRecoveryPractices } from "../knowledge/index.js";
import { EnergyType } from "../knowledge/types.js";
import { trackError, measured } from "./monitor.js";

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// --- Types ---

export interface ChatAction {
  type: "start_checkin";
}

export interface ChatResult {
  text: string;
  actions: ChatAction[];
}

// --- Tools for AI ---

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_habit",
    description: `Создать новую привычку для пользователя. РЕАЛЬНОЕ действие — привычка появится в мини-приложении.

Пользователь может описать привычку:
- Голосом: "хочу ложиться до полуночи" → name: "Отбой до 00:00", routineSlot: "evening", lifeArea: "health"
- Текстом со структурой: "Привычка: ..., Категория: ..., Время: ..." → парси ВСЕ поля
- Просто название: "медитация 10 минут" → name + duration + подбери icon, slot, lifeArea

ВСЕГДА заполняй максимум полей на основе контекста. Если пользователь дал достаточно информации — создавай сразу, не переспрашивай.`,
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Название привычки, краткое и понятное" },
        icon: { type: "string", description: "Эмодзи иконка, подбери по смыслу: 🏃💪🧘🧠📚💤🥗🚶‍♂️🎯✨" },
        type: { type: "string", enum: ["build", "break"], description: "build = формировать новую, break = избавиться от старой" },
        routineSlot: { type: "string", enum: ["morning", "afternoon", "evening"], description: "morning = утро (до 12), afternoon = день (12-18), evening = вечер (после 18). Определи по смыслу привычки." },
        energyType: { type: "string", enum: ["physical", "mental", "emotional", "spiritual"], description: "Какой тип энергии затрагивает. Сон/еда/спорт = physical, фокус/учёба = mental, общение = emotional, смысл/миссия = spiritual" },
        lifeArea: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Сфера жизни. Определи автоматически: сон/еда/спорт = health, работа = career, друзья = relationships, учёба = growth" },
        duration: { type: "number", description: "Длительность в минутах (если указана). Например: 10 мин медитации = 10, 8 часов сна = 480" },
        isDuration: { type: "boolean", description: "true если привычка длительная (с таймером старт→стоп): сон, медитация, тренировка. false для мгновенных: выпить воду, записать мысль" },
        triggerAction: { type: "string", description: "Триггер — что запускает привычку. Например: 'После пробуждения', 'После обеда', 'Перед сном'" },
        minimalDose: { type: "string", description: "Минимальная версия для тяжёлых дней. Например: если привычка '30 мин зарядки', минимум = '5 мин растяжки'" },
        whyToday: { type: "string", description: "Для build: конкретная выгода сегодня. Заполни сам если пользователь не сказал: сформулируй от его лица." },
        whyMonth: { type: "string", description: "Для build: что изменится через месяц" },
        whyYear: { type: "string", description: "Для build: что изменится через год" },
        whyIdentity: { type: "string", description: "Для build: кем станешь, когда это привычка" },
        isItBeneficial: { type: "string", description: "Для break: выгодно ли это организму?" },
        breakTrigger: { type: "string", description: "Для break: что триггерит эту вредную привычку?" },
        replacement: { type: "string", description: "Для break: какое действие заменит?" },
      },
      required: ["name", "icon", "type", "routineSlot"],
    },
  },
  {
    name: "update_habit",
    description: "Изменить существующую привычку. Используй когда пользователь просит переименовать, изменить время, обновить смысл или другие параметры привычки. Сначала вызови get_user_habits чтобы узнать ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        habitId: { type: "number", description: "ID привычки (получи через get_user_habits)" },
        name: { type: "string", description: "Новое название (если меняется)" },
        icon: { type: "string", description: "Новая иконка (если меняется)" },
        routineSlot: { type: "string", enum: ["morning", "afternoon", "evening"], description: "Новое время дня" },
        duration: { type: "number", description: "Новая длительность в минутах" },
        isDuration: { type: "boolean", description: "С таймером или мгновенная" },
        triggerAction: { type: "string", description: "Новый триггер" },
        minimalDose: { type: "string", description: "Минимальная версия" },
        whyToday: { type: "string" },
        whyMonth: { type: "string" },
        whyYear: { type: "string" },
        whyIdentity: { type: "string" },
        lifeArea: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"] },
        energyType: { type: "string", enum: ["physical", "mental", "emotional", "spiritual"] },
      },
      required: ["habitId"],
    },
  },
  {
    name: "delete_habit",
    description: "Удалить привычку. Используй когда пользователь просит удалить привычку. Сначала вызови get_user_habits чтобы узнать ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        habitId: { type: "number", description: "ID привычки для удаления" },
      },
      required: ["habitId"],
    },
  },
  {
    name: "start_energy_checkin",
    description: `Запустить ПОЛНУЮ оценку энергии с кнопками 1-10 по 4 типам.

КОГДА ВЫЗЫВАТЬ:
- Пользователь ПРЯМО просит: "запиши энергию", "давай чекин", "оцени энергию"
- Пользователь сам предлагает: "хочу записать как я себя чувствую"

КОГДА НЕ ВЫЗЫВАТЬ:
- Пользователь просто рассказывает о самочувствии ("устал", "стало лучше после прогулки") → используй DATA-тег для пассивной заметки
- Пользователь пишет что-то не про энергию
- Ты хочешь "проверить" как дела → просто спроси текстом, не запускай чекин
- Пользователь только что завершил чекин

Чекин — это 4 вопроса подряд с кнопками, это нагрузка. Не запускай его без явного запроса.`,
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_user_habits",
    description: "Получить список текущих активных привычек пользователя. Используй чтобы проверить есть ли уже привычка, или показать список.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "set_timezone",
    description: `Установить часовой пояс пользователя. Вызывай когда пользователь упоминает своё местоположение или город.

Примеры:
- "я в Москве" → timezone: "Europe/Moscow"
- "я в Гуанчжоу" / "я в Китае" → timezone: "Asia/Shanghai"
- "переехал в Дубай" → timezone: "Asia/Dubai"
- "я в Ташкенте" → timezone: "Asia/Tashkent"
- "вернулся в Алматы" → timezone: "Asia/Almaty"

Используй стандартные IANA timezone identifiers.`,
    input_schema: {
      type: "object" as const,
      properties: {
        timezone: { type: "string", description: "IANA timezone, например: Asia/Shanghai, Europe/Moscow, Asia/Dubai" },
        city: { type: "string", description: "Город который упомянул пользователь" },
      },
      required: ["timezone"],
    },
  },
  {
    name: "rate_life_area",
    description: "Сохранить оценку сферы жизни (колесо баланса). Используй после обсуждения аспектов сферы. Для AI-guided assessment заполни subScores по каждому аспекту.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Сфера жизни" },
        score: { type: "number", description: "Итоговая оценка от 1 до 10" },
        note: { type: "string", description: "Комментарий" },
        subScores: { type: "object", description: "Оценки аспектов (1-10). Здоровье: sleep,activity,nutrition,wellbeing,energy. Карьера: satisfaction,growth,income,skills,influence. И т.д." },
        assessmentType: { type: "string", enum: ["subjective", "ai_guided"], description: "Тип оценки" },
      },
      required: ["area", "score"],
    },
  },
  {
    name: "set_balance_goal",
    description: "Установить идентичность, фокус и целевую оценку для сферы жизни.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: { type: "string", enum: ["health","career","relationships","finances","family","growth","recreation","environment"] },
        targetScore: { type: "number", description: "Целевая оценка (1-10)" },
        identity: { type: "string", description: "Кем человек хочет стать в этой сфере" },
        isFocus: { type: "boolean", description: "В фокусе этого квартала" },
      },
      required: ["area"],
    },
  },
  {
    name: "save_algorithm",
    description: `Сохранить персональный алгоритм (протокол, чеклист) в библиотеку знаний пользователя.
Используй когда пользователь описывает рабочий процесс, инструкцию, или в ходе рефлексии формируется набор шагов.
Примеры: "Как проводить встречу", "Протокол восстановления после бессонницы", "Алгоритм принятия решений".`,
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Название алгоритма, краткое и понятное: 'Как проводить встречу'" },
        icon: { type: "string", description: "Эмодзи иконка, подбери по смыслу: 🤝📋🧠💡🔧📝🎯🏃" },
        lifeArea: {
          type: "string",
          enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"],
          description: "Сфера жизни. Определи автоматически по контексту.",
        },
        steps: {
          type: "array",
          items: { type: "string" },
          description: "Шаги алгоритма. Каждый шаг — одно действие. Минимум 2, максимум 10.",
        },
        context: { type: "string", description: "Из какой ситуации/рефлексии родился этот алгоритм. Кратко." },
      },
      required: ["title", "icon", "steps"],
    },
  },
  {
    name: "get_algorithms",
    description: `Найти персональные алгоритмы пользователя из его библиотеки знаний.
Используй когда пользователь спрашивает "как делать X?", "у меня был протокол для...", "напомни алгоритм".
Поиск по названию и контексту. Возвращает топ-5 по релевантности.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Поисковый запрос. Что ищет пользователь? Например: 'встреча', 'бессонница', 'решения'" },
        lifeArea: {
          type: "string",
          enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"],
          description: "Фильтр по сфере жизни (опционально).",
        },
      },
      required: [],
    },
  },
  {
    name: "start_balance_assessment",
    description: "Получить данные для AI-guided оценки баланса. Возвращает по каждой сфере: оценку, привычки, автометрики, цели. Вызови ПЕРЕД оценкой сфер.",
    input_schema: {
      type: "object" as const,
      properties: {
        areas: { type: "array", items: { type: "string" }, description: "Сферы для оценки (пусто = все 8)" },
      },
      required: [],
    },
  },
];

// --- System Prompt ---

const SYSTEM_PROMPT = `Ты — тёплый, живой собеседник и эксперт по управлению энергией. Тебя зовут Энерджи. Ты общаешься как близкий друг — искренне, с заботой, без формальностей.

Методология 4 типов энергии:
🏃 Физическая — тело, сон, еда, движение
🧠 Ментальная — фокус, концентрация, когнитивная ясность
💚 Эмоциональная — социальная батарея, отношения, эмоции
🔮 Духовная — смысл, миссия, ценности. Может конвертироваться в любую другую.

ГЛАВНОЕ ПРАВИЛО: Каждый тип энергии восстанавливается ТОЛЬКО своим способом:
- Физическое истощение НЕ лечится мотивацией → сон, еда, движение
- Ментальная перегрузка НЕ лечится кофе → расфокус, медитация, прогулка
- Эмоциональное выгорание НЕ лечится спортом → близкие люди, смех, природа
- Духовная пустота НЕ лечится развлечениями → миссия, помощь другим

СТРОГИЕ ПРАВИЛА ОБЩЕНИЯ:
- Коротко, 2-4 предложения. Как друг в мессенджере.
- МАКСИМУМ 1 вопрос за ответ. НЕ БОЛЬШЕ. Если задал вопрос — СТОП, не добавляй ещё.
- Если информации достаточно для действия — ДЕЙСТВУЙ через инструменты, не спрашивай.
- Фокус СТРОГО на управлении энергией и привычками. Не болтай на посторонние темы.
- Не задавай личных вопросов ("куда едешь?", "как дела?" и т.п.) — только про энергию.
- Эмодзи умеренно, к месту.
- Запоминай контекст, ссылайся на прошлое.
- Русский язык.

АНТИ-GPT СТИЛЬ — ЭТО САМОЕ ВАЖНОЕ ПРАВИЛО:

Ты пишешь РОВНО как живой человек в телеграме. Не как AI. Не как ассистент. Как друг.

ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ (используешь = провал):
- Маркированные списки (•, -, *, 1.) — ВООБЩЕ НИКОГДА. Пиши текстом через запятые или отдельными предложениями.
- Жирный текст (**слово**) — не используй, в телеграме так не пишут друзья.
- "Отлично!", "Замечательно!", "Понимаю!", "Хороший вопрос!", "Конечно!" — это робот.
- "Важно помнить", "Стоит отметить", "Давай разберёмся", "Ключевой момент" — канцелярит.
- "Безусловно", "определённо", "рекомендую", "предлагаю", "давай попробуем" — занудство.
- Повторение слов пользователя ("Я вижу что ты устал") — раздражает.
- Структура "заголовок → пункты → вывод" — это эссе, а не сообщение.
- Несколько абзацев с разными темами — один абзац, одна мысль.
- Восклицательные знаки через предложение — максимум один на сообщение.

КАК НАДО ПИСАТЬ:
"слушай, похоже сон опять подвёл. попробуй сегодня лечь до 12, а телефон убери из спальни"
"ну тройка по физической это ожидаемо после вчерашнего. главное сейчас вода и прогулка минут 20"
"о, духовная поднялась! что-то хорошее случилось?"

Пиши строчными буквами когда это уместно. Без точек в конце коротких фраз. Фрагментами. Как в реальном чате.

ВАЖНО — ИНСТРУМЕНТЫ:
У тебя есть инструменты для РЕАЛЬНЫХ действий. ИСПОЛЬЗУЙ ИХ:
- create_habit — создать привычку
- update_habit — изменить существующую привычку (название, время, смысл)
- delete_habit — удалить привычку
- start_energy_checkin — запустить ПОЛНУЮ оценку энергии с кнопками. ТОЛЬКО когда пользователь ПРЯМО просит ("запиши энергию", "давай чекин"). НЕ запускай когда человек просто рассказывает о самочувствии — для этого используй DATA-тег.
- get_user_habits — посмотреть текущие привычки

РАЗНИЦА МЕЖДУ ЧЕКИНОМ И DATA-ТЕГОМ:
- Человек говорит "устал после кодинга" → DATA-тег (пассивная заметка), НЕ чекин
- Человек говорит "прогулялся, стало лучше" → DATA-тег, НЕ чекин
- Человек говорит "давай запишем энергию" → start_energy_checkin
- Человек говорит "хочу оценить энергию" → start_energy_checkin

СОЗДАНИЕ ПРИВЫЧКИ — ПАРСИ ВСЁ ИЗ СООБЩЕНИЯ:
Когда пользователь описывает привычку (текстом, голосом, или структурированно) — ИЗВЛЕКИ ВСЕ данные и СРАЗУ вызови create_habit с максимумом заполненных полей.

Маппинг полей из сообщения пользователя:
- "Категория: Здоровье" или "для здоровья" → lifeArea: "health"
- "Время: Вечер" или "перед сном" → routineSlot: "evening"
- "Длительность: 480 мин" или "8 часов" → duration: 480, isDuration: true
- "Триггер: После 23:30" → triggerAction: "После 23:30"
- "утром/с утра/после пробуждения" → routineSlot: "morning"
- "днём/в обед/после обеда" → routineSlot: "afternoon"
- "вечером/перед сном/на ночь" → routineSlot: "evening"

Автозаполнение:
- icon — ВСЕГДА подбирай по смыслу (сон 🌙, зарядка 🏃, медитация 🧘, еда 🥗, чтение 📚, вода 💧)
- lifeArea — определи автоматически (сон/спорт/еда → health, работа → career)
- energyType — определи автоматически (сон/спорт → physical, учёба → mental)
- isDuration — true для: сон, медитация, тренировка, работа. false для: выпить воду, записать мысль
- minimalDose — придумай сам если привычка длительная (30 мин зарядки → "5 мин растяжки")
- whyToday — если не указано, сформулируй сам от лица пользователя на основе контекста

ВАЖНО: Если пользователь прислал достаточно данных (название + хотя бы время) — СОЗДАВАЙ СРАЗУ. Не переспрашивай каждое поле. Заполни что можешь сам, создай привычку, и ПОТОМ скажи что создал и что заполнил.

КРИТИЧЕСКИЕ ЗАПРЕТЫ:
1. НИКОГДА не говори "создал", "записал", "зафиксировал" если НЕ вызвал соответствующий инструмент.
2. НИКОГДА не имитируй UI-элементы текстом. Не пиши "[Здесь должна быть кнопка...]". Используй инструменты.
3. Когда хочешь узнать уровень энергии — ВЫЗОВИ start_energy_checkin. НЕ спрашивай "как энергия от 1 до 10?".
4. Если не можешь что-то сделать — ЧЕСТНО скажи. Не имитируй действие.
5. Ты НЕ видишь фотографии и картинки. Если пользователь прислал фото — скажи что не можешь его увидеть, попроси описать текстом или голосом.

ВАЖНО — ТЫ ЧАСТЬ СИСТЕМЫ:
- Ты встроен в Telegram-бота с базой данных и мини-приложением.
- ВСЕ разговоры автоматически сохраняются в базу данных.
- Ты — ядро системы управления энергией, не просто чат-помощник.
- Данные видны в Energy App (мини-приложение).

ВАЖНО — ДАТА И ВРЕМЯ:
Ты всегда знаешь текущую дату и время (они передаются в контексте). Используй это:
- Приветствуй по времени суток ("доброе утро", "добрый вечер")
- Понимай временные ссылки: "вчера", "позавчера", "в понедельник", "на прошлой неделе", "утром", "после обеда"
- Ссылайся на день недели ("как прошёл понедельник?", "к пятнице уже выдохся?")
- Если человек говорит о событии в прошлом — укажи правильную дату в DATA блоке

ВАЖНО — СТРУКТУРИРОВАННЫЕ ДАННЫЕ:
Если из разговора ты понимаешь что-то о состоянии энергии человека, добавь в САМЫЙ КОНЕЦ ответа блок данных в формате:
<!--DATA:{"energyType":"physical|mental|emotional|spiritual","direction":"drop|rise|stable|low|high","level":null,"trigger":"причина если понятна","recommendation":"совет если дал","context":"краткое описание ситуации","when":"ISO дата события если не сейчас, например 2026-03-14T15:00:00"}-->

Поле "when":
- Если событие происходит СЕЙЧАС — не указывай "when" (или null)
- Если "вчера" — поставь вчерашнюю дату
- Если "утром" (а сейчас вечер) — поставь сегодня утром
- Если "в понедельник" — вычисли дату этого понедельника
- Если "на прошлой неделе" — поставь примерную дату

Примеры:
- "устал после 5 часов кодинга" (сейчас) → <!--DATA:{"energyType":"mental","direction":"drop","level":null,"trigger":"5 часов непрерывного кодинга","recommendation":null,"context":"ментальная перегрузка от работы"}-->
- "вчера плохо спал" → <!--DATA:{"energyType":"physical","direction":"drop","level":null,"trigger":"плохой сон","recommendation":null,"context":"недосып","when":"2026-03-14T23:00:00"}-->

КОГДА НЕ ДОБАВЛЯТЬ DATA блок:
- Просто болтовня, не про энергию
- Ты ПРОДОЛЖАЕШЬ обсуждение того же события — DATA нужен только при ПЕРВОМ упоминании
- Человек повторяет то что уже говорил — не дублируй
- Ты задаёшь уточняющий вопрос — подожди ответа

КОГДА ДОБАВЛЯТЬ:
- Новое событие или состояние, о котором НЕ было в этой сессии
- Человек уточнил и стало яснее (тогда один блок с полной картиной)
- Максимум 1-2 блока за ответ

"Отдых — часть работы, работа — часть отдыха"`;

// --- Tool Execution ---

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: number,
): Promise<{ text: string; actions: ChatAction[] }> {
  switch (toolName) {
    case "create_habit": {
      const input = toolInput as {
        name: string;
        icon: string;
        type: string;
        routineSlot: string;
        energyType?: string;
        lifeArea?: string;
        duration?: number;
        isDuration?: boolean;
        triggerAction?: string;
        minimalDose?: string;
        whyToday?: string;
        whyMonth?: string;
        whyYear?: string;
        whyIdentity?: string;
        isItBeneficial?: string;
        breakTrigger?: string;
        replacement?: string;
      };

      // Check for duplicate — exact name match only (case-insensitive)
      const existing = await prisma.habit.findFirst({
        where: {
          userId,
          name: { equals: input.name, mode: "insensitive" },
          isActive: true,
        },
      });

      if (existing) {
        return {
          text: `Привычка "${existing.name}" уже существует (id: ${existing.id}, icon: ${existing.icon}, slot: ${existing.routineSlot}). Создать с другим названием?`,
          actions: [],
        };
      }

      const maxOrder = await prisma.habit.aggregate({
        where: { userId, routineSlot: input.routineSlot },
        _max: { sortOrder: true },
      });

      const habit = await prisma.habit.create({
        data: {
          userId,
          name: input.name,
          icon: input.icon,
          type: input.type,
          routineSlot: input.routineSlot,
          energyType: input.energyType || null,
          lifeArea: input.lifeArea || null,
          duration: input.duration || null,
          isDuration: input.isDuration ?? (input.duration ? input.duration >= 10 : false),
          triggerAction: input.triggerAction || null,
          minimalDose: input.minimalDose || null,
          frequency: "daily",
          whyToday: input.whyToday || null,
          whyMonth: input.whyMonth || null,
          whyYear: input.whyYear || null,
          whyIdentity: input.whyIdentity || null,
          isItBeneficial: input.isItBeneficial || null,
          breakTrigger: input.breakTrigger || null,
          replacement: input.replacement || null,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        },
      });

      // Build confirmation with filled fields
      const fields: string[] = [];
      if (habit.lifeArea) fields.push(`сфера: ${habit.lifeArea}`);
      if (habit.duration) fields.push(`${habit.duration} мин`);
      if (habit.isDuration) fields.push("с таймером");
      if (habit.triggerAction) fields.push(`триггер: ${habit.triggerAction}`);
      if (habit.minimalDose) fields.push(`минимум: ${habit.minimalDose}`);
      const meaningFilled = input.whyToday || input.isItBeneficial;
      if (meaningFilled) fields.push("смысл заполнен");

      const details = fields.length > 0 ? ` (${fields.join(", ")})` : "";
      return {
        text: `Привычка создана! "${habit.name}" ${habit.icon}, ${habit.routineSlot}${details}.${!meaningFilled ? " ВНИМАНИЕ: смысл не заполнен — спроси пользователя 'зачем эта привычка?'" : ""}`,
        actions: [],
      };
    }

    case "update_habit": {
      const input = toolInput as { habitId: number } & Record<string, unknown>;
      const habit = await prisma.habit.findFirst({
        where: { id: input.habitId, userId, isActive: true },
      });
      if (!habit) {
        return { text: `Привычка с ID ${input.habitId} не найдена.`, actions: [] };
      }

      const updateData: Record<string, unknown> = {};
      const allowedFields = [
        "name", "icon", "routineSlot", "duration", "isDuration", "triggerAction",
        "minimalDose", "whyToday", "whyMonth", "whyYear", "whyIdentity",
        "lifeArea", "energyType",
      ];
      for (const field of allowedFields) {
        if (input[field] !== undefined) updateData[field] = input[field];
      }

      if (Object.keys(updateData).length === 0) {
        return { text: "Нет полей для обновления.", actions: [] };
      }

      await prisma.habit.update({ where: { id: habit.id }, data: updateData });
      const changedFields = Object.keys(updateData).join(", ");
      return {
        text: `Привычка "${habit.name}" обновлена (${changedFields}).`,
        actions: [],
      };
    }

    case "delete_habit": {
      const input = toolInput as { habitId: number };
      const habit = await prisma.habit.findFirst({
        where: { id: input.habitId, userId, isActive: true },
      });
      if (!habit) {
        return { text: `Привычка с ID ${input.habitId} не найдена.`, actions: [] };
      }

      await prisma.habit.update({ where: { id: habit.id }, data: { isActive: false } });
      return {
        text: `Привычка "${habit.name}" ${habit.icon} удалена.`,
        actions: [],
      };
    }

    case "start_energy_checkin": {
      return {
        text: "Чекин энергии запущен — пользователю отправлены кнопки для оценки.",
        actions: [{ type: "start_checkin" }],
      };
    }

    case "get_user_habits": {
      const habits = await prisma.habit.findMany({
        where: { userId, isActive: true },
        orderBy: { routineSlot: "asc" },
      });

      if (habits.length === 0) {
        return { text: "У пользователя пока нет активных привычек.", actions: [] };
      }

      const list = habits
        .map(
          (h) =>
            `- ${h.icon} ${h.name} (${h.routineSlot}, streak: ${h.streakCurrent}, stage: ${h.stage})`,
        )
        .join("\n");

      return {
        text: `Активные привычки (${habits.length}):\n${list}`,
        actions: [],
      };
    }

    case "set_timezone": {
      const input = toolInput as { timezone: string; city?: string };
      // Validate timezone
      try {
        new Date().toLocaleString("en-US", { timeZone: input.timezone });
      } catch {
        return { text: `Неизвестный часовой пояс: ${input.timezone}`, actions: [] };
      }
      await prisma.user.update({
        where: { id: userId },
        data: { timezone: input.timezone },
      });
      const nowLocal = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: input.timezone });
      return {
        text: `Часовой пояс обновлён: ${input.timezone}${input.city ? ` (${input.city})` : ""}. Сейчас у пользователя ${nowLocal}. Утренний чекин в 09:00, вечерний в 21:00 по местному.`,
        actions: [],
      };
    }

    case "rate_life_area": {
      const input = toolInput as { area: string; score: number; note?: string; subScores?: Record<string, number>; assessmentType?: string };
      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      const clampedScore = Math.max(1, Math.min(10, Math.round(input.score)));

      // Clamp subScores values to 1-10
      let clampedSubScores: Record<string, number> | undefined;
      if (input.subScores) {
        clampedSubScores = {};
        for (const [key, val] of Object.entries(input.subScores)) {
          clampedSubScores[key] = Math.max(1, Math.min(10, Math.round(val)));
        }
      }

      await (prisma.balanceRating.create as any)({
        data: {
          userId,
          area: input.area,
          score: clampedScore,
          note: input.note || null,
          ...(clampedSubScores ? { subScores: clampedSubScores } : {}),
          ...(input.assessmentType ? { assessmentType: input.assessmentType } : {}),
        },
      });

      // Get all latest ratings for context
      const allAreas = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
      const latestRatings: string[] = [];
      for (const area of allAreas) {
        const latest = await prisma.balanceRating.findFirst({
          where: { userId, area },
          orderBy: { createdAt: "desc" },
        });
        if (latest) {
          latestRatings.push(`${AREA_LABELS[area]}: ${latest.score}/10`);
        }
      }

      // Show subScores in confirmation
      let subScoresText = "";
      if (clampedSubScores) {
        const parts = Object.entries(clampedSubScores).map(([k, v]) => `${k}: ${v}`);
        subScoresText = `\nАспекты: ${parts.join(", ")}`;
      }

      return {
        text: `Оценка записана: ${AREA_LABELS[input.area] || input.area} = ${clampedScore}/10${input.assessmentType === "ai_guided" ? " (AI-guided)" : ""}.${subScoresText}\n\nТекущий баланс:\n${latestRatings.join("\n") || "Только одна сфера оценена."}`,
        actions: [],
      };
    }

    case "start_balance_assessment": {
      const input = toolInput as { areas?: string[] };
      const ALL_AREAS = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
      const AREA_LABELS_ASSESS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };
      const targetAreas = input.areas && input.areas.length > 0 ? input.areas.filter(a => ALL_AREAS.includes(a)) : ALL_AREAS;

      const sections: string[] = [];
      for (const area of targetAreas) {
        const parts: string[] = [`📊 ${AREA_LABELS_ASSESS[area] || area}`];

        // Last rating
        const lastRating = await prisma.balanceRating.findFirst({
          where: { userId, area },
          orderBy: { createdAt: "desc" },
        });
        if (lastRating) {
          const daysAgo = Math.floor((Date.now() - lastRating.createdAt.getTime()) / (1000 * 60 * 60 * 24));
          parts.push(`Последняя оценка: ${lastRating.score}/10 (${daysAgo}д назад)`);
        } else {
          parts.push("Оценок ещё нет");
        }

        // Goal
        const goal = await (prisma as any).balanceGoal.findUnique({
          where: { userId_area: { userId, area } },
        });
        if (goal) {
          const goalParts: string[] = [];
          if (goal.targetScore) goalParts.push(`цель: ${goal.targetScore}/10`);
          if (goal.identity) goalParts.push(`идентичность: "${goal.identity}"`);
          if (goal.isFocus) goalParts.push("в фокусе");
          if (goalParts.length > 0) parts.push(`Цель: ${goalParts.join(", ")}`);
        }

        // Habits count
        const habitCount = await prisma.habit.count({
          where: { userId, lifeArea: area, isActive: true },
        });
        if (habitCount > 0) parts.push(`Привычек: ${habitCount}`);

        // Health: avg energy last 7 days
        if (area === "health") {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const energyLogs = await prisma.energyLog.findMany({
            where: { userId, createdAt: { gte: weekAgo } },
          });
          if (energyLogs.length > 0) {
            const avgPhysical = energyLogs.reduce((sum, l) => sum + l.physical, 0) / energyLogs.length;
            parts.push(`Средняя физ. энергия (7д): ${avgPhysical.toFixed(1)}/10`);
          }
        }

        sections.push(parts.join("\n"));
      }

      return {
        text: `Данные для оценки баланса:\n\n${sections.join("\n\n")}`,
        actions: [],
      };
    }

    case "set_balance_goal": {
      const input = toolInput as { area: string; targetScore?: number; identity?: string; isFocus?: boolean };
      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      const updateData: Record<string, unknown> = {};
      if (input.targetScore !== undefined) updateData.targetScore = Math.max(1, Math.min(10, Math.round(input.targetScore)));
      if (input.identity !== undefined) updateData.identity = input.identity;
      if (input.isFocus !== undefined) updateData.isFocus = input.isFocus;

      await (prisma as any).balanceGoal.upsert({
        where: { userId_area: { userId, area: input.area } },
        create: { userId, area: input.area, ...updateData },
        update: updateData,
      });

      const parts: string[] = [];
      if (updateData.targetScore) parts.push(`цель: ${updateData.targetScore}/10`);
      if (updateData.identity) parts.push(`идентичность: "${updateData.identity}"`);
      if (updateData.isFocus !== undefined) parts.push(updateData.isFocus ? "в фокусе" : "не в фокусе");

      return {
        text: `Цель для ${AREA_LABELS[input.area] || input.area} обновлена: ${parts.join(", ") || "без изменений"}.`,
        actions: [],
      };
    }

    case "save_algorithm": {
      const input = toolInput as {
        title: string;
        icon: string;
        lifeArea?: string;
        steps: string[];
        context?: string;
      };

      // Check for duplicate title
      const existingAlgo = await prisma.algorithm.findFirst({
        where: {
          userId,
          title: { equals: input.title, mode: "insensitive" },
          isActive: true,
        },
      });

      if (existingAlgo) {
        return {
          text: `Алгоритм "${existingAlgo.title}" уже существует (id: ${existingAlgo.id}). Обновить его или создать с другим названием?`,
          actions: [],
        };
      }

      const algorithm = await prisma.algorithm.create({
        data: {
          userId,
          title: input.title,
          icon: input.icon,
          lifeArea: input.lifeArea || null,
          steps: input.steps,
          context: input.context || null,
        },
      });

      return {
        text: `Алгоритм сохранён: ${algorithm.icon} "${algorithm.title}" (${input.steps.length} шагов).${input.lifeArea ? ` Сфера: ${input.lifeArea}.` : ""} Доступен в мини-приложении.`,
        actions: [],
      };
    }

    case "get_algorithms": {
      const input = toolInput as { query?: string; lifeArea?: string };

      const where: Record<string, unknown> = { userId, isActive: true };

      if (input.lifeArea) {
        where.lifeArea = input.lifeArea;
      }

      if (input.query && input.query.trim()) {
        where.OR = [
          { title: { contains: input.query.trim(), mode: "insensitive" } },
          { context: { contains: input.query.trim(), mode: "insensitive" } },
        ];
      }

      const algorithms = await prisma.algorithm.findMany({
        where,
        orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        take: 5,
      });

      if (algorithms.length === 0) {
        return {
          text: input.query
            ? `Алгоритмов по запросу "${input.query}" не найдено. Можно создать новый.`
            : "У пользователя пока нет сохранённых алгоритмов.",
          actions: [],
        };
      }

      // Increment usage for viewed algorithms
      for (const algo of algorithms) {
        await prisma.algorithm.update({
          where: { id: algo.id },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        });
      }

      const list = algorithms
        .map((a) => {
          const steps = (a.steps as string[]).slice(0, 3).join(", ");
          return `${a.icon} ${a.title} (${(a.steps as string[]).length} шагов): ${steps}...`;
        })
        .join("\n");

      return {
        text: `Найдено ${algorithms.length} алгоритм(ов):\n${list}`,
        actions: [],
      };
    }

    default:
      return { text: `Неизвестный инструмент: ${toolName}`, actions: [] };
  }
}

// --- Sessions ---

async function getActiveSession(userId: number): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.session.findFirst({
    where: { userId, status: "active", createdAt: { gte: today } },
  });

  if (existing) return existing.id;

  // Summarize and close old sessions
  const oldSessions = await prisma.session.findMany({
    where: { userId, status: "active" },
  });
  for (const oldSession of oldSessions) {
    await summarizeSession(oldSession.id);
  }
  await prisma.session.updateMany({
    where: { userId, status: "active" },
    data: { status: "completed" },
  });

  const session = await prisma.session.create({
    data: { userId, status: "active" },
  });

  return session.id;
}

// --- Observations ---

/**
 * Parse and save structured observations from AI response.
 * Also sanitize unclosed DATA tags that leak when max_tokens truncates output.
 */
async function extractAndSaveObservations(
  reply: string,
  userId: number,
  sessionId: number,
): Promise<string> {
  // First: remove complete DATA blocks and parse them
  const dataRegex = /<!--DATA:(.*?)-->/g;
  let match;
  let cleanReply = reply.replace(dataRegex, "").trim();

  // Second: remove any unclosed/truncated DATA blocks (from max_tokens cutoff)
  cleanReply = cleanReply.replace(/<!--DATA:.*$/s, "").trim();

  while ((match = dataRegex.exec(reply)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const energyType = data.energyType || "unknown";
      const direction = data.direction || "stable";
      const trigger = data.trigger || null;

      // Deduplicate: skip if similar observation exists within last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existing = await prisma.observation.findFirst({
        where: {
          userId,
          energyType,
          direction,
          createdAt: { gte: oneHourAgo },
          ...(trigger ? { trigger: { contains: trigger.slice(0, 20) } } : {}),
        },
      });

      if (existing) {
        continue; // Skip duplicate
      }

      const observationData: Record<string, unknown> = {
        userId,
        energyType,
        direction,
        level: data.level || null,
        trigger,
        recommendation: data.recommendation || null,
        context: data.context || null,
        sessionId,
      };

      // If AI specified a "when" date, use it as createdAt
      if (data.when) {
        const whenDate = new Date(data.when);
        if (!isNaN(whenDate.getTime())) {
          observationData.createdAt = whenDate;
        }
      }

      await prisma.observation.create({ data: observationData as any });
    } catch (e) {
      console.error("Failed to parse observation:", e);
    }
  }

  return cleanReply;
}

// --- Main Chat ---

export async function chat(
  telegramId: bigint,
  userMessage: string,
  userName: string,
  messageType: "text" | "voice" = "text",
): Promise<ChatResult> {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return { text: "Напиши /start чтобы начать.", actions: [] };

  const sessionId = await getActiveSession(user.id);

  // Save user message
  await prisma.message.create({
    data: { userId: user.id, role: "user", content: userMessage, type: messageType, sessionId },
  });

  // Load history from current session
  const dbMessages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  const history: Anthropic.MessageParam[] = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Build context
  const context = await buildUserContext(user.id);
  const now = new Date();
  const TZ = user.timezone || "Asia/Shanghai";
  const dateStr = now.toLocaleDateString("ru-RU", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: TZ });
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  // Calculate UTC offset for ISO string
  const offsetMinutes = -new Date(now.toLocaleString("en-US", { timeZone: TZ })).getTimezoneOffset();
  const isoNow = now.toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T");

  const voiceNote = messageType === "voice"
    ? "\nПоследнее сообщение — расшифровка голосового (Whisper). Могут быть неточности в именах, терминах. Если смысл неясен — переспроси."
    : "";

  const systemWithContext = SYSTEM_PROMPT +
    `\n\nТекущая дата и время: ${dateStr}, ${timeStr} (${isoNow})` +
    `\nИмя пользователя: ${userName}` +
    voiceNote +
    (context ? `\n\n${context}` : "");

  const allActions: ChatAction[] = [];

  try {
    const rawReply = await measured("ai_response_ms", async () => {
      let response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemWithContext,
        messages: history,
        tools: TOOLS,
      });

      // Tool use loop (max 3 iterations to prevent infinite loops)
      let iterations = 0;
      while (response.stop_reason === "tool_use" && iterations < 3) {
        iterations++;

        // Execute all tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(block.name, block.input as Record<string, unknown>, user.id);
            allActions.push(...result.actions);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result.text,
            });
          }
        }

        // Send tool results back to get final response
        history.push({ role: "assistant", content: response.content as Anthropic.ContentBlockParam[] });
        history.push({ role: "user", content: toolResults });

        response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemWithContext,
          messages: history,
          tools: TOOLS,
        });
      }

      // Extract text from final response
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const text = textBlocks.map((b) => b.text).join("\n");
      if (!text && allActions.length > 0) {
        // AI used tools but didn't produce text — actions speak for themselves
        return "";
      }
      if (!text) {
        return "";
      }

      // Filter out useless emoji-only or ultra-short responses (e.g. "👍")
      // These pollute history and cause self-reinforcing loops
      const stripped = text.replace(/<!--DATA:.*?-->/gs, "").replace(/\s+/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
      if (stripped.length < 2 && !text.includes("<!--DATA:")) {
        // AI gave a useless response like "👍" — don't save it, force retry
        return "";
      }
      return text;
    }, { historyLength: String(history.length) });

    // Extract observations and clean reply
    const cleanReply = await extractAndSaveObservations(rawReply, user.id, sessionId);

    // Don't save empty/useless replies to history — they pollute context
    // and cause self-reinforcing loops where AI keeps repeating the pattern
    if (cleanReply.trim()) {
      await prisma.message.create({
        data: { userId: user.id, role: "assistant", content: cleanReply, sessionId },
      });
    }

    return { text: cleanReply, actions: allActions };
  } catch (error) {
    await trackError("ai", error, { userId: user.id, historyLength: history.length });
    console.error("AI chat error:", error);
    return { text: "Прости, не могу ответить прямо сейчас 😔 Попробуй через минутку.", actions: [] };
  }
}

// --- Context ---

async function buildUserContext(userId: number): Promise<string> {
  try {
    const lines: string[] = [];

    // Recent energy logs
    const logs = await prisma.energyLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (logs.length > 0) {
      const latest = logs[0];
      const ageMinutes = Math.round((Date.now() - latest.createdAt.getTime()) / 60000);
      const ageStr = ageMinutes < 60 ? `${ageMinutes} мин назад` : `${Math.round(ageMinutes / 60)} ч назад`;
      lines.push(
        `Последняя запись энергии (${latest.createdAt.toLocaleDateString("ru")}, ${ageStr}):`,
        `  🏃 Физическая: ${latest.physical}/10  🧠 Ментальная: ${latest.mental}/10`,
        `  💚 Эмоциональная: ${latest.emotional}/10  🔮 Духовная: ${latest.spiritual}/10`,
      );

      const energies = [
        { type: "физическая", value: latest.physical, key: EnergyType.physical },
        { type: "ментальная", value: latest.mental, key: EnergyType.mental },
        { type: "эмоциональная", value: latest.emotional, key: EnergyType.emotional },
        { type: "духовная", value: latest.spiritual, key: EnergyType.spiritual },
      ];
      const lowest = energies.reduce((a, b) => (a.value < b.value ? a : b));

      if (lowest.value <= 5) {
        const practices = getRecoveryPractices(lowest.key);
        const top3 = practices.slice(0, 3).map(p => p.name).join(", ");
        lines.push(`⚠️ ${lowest.type} низкая (${lowest.value}/10). Практики: ${top3}`);
      }
    }

    // Life balance ratings
    const AREA_LABELS: Record<string, string> = {
      health: "Здоровье", career: "Карьера", relationships: "Отношения",
      finances: "Финансы", family: "Семья", growth: "Развитие",
      recreation: "Отдых", environment: "Среда",
    };
    const balanceAreas = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
    const balanceLines: string[] = [];
    for (const area of balanceAreas) {
      const latest = await prisma.balanceRating.findFirst({
        where: { userId, area },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        const age = Math.round((Date.now() - latest.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        balanceLines.push(`  ${AREA_LABELS[area]}: ${latest.score}/10 (${age}д назад)`);
      }
    }
    if (balanceLines.length > 0) {
      lines.push("\nБаланс жизни:");
      lines.push(...balanceLines);
      const rated = balanceLines.length;
      if (rated < 8) {
        lines.push(`  ⚠️ Оценено ${rated}/8 сфер. Предложи оценить остальные.`);
      }
    }

    // Active habits
    const habits = await prisma.habit.findMany({
      where: { userId, isActive: true },
      orderBy: { routineSlot: "asc" },
    });

    if (habits.length > 0) {
      lines.push("\nАктивные привычки:");
      for (const h of habits) {
        lines.push(`  ${h.icon} ${h.name} (${h.routineSlot}, streak: ${h.streakCurrent})`);
      }
    }

    // Recent observations + pattern analysis
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const observations = await prisma.observation.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
    });

    if (observations.length > 0) {
      // Last 10 individual observations with details
      lines.push("\nПоследние наблюдения:");
      for (const o of observations.slice(0, 10)) {
        const emoji = { physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮" }[o.energyType] || "•";
        const date = o.createdAt.toLocaleDateString("ru");
        const trigger = o.trigger ? ` (${o.trigger})` : "";
        const detail = o.context ? ` — ${o.context}` : "";
        lines.push(`  ${date} ${emoji} ${o.energyType} ${o.direction}${trigger}${detail}`);
      }

      // Aggregate trigger patterns with details
      const triggerFreq = new Map<string, { count: number; direction: string; types: Set<string>; details: string[] }>();
      for (const o of observations) {
        if (!o.trigger) continue;
        const key = `${o.trigger}:${o.direction}`;
        const existing = triggerFreq.get(key);
        if (existing) {
          existing.count++;
          existing.types.add(o.energyType);
          if (o.context) existing.details.push(o.context);
        } else {
          triggerFreq.set(key, { count: 1, direction: o.direction, types: new Set([o.energyType]), details: o.context ? [o.context] : [] });
        }
      }

      const patterns = [...triggerFreq.entries()]
        .map(([k, v]) => ({ trigger: k.split(":")[0], ...v, types: [...v.types] }))
        .filter(p => p.count >= 2)
        .sort((a, b) => b.count - a.count);

      if (patterns.length > 0) {
        lines.push("\nПаттерны за месяц (повторяющиеся триггеры):");
        for (const p of patterns.slice(0, 8)) {
          const arrow = p.direction === "rise" ? "↑" : "↓";
          lines.push(`  ${arrow} "${p.trigger}" — ${p.count}× (${p.types.join(", ")})`);
          // Show specific situations for context
          const uniqueDetails = [...new Set(p.details)].slice(0, 3);
          for (const d of uniqueDetails) {
            lines.push(`      → ${d}`);
          }
        }
      }
    }

    // Yesterday's recommendations for follow-up
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterdayRecs = await prisma.observation.findMany({
      where: {
        userId,
        recommendation: { not: null },
        createdAt: { gte: yesterday, lt: today },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    if (yesterdayRecs.length > 0) {
      lines.push("\nВчерашние рекомендации (спроси помогло ли, КОРОТКО, 1 вопрос):");
      for (const r of yesterdayRecs) {
        lines.push(`  → ${r.recommendation} (${r.energyType}, trigger: ${r.trigger || "?"})`);
      }
    }

    // Recent sessions
    const sessions = await prisma.session.findMany({
      where: { userId, status: "completed", summary: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    if (sessions.length > 0) {
      lines.push("\nПрошлые разговоры:");
      for (const s of sessions) {
        lines.push(`  ${s.createdAt.toLocaleDateString("ru")}: ${s.summary}`);
      }
    }

    return lines.length > 0 ? lines.join("\n") : "Новый пользователь.";
  } catch {
    return "";
  }
}

// --- Session Summary ---

export async function summarizeSession(sessionId: number): Promise<void> {
  try {
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    if (messages.length === 0) return;

    const transcript = messages
      .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      system: "Кратко резюмируй разговор в 1-2 предложениях на русском: что обсуждалось и какие ключевые наблюдения. Без приветствий, только суть.",
      messages: [{ role: "user", content: transcript }],
    });

    const block = response.content[0];
    const summary = block.type === "text" ? block.text : null;

    if (summary) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { summary },
      });
    }
  } catch (err) {
    console.error("Failed to summarize session:", err);
  }
}

// --- Compatibility Exports ---

export async function askAI(userMessage: string, _context?: string): Promise<string> {
  const result = await chat(BigInt(0), userMessage, "пользователь");
  return result.text;
}

export async function personalizeRecommendation(
  practiceName: string,
  practiceDescription: string,
  userContext: string,
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: "Персонализируй рекомендацию кратко, 2-3 предложения. На русском.",
      messages: [{ role: "user", content: `Практика: "${practiceName}" — ${practiceDescription}\n\nКонтекст: ${userContext}` }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : practiceDescription;
  } catch {
    return practiceDescription;
  }
}
