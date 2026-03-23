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
    description: "Создать новую привычку для пользователя в системе. Используй когда пользователь просит добавить или создать привычку. Это РЕАЛЬНОЕ действие — привычка появится в мини-приложении.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Название привычки, например 'Интервальное голодание 16:8'" },
        icon: { type: "string", description: "Эмодзи иконка, например '🍽'" },
        type: { type: "string", enum: ["build", "break"], description: "build = формировать новую, break = избавиться от старой" },
        routineSlot: { type: "string", enum: ["morning", "afternoon", "evening"], description: "Время дня для привычки" },
        energyType: { type: "string", enum: ["physical", "mental", "emotional", "spiritual"], description: "Тип энергии, на который влияет привычка" },
        lifeArea: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Сфера жизни: здоровье, карьера, отношения, финансы, семья, развитие, отдых, среда" },
        whyToday: { type: "string", description: "ОБЯЗАТЕЛЬНО для build: какая конкретная выгода сегодня?" },
        whyYear: { type: "string", description: "ОБЯЗАТЕЛЬНО для build: что изменится через год?" },
        whyIdentity: { type: "string", description: "ОБЯЗАТЕЛЬНО для build: кем станешь, когда это привычка?" },
        isItBeneficial: { type: "string", description: "ОБЯЗАТЕЛЬНО для break: выгодно ли это организму?" },
        breakTrigger: { type: "string", description: "ОБЯЗАТЕЛЬНО для break: что триггерит эту привычку?" },
        replacement: { type: "string", description: "ОБЯЗАТЕЛЬНО для break: что делать вместо?" },
      },
      required: ["name", "icon", "type", "routineSlot"],
    },
  },
  {
    name: "start_energy_checkin",
    description: "Запустить оценку энергии с интерактивными кнопками (InlineKeyboard). Используй ВМЕСТО текстовых вопросов про уровень энергии. Когда хочешь узнать как у человека с энергией — вызови этот инструмент.",
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
    name: "rate_life_area",
    description: "Сохранить оценку сферы жизни (колесо баланса). Используй когда пользователь оценивает сферу жизни от 1 до 10. Сферы: здоровье, карьера, отношения, финансы, семья, развитие, отдых, среда.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: { type: "string", enum: ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"], description: "Сфера жизни" },
        score: { type: "number", description: "Оценка от 1 до 10" },
        note: { type: "string", description: "Комментарий пользователя (если есть)" },
      },
      required: ["area", "score"],
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

ВАЖНО — ИНСТРУМЕНТЫ:
У тебя есть инструменты для РЕАЛЬНЫХ действий. ИСПОЛЬЗУЙ ИХ:
- create_habit — создать привычку в системе (она реально появится в приложении)
- start_energy_checkin — запустить оценку энергии с кнопками (НЕ спрашивай текстом!)
- get_user_habits — посмотреть текущие привычки пользователя

СОЗДАНИЕ ПРИВЫЧКИ — ОБЯЗАТЕЛЬНЫЙ ФИЛЬТР СМЫСЛА:
Каждая привычка ОБЯЗАНА пройти через призму "зачем". НЕ создавай привычку без meaning.
- Для build: СПРОСИ "какая выгода сегодня?", "что изменится через год?", "кем станешь?" ПЕРЕД вызовом create_habit.
- Для break: СПРОСИ "выгодно ли организму?", "что триггерит?", "что вместо?" ПЕРЕД вызовом create_habit.
- Передавай ответы в create_habit (whyToday, whyYear, whyIdentity для build; isItBeneficial, breakTrigger, replacement для break).
- Если пользователь дал название + смысл в одном сообщении — создавай сразу.
- Если только название — задай ОДИН вопрос про смысл, потом создай.

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
        whyToday?: string;
        whyYear?: string;
        whyIdentity?: string;
        isItBeneficial?: string;
        breakTrigger?: string;
        replacement?: string;
      };

      // Check for duplicate
      const existing = await prisma.habit.findFirst({
        where: {
          userId,
          name: { contains: input.name.substring(0, 20), mode: "insensitive" },
          isActive: true,
        },
      });

      if (existing) {
        return {
          text: `Привычка "${existing.name}" уже существует (id: ${existing.id}, icon: ${existing.icon}, slot: ${existing.routineSlot}).`,
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
          frequency: "daily",
          whyToday: input.whyToday || null,
          whyYear: input.whyYear || null,
          whyIdentity: input.whyIdentity || null,
          isItBeneficial: input.isItBeneficial || null,
          breakTrigger: input.breakTrigger || null,
          replacement: input.replacement || null,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        },
      });

      const meaningFilled = input.whyToday || input.isItBeneficial;
      return {
        text: `Привычка создана! ID: ${habit.id}, "${habit.name}" ${habit.icon}, ${habit.routineSlot}.${meaningFilled ? " Смысл заполнен." : " ВНИМАНИЕ: смысл не заполнен — попроси пользователя ответить на вопросы 'зачем'."}`,
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

    case "rate_life_area": {
      const input = toolInput as { area: string; score: number; note?: string };
      const AREA_LABELS: Record<string, string> = {
        health: "Здоровье", career: "Карьера", relationships: "Отношения",
        finances: "Финансы", family: "Семья", growth: "Развитие",
        recreation: "Отдых", environment: "Среда",
      };

      await prisma.balanceRating.create({
        data: {
          userId,
          area: input.area,
          score: Math.max(1, Math.min(10, Math.round(input.score))),
          note: input.note || null,
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

      return {
        text: `Оценка записана: ${AREA_LABELS[input.area] || input.area} = ${input.score}/10.\n\nТекущий баланс:\n${latestRatings.join("\n") || "Только одна сфера оценена."}`,
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
  const TZ = "Asia/Shanghai";
  const dateStr = now.toLocaleDateString("ru-RU", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: TZ });
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const isoNow = now.toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T") + "+08:00";

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
      return textBlocks.map((b) => b.text).join("\n") || "👍";
    }, { historyLength: String(history.length) });

    // Extract observations and clean reply
    const cleanReply = await extractAndSaveObservations(rawReply, user.id, sessionId);

    // Save clean reply to DB
    await prisma.message.create({
      data: { userId: user.id, role: "assistant", content: cleanReply, sessionId },
    });

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
