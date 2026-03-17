import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import { trackError, measured } from "./monitor.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const MAX_RETRIES = 2;
const RETRY_DELAYS = [5000, 15000];

/**
 * Transcribe voice message using Gemini
 */
export async function transcribeVoice(audioBuffer: Buffer): Promise<string | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await measured("voice_transcribe_ms", async () => {
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
      }, { size: String(audioBuffer.length), attempt: String(attempt) });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Too Many Requests");

      if (isRateLimit && attempt < MAX_RETRIES) {
        console.log(`Voice transcription rate limited, retry ${attempt + 1}/${MAX_RETRIES} in ${RETRY_DELAYS[attempt]}ms`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }

      await trackError("voice", error, { bufferSize: audioBuffer.length, attempt, isRateLimit });
      console.error("Gemini transcription error:", error);
      return null;
    }
  }

  return null;
}
