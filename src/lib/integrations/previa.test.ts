import { mentionsMatch } from "@/lib/engines/context";
import { previaDraft } from "@/lib/integrations/previa";
import { describe, expect, it } from "vitest";

describe("previa y contexto", () => {
  it("la previa dice el horario y no inventa marcador", () => {
    const draft = previaDraft({
      home: "Leon",
      away: "FC Juarez",
      kickoff: new Date("2026-09-28T01:00:00.000Z"),
    });
    expect(draft.text).toContain("Leon");
    expect(draft.text).toContain("FC Juarez");
    expect(draft.text).toContain("7:00");
    expect(draft.text).not.toMatch(/\d+\s*[-–]\s*\d+/);
  });

  it("el segundo post usa contexto del partido y deja fuera lo que no es", () => {
    expect(mentionsMatch("León ya está en la cancha.", ["Leon", "FC Juarez"])).toBe(true);
    expect(mentionsMatch("Sorteo de un balón Voit.", ["Leon", "FC Juarez"])).toBe(false);
  });
});
