import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import prisma from "../db.js";
import { getRecoveryPractices, getDrainFactors } from "../knowledge/index.js";
import { EnergyType } from "../knowledge/types.js";

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

const SYSTEM_PROMPT = `Ты — тёплый, живой собеседник и эксперт по управлению энергией. Тебя зовут Энерджи. Ты общаешься как близкий друг, а не как робот или коуч из инстаграма.

Ты работаешь с методологией 4 типов энергии:
🏃 Физическая — тело, сон, еда, движение
🧠 Ментальная — фокус, концентрация, когнитивная ясность
💚 Эмоциональная — социальная батарея, отношения, эмоции
🔮 Духовная — смысл, миссия, ценности. Может конвертироваться в любую другую.

ГЛАВНОЕ ПРАВИЛО: Каждый тип энергии восстанавливается ТОЛЬКО своим способом:
- Физическое истощение НЕ лечится мотивацией → нужен сон, еда, движение
- Ментальная перегрузка НЕ лечится кофе → нужен расфокус, медитация, прогулка
- Эмоциональное выгорание НЕ лечится спортом → нужны близкие люди, смех, природа
- Духовная пустота НЕ лечится развлечениями → нужна миссия, помощь другим, размышления о вечном

Как ты общаешься:
- Коротко, по делу, без воды. 2-4 предложения обычно достаточно.
- Используешь эмодзи, но не перебарщиваешь.
- Задаёшь уточняющие вопросы, а не сразу даёшь советы.
- Если человек пишет что устал — сначала пойми КАКАЯ энергия просела, потом помогай.
- Ты не "бот для трекинга", ты друг который понимает энергию.
- Отвечай на русском языке.

"Отдых — часть работы, работа — часть отдыха"`;

// Store conversation history per user (in-memory, resets on restart)
const conversations = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

export async function chat(
  telegramId: bigint,
  userMessage: string,
  userName: string,
): Promise<string> {
  const userId = telegramId.toString();

  // Get or create conversation history
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  const history = conversations.get(userId)!;

  // Build context from recent energy logs
  const context = await buildUserContext(telegramId);

  const systemWithContext = SYSTEM_PROMPT +
    (context ? `\n\nКонтекст пользователя (${userName}):\n${context}` : `\n\nИмя пользователя: ${userName}`);

  // Add user message to history
  history.push({ role: "user", content: userMessage });

  // Keep last 20 messages to stay within limits
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemWithContext,
      messages: history,
    });

    const block = response.content[0];
    const reply = block.type === "text" ? block.text : "Хм, что-то пошло не так. Напиши ещё раз?";

    // Save assistant reply to history
    history.push({ role: "assistant", content: reply });

    return reply;
  } catch (error) {
    console.error("AI chat error:", error);
    return "Прости, не могу ответить прямо сейчас 😔 Попробуй через минутку.";
  }
}

async function buildUserContext(telegramId: bigint): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        energyLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!user || user.energyLogs.length === 0) {
      return "Новый пользователь, ещё нет записей энергии.";
    }

    const latest = user.energyLogs[0];
    const lines = [
      `Последняя запись (${latest.createdAt.toLocaleDateString("ru")}):`,
      `  🏃 Физическая: ${latest.physical}/10`,
      `  🧠 Ментальная: ${latest.mental}/10`,
      `  💚 Эмоциональная: ${latest.emotional}/10`,
      `  🔮 Духовная: ${latest.spiritual}/10`,
    ];

    // Find lowest
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
      lines.push(`\n⚠️ ${lowest.type} энергия низкая (${lowest.value}/10). Рекомендуемые практики: ${top3}`);
    }

    if (user.energyLogs.length > 1) {
      const logs = user.energyLogs;
      const len = logs.length;
      const avg = {
        physical: Math.round(logs.reduce((s: number, l) => s + l.physical, 0) / len),
        mental: Math.round(logs.reduce((s: number, l) => s + l.mental, 0) / len),
        emotional: Math.round(logs.reduce((s: number, l) => s + l.emotional, 0) / len),
        spiritual: Math.round(logs.reduce((s: number, l) => s + l.spiritual, 0) / len),
      };
      lines.push(`\nСредние за ${user.energyLogs.length} записей: 🏃${avg.physical} 🧠${avg.mental} 💚${avg.emotional} 🔮${avg.spiritual}`);
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
