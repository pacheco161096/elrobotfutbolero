export function imageForPost(kind: string, imageUrl: string | null | undefined, pauseImages: boolean): string | null {
  if (pauseImages || kind === "FLASH" || kind === "PREVIA" || kind === "KICKOFF" || kind === "HALFTIME") return null;
  if (!imageUrl?.startsWith("https://")) return null;
  return imageUrl;
}

export function presentCard(lines: string[]): string {
  return lines.map((line) => line.trim()).filter(Boolean).join("\n");
}
