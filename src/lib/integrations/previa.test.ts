import { mentionsMatch } from "@/lib/engines/context";
import { teamSpoken } from "@/lib/engines/team-names";
import { kickoffDraft, previaDraft } from "@/lib/integrations/previa";
import { describe, expect, it } from "vitest";

describe("previa y contexto", () => {
  it("la previa dice el horario y no inventa marcador", () => {
    const draft = previaDraft({
      home: "Leon",
      away: "FC Juarez",
      kickoff: new Date("2026-09-28T01:00:00.000Z"),
    });
    expect(draft.text).toContain("7:00");
    expect(draft.text).toMatch(/Fiera|León/);
    expect(draft.text).toMatch(/Bravos|Juárez/);
    expect(draft.text).not.toMatch(/\bLeon\b|Juarez/);
    expect(draft.text).not.toMatch(/\d+\s*[-–]\s*\d+/);
  });

  it("el pitazo avisa que ya empezó y no inventa marcador", () => {
    const draft = kickoffDraft({ home: "Leon", away: "FC Juarez" });
    const home = teamSpoken("Leon", "Leon:FC Juarez:home");
    const away = teamSpoken("FC Juarez", "Leon:FC Juarez:away");
    expect(draft.locked).toEqual([`Ya empezó ${home} contra ${away}.`]);
    expect(draft.text).not.toMatch(/Juarez|Leon/);
    expect(draft.text).not.toMatch(/\d+\s*[-–]\s*\d+/);
  });

  it("el segundo post usa contexto del partido y deja fuera lo que no es", () => {
    expect(mentionsMatch("León ya está en la cancha.", ["Leon", "FC Juarez"])).toBe(true);
    expect(mentionsMatch("Sorteo de un balón Voit.", ["Leon", "FC Juarez"])).toBe(false);
  });
});
