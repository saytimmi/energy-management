import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Transcribe voice message using Gemini
 */
export async function transcribeVoice(audioBuffer: Buffer): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/ogg",
          data: audioBuffer.toString("base64"),
        },
      },
      "Расшифруй это голосовое сообщение. Верни ТОЛЬКО текст того что сказал человек, без комментариев и пояснений.",
    ]);

    const text = result.response.text().trim();
    return text || null;
  } catch (error) {
    console.error("Gemini transcription error:", error);
    return null;
  }
}
