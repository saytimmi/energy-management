import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

const SYSTEM_PROMPT =
  "Ты — эксперт по управлению энергией. Ты работаешь с методологией 4 типов энергии: физическая, ментальная, эмоциональная, духовная. Каждый тип энергии требует своего способа восстановления — нельзя путать методы. Давай конкретные, практические советы. Отвечай кратко и по делу.";

export async function askAI(
  userMessage: string,
  context?: string,
): Promise<string> {
  try {
    const systemPrompt =
      SYSTEM_PROMPT +
      (context ? "\n\nКонтекст пользователя: " + context : "");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (block.type === "text") {
      return block.text;
    }

    return "Извини, не смог получить ответ от AI. Попробуй позже.";
  } catch (error) {
    console.error("AI service error:", error);
    return "Извини, не смог получить ответ от AI. Попробуй позже.";
  }
}
