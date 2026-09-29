import { acceptSpokenLine, SPEECH_TTL_MS, speechFingerprint, type SpeechNote } from "@/lib/engines/speech";

export const IMAGE_READ_LIMIT = 4;

function clip(text: string): string {
  if (text.length <= 160) return text;
  const cut = text.slice(0, 160);
  const space = cut.lastIndexOf(" ");
  return (space >= 20 ? cut.slice(0, space) : cut).trim();
}

export function acceptImageText(raw: string, now: Date): SpeechNote | null {
  const joined = raw.replace(/\s+/g, " ").trim();
  const body = acceptSpokenLine(joined) ?? acceptSpokenLine(clip(joined));
  if (!body) return null;
  return {
    kind: "frase",
    body,
    fingerprint: speechFingerprint("frase", body),
    expiresAt: new Date(now.getTime() + SPEECH_TTL_MS.frase).toISOString(),
  };
}
