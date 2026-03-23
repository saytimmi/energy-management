import { config } from "../config.js";
import { trackError } from "./monitor.js";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: "disabled" | "too_large" | "empty" | "api_error" | "timeout" | "rate_limit" };

export async function transcribeVoice(audioBuffer: Buffer): Promise<TranscribeResult> {
  if (!config.groqApiKey) {
    console.warn("Voice transcription disabled (no GROQ_API_KEY)");
    return { ok: false, reason: "disabled" };
  }

  if (audioBuffer.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (audioBuffer.length > MAX_FILE_SIZE) {
    return { ok: false, reason: "too_large" };
  }

  try {
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer as unknown as BlobPart], { type: "audio/ogg" }), "voice.ogg");
    formData.append("model", "whisper-large-v3");
    formData.append("language", "ru");

    const response = await Promise.race([
      fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.groqApiKey}` },
        body: formData,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Transcription timeout")), TIMEOUT_MS)
      ),
    ]);

    if (response.status === 429) {
      await trackError("voice", new Error("Groq rate limit"), { status: 429 });
      return { ok: false, reason: "rate_limit" };
    }

    if (!response.ok) {
      const err = await response.text();
      await trackError("voice", new Error(`Groq API ${response.status}: ${err}`), { status: response.status });
      return { ok: false, reason: "api_error" };
    }

    const data = await response.json() as { text?: string };
    const text = data.text?.trim();
    if (!text) return { ok: false, reason: "empty" };

    return { ok: true, text };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes("timeout");
    await trackError("voice", err, { audioSize: audioBuffer.length });
    console.error("Voice transcription failed:", err);
    return { ok: false, reason: isTimeout ? "timeout" : "api_error" };
  }
}

export async function downloadTelegramFile(url: string): Promise<Buffer> {
  const response = await Promise.race([
    fetch(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Download timeout")), DOWNLOAD_TIMEOUT_MS)
    ),
  ]);
  return Buffer.from(await response.arrayBuffer());
}
