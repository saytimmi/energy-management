import { trackError } from "./monitor.js";

/**
 * Voice transcription — temporarily disabled
 */
export async function transcribeVoice(audioBuffer: Buffer): Promise<string | null> {
  console.log("Voice transcription disabled (no provider configured)");
  return null;
}
