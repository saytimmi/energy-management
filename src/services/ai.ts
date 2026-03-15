import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import prisma from "../db.js";
import { getRecoveryPractices, getDrainFactors } from "../knowledge/index.js";
import { EnergyType } from "../knowledge/types.js";

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

const SYSTEM_PROMPT = `Ты — тёплый, живой собеседник и эксперт по управлению энергией. Тебя зовут Энерджи. Ты общаешься как близкий друг — искренне, с заботой, без формальностей.

Ты работаешь с методологией 4 типов энергии:
🏃 Физическая — тело, сон, еда, движение
🧠 Ментальная — фокус, концентрация, когнитивная ясность
💚 Эмоциональная — социальная батарея, отношения, эмоции
🔮 Духовная — смысл, миссия, ценности. Может конвертироваться в любую другую.

ГЛАВНОЕ ПРАВИЛО: Каждый тип энергии восстанавливается ТОЛЬКО своим способом:
- Физическое истощение НЕ лечится мотивацией → нужен сон, еда, движение
- Ментальная перегрузка НЕ лечится кофе → нужен расфокус, медитация, прогулка
- Эмоциональное выгорание НЕ лечится спортом → нужны близкие люди, смех, природа
- Духовная пустота НЕ лечится развлечениями → нужна миссия, помощь другим

Как ты ведёшь диалог:
- Говоришь коротко, 2-4 предложения. Как друг в мессенджере, не как психолог.
- Сначала СЛУШАЕШЬ, потом спрашиваешь. Не давай советы сразу.
- Задавай один вопрос за раз, не засыпай вопросами.
- Если человек говорит про усталость — выясни КАКАЯ энергия просела.
- Используй эмодзи умеренно, к месту.
- Если чувствуешь что пора предложить записать уровень энергии — предложи мягко.
- Запоминай контекст разговора, ссылайся на то что человек говорил раньше.
- Отвечай на русском языке.

"Отдых — часть работы, работа — часть отдыха"`;

/**
 * Get or create active session for user
 */
async function getActiveSession(userId: number): Promise<number> {
  // Find active session from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.session.findFirst({
    where: {
      userId,
      status: "active",
      createdAt: { gte: today },
    },
  });

  if (existing) return existing.id;

  // Close old active sessions
  await prisma.session.updateMany({
    where: { userId, status: "active" },
    data: { status: "completed" },
  });

  // Create new session for today
  const session = await prisma.session.create({
    data: { userId, status: "active" },
  });

  return session.id;
}

/**
 * Main chat function — saves everything to DB
 */
export async function chat(
  telegramId: bigint,
  userMessage: string,
  userName: string,
  messageType: "text" | "voice" = "text",
): Promise<string> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });
  if (!user) return "Напиши /start чтобы начать.";

  const sessionId = await getActiveSession(user.id);

  // Save user message to DB
  await prisma.message.create({
    data: {
      userId: user.id,
      role: "user",
      content: userMessage,
      type: messageType,
      sessionId,
    },
  });

  // Load conversation history from DB (current session)
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
  const context = await buildUserContext(user.id, telegramId);
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
    const reply = block.type === "text" ? block.text : "Хм, что-то пошло не так 😅";

    // Save assistant reply to DB
    await prisma.message.create({
      data: {
        userId: user.id,
        role: "assistant",
        content: reply,
        sessionId,
      },
    });

    return reply;
  } catch (error) {
    console.error("AI chat error:", error);
    return "Прости, не могу ответить прямо сейчас 😔 Попробуй через минутку.";
  }
}

/**
 * Process voice message — download, send to Claude as audio
 */
export async function chatVoice(
  telegramId: bigint,
  audioBuffer: Buffer,
  userName: string,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return "Напиши /start чтобы начать.";

  const sessionId = await getActiveSession(user.id);

  // Send audio to Claude for transcription + response
  const base64Audio = audioBuffer.toString("base64");

  // Load conversation history
  const dbMessages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  const history: Array<{ role: "user" | "assistant"; content: string | Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> }> = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Add voice message as audio content
  history.push({
    role: "user",
    content: [
      {
        type: "audio" as const,
        source: {
          type: "base64" as const,
          media_type: "audio/ogg",
          data: base64Audio,
        },
      },
      {
        type: "text" as const,
        text: "Это голосовое сообщение от пользователя. Ответь на то что он сказал.",
      },
    ] as any,
  });

  const context = await buildUserContext(user.id, telegramId);
  const systemWithContext = SYSTEM_PROMPT +
    `\n\nИмя пользователя: ${userName}` +
    (context ? `\n\n${context}` : "");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemWithContext,
      messages: history as any,
    });

    const block = response.content[0];
    const reply = block.type === "text" ? block.text : "Не расслышал, напиши текстом? 😅";

    // Save to DB (we don't know the exact transcription, save as voice type)
    await prisma.message.create({
      data: { userId: user.id, role: "user", content: "[голосовое сообщение]", type: "voice", sessionId },
    });
    await prisma.message.create({
      data: { userId: user.id, role: "assistant", content: reply, sessionId },
    });

    return reply;
  } catch (error) {
    console.error("Voice processing error:", error);
    // Fallback — ask to type
    return "Прости, не смог обработать голосовое 😔 Напиши текстом?";
  }
}

async function buildUserContext(userId: number, telegramId: bigint): Promise<string> {
  try {
    const logs = await prisma.energyLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (logs.length === 0) {
      return "Новый пользователь, записей энергии ещё нет.";
    }

    const latest = logs[0];
    const lines = [
      `Последняя запись энергии (${latest.createdAt.toLocaleDateString("ru")}):`,
      `  🏃 Физическая: ${latest.physical}/10`,
      `  🧠 Ментальная: ${latest.mental}/10`,
      `  💚 Эмоциональная: ${latest.emotional}/10`,
      `  🔮 Духовная: ${latest.spiritual}/10`,
    ];

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
      lines.push(`\n⚠️ ${lowest.type} энергия низкая (${lowest.value}/10). Практики: ${top3}`);
    }

    // Recent sessions summary
    const recentSessions = await prisma.session.findMany({
      where: { userId, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { messages: { take: 2, orderBy: { createdAt: "asc" } } },
    });

    if (recentSessions.length > 0) {
      lines.push("\nПоследние разговоры:");
      for (const s of recentSessions) {
        const firstMsg = s.messages[0]?.content || "";
        const preview = firstMsg.substring(0, 60);
        lines.push(`  ${s.createdAt.toLocaleDateString("ru")}: "${preview}..."`);
      }
    }

    return lines.join("\n");
  } catch {
    return "";
  }
}

// Keep old exports for compatibility
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
