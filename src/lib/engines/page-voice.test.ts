import { acceptPageLine, copiesPage, namesPage } from "@/lib/engines/page-voice";
import { describe, expect, it } from "vitest";

const source = "FAN10: ¡GOOOOOOOOOOOOOOL DEL AMÉRICA! Doblete de Don HENRY MARTÍN. 45' Necaxa 2-2 América";

describe("voz de una página ajena", () => {
  it("rechaza la firma y el titular copiado", () => {
    expect(namesPage("FAN10: qué golazo.", "FAN10")).toBe(true);
    expect(namesPage("Futbol Total: América prestó jugadores.", "Futbol Total")).toBe(true);
    expect(copiesPage("Doblete de Don HENRY MARTÍN en el 45", source)).toBe(true);
    expect(acceptPageLine(source, "FAN10", "FAN10: ¡GOOOOOOOOOOOOOOL DEL AMÉRICA!")).toBeNull();
    expect(acceptPageLine(source, "FAN10", "Necaxa 2-2 América y yo aquí.")).toBeNull();
  });

  it("acepta una línea propia, sin página y sin marcador", () => {
    expect(namesPage("Otra vez el América. Qué raro. 🤖", "FAN10")).toBe(false);
    expect(acceptPageLine(source, "FAN10", "Otra vez el América. Qué raro. 🤖")).toBe("Otra vez el América. Qué raro. 🤖");
    expect(acceptPageLine(source, "FAN10", "NADA")).toBeNull();
  });
});
