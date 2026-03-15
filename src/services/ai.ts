import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import prisma from "../db.js";
import { getRecoveryPractices } from "../knowledge/index.js";
import { EnergyType } from "../knowledge/types.js";

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

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

Как ты ведёшь диалог:
- Коротко, 2-4 предложения. Как друг в мессенджере.
- Сначала СЛУШАЕШЬ, потом спрашиваешь. Не давай советы сразу.
- Один вопрос за раз.
- Если человек говорит про усталость — выясни КАКАЯ энергия просела.
- Эмодзи умеренно, к месту.
- Запоминай контекст, ссылайся на прошлое.
- Русский язык.

ВАЖНО — ТЫ ЧАСТЬ СИСТЕМЫ:
- Ты встроен в Telegram-бота с базой данных и мини-приложением.
- ВСЕ разговоры автоматически сохраняются в базу данных.
- Ты НЕ "просто чат-помощник". Ты — ядро системы управления энергией.
- Когда человек рассказывает о своём состоянии — данные автоматически попадают в дашборд мини-приложения.
- НИКОГДА не говори что у тебя "нет доступа к базе" или "нет доступа к мини-приложению" — у тебя есть.
- Если человек спросит про базу или данные — скажи что всё сохраняется автоматически и видно в Energy App.

ВАЖНО — СТРУКТУРИРОВАННЫЕ ДАННЫЕ:
Если из разговора ты понимаешь что-то о состоянии энергии человека, добавь в САМЫЙ КОНЕЦ ответа блок данных в формате:
<!--DATA:{"energyType":"physical|mental|emotional|spiritual","direction":"drop|rise|stable|low|high","level":null,"trigger":"причина если понятна","recommendation":"совет если дал","context":"краткое описание ситуации"}-->

Примеры:
- Человек говорит "устал после 5 часов кодинга" → <!--DATA:{"energyType":"mental","direction":"drop","level":null,"trigger":"5 часов непрерывного кодинга","recommendation":null,"context":"ментальная перегрузка от работы"}-->
- Человек говорит "поссорился с женой" → <!--DATA:{"energyType":"emotional","direction":"drop","level":null,"trigger":"конфликт с женой","recommendation":null,"context":"эмоциональный конфликт в семье"}-->
- Ты посоветовал прогулку → <!--DATA:{"energyType":"mental","direction":"drop","level":null,"trigger":"переработка","recommendation":"прогулка без телефона 15 мин","context":"рекомендация на расфокус"}-->

Если ничего про энергию не понятно (просто болтовня) — НЕ добавляй DATA блок.
Можно добавить НЕСКОЛЬКО блоков если затронуто несколько энергий.

"Отдых — часть работы, работа — часть отдыха"`;

async function getActiveSession(userId: number): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.session.findFirst({
    where: { userId, status: "active", createdAt: { gte: today } },
  });

  if (existing) return existing.id;

  // Close old sessions
  await prisma.session.updateMany({
    where: { userId, status: "active" },
    data: { status: "completed" },
  });

  const session = await prisma.session.create({
    data: { userId, status: "active" },
  });

  return session.id;
}

/**
 * Parse and save structured observations from AI response
 */
async function extractAndSaveObservations(
  reply: string,
  userId: number,
  sessionId: number,
): Promise<string> {
  const dataRegex = /<!--DATA:(.*?)-->/g;
  let match;
  const cleanReply = reply.replace(dataRegex, "").trim();

  while ((match = dataRegex.exec(reply)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      await prisma.observation.create({
        data: {
          userId,
          energyType: data.energyType || "unknown",
          direction: data.direction || "stable",
          level: data.level || null,
          trigger: data.trigger || null,
          recommendation: data.recommendation || null,
          context: data.context || null,
          sessionId,
        },
      });
    } catch (e) {
      console.error("Failed to parse observation:", e);
    }
  }

  return cleanReply;
}

export async function chat(
  telegramId: bigint,
  userMessage: string,
  userName: string,
  messageType: "text" | "voice" = "text",
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return "Напиши /start чтобы начать.";

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

  const history = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Build context
  const context = await buildUserContext(user.id);
  const systemWithContext = SYSTEM_PROMPT +
    `\n\nИмя пользователя: ${userName}` +
    (context ? `\n\n${context}` : "");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemWithContext,
      messages: history,
    });

    const block = response.content[0];
    const rawReply = block.type === "text" ? block.text : "Хм, что-то пошло не так 😅";

    // Extract observations and clean reply
    const cleanReply = await extractAndSaveObservations(rawReply, user.id, sessionId);

    // Save clean reply to DB
    await prisma.message.create({
      data: { userId: user.id, role: "assistant", content: cleanReply, sessionId },
    });

    return cleanReply;
  } catch (error) {
    console.error("AI chat error:", error);
    return "Прости, не могу ответить прямо сейчас 😔 Попробуй через минутку.";
  }
}

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
      lines.push(
        `Последняя запись энергии (${latest.createdAt.toLocaleDateString("ru")}):`,
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

    // Recent observations (structured insights from past conversations)
    const observations = await prisma.observation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (observations.length > 0) {
      lines.push("\nИстория наблюдений:");
      for (const o of observations) {
        const emoji = { physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮" }[o.energyType] || "•";
        const date = o.createdAt.toLocaleDateString("ru");
        const trigger = o.trigger ? ` (${o.trigger})` : "";
        lines.push(`  ${date} ${emoji} ${o.energyType} ${o.direction}${trigger}`);
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

// Compatibility exports
export async function askAI(userMessage: string, context?: string): Promise<string> {
  return chat(BigInt(0), userMessage, "пользователь");
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
