import { config } from "../config.js";
import { trackError, measured } from "./monitor.js";

const MAX_RETRIES = 2;
const RETRY_DELAYS = [3000, 10000];

/**
 * Transcribe voice message using Groq Whisper API
 */
export async function transcribeVoice(audioBuffer: Buffer): Promise<string | null> {
  if (!config.groqApiKey) {
    console.error("GROQ_API_KEY not set, skipping transcription");
    return null;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await measured("voice_transcribe_ms", async () => {
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" });
        const formData = new FormData();
        formData.append("file", blob, "voice.ogg");
        formData.append("model", "whisper-large-v3-turbo");
        formData.append("language", "ru");

        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${config.groqApiKey}` },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Groq ${res.status}: ${errText}`);
        }

        const data = await res.json() as { text?: string };
        return data.text?.trim() || null;
      }, { size: String(audioBuffer.length), attempt: String(attempt) });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("rate");

      if (isRateLimit && attempt < MAX_RETRIES) {
        console.log(`Groq rate limited, retry ${attempt + 1}/${MAX_RETRIES} in ${RETRY_DELAYS[attempt]}ms`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }

      await trackError("voice", error, { bufferSize: audioBuffer.length, attempt, isRateLimit });
      console.error("Groq transcription error:", error);
      return null;
    }
  }

  return null;
}
