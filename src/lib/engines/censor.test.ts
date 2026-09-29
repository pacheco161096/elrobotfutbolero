import { censorSwears } from "@/lib/engines/censor";
import { describe, expect, it } from "vitest";

describe("censura", () => {
  it("deja la ortografía y solo tapa la grosería", () => {
    expect(censorSwears("Qué pendejo el arbitraje, neta.")).toBe("Qué p*ndejo el arbitraje, neta.");
    expect(censorSwears("Valieron madre en el segundo tiempo.")).toBe("V*lieron m*dre en el segundo tiempo.");
    expect(censorSwears("Se escribe bien, con acento y con coma.")).toBe("Se escribe bien, con acento y con coma.");
  });

  it("no vuelve a censurar una palabra que ya trae asterisco", () => {
    expect(censorSwears("Otra vez la m*erda de siempre.")).toBe("Otra vez la m*erda de siempre.");
    expect(censorSwears("Pendejo")).toBe("P*ndejo");
  });
});
