import { describe, expect, it, vi } from "vitest";
import { acceptVoiceLine, composeDraft } from "@/lib/engines/copy";
import { applyVoice } from "@/lib/integrations/openai-voice";

const draft = composeDraft({
  eventType: "GOAL",
  lockedLines: ["GOL DE QUERÉTARO.", "Minuto 12.", "Querétaro 1-0 Guadalajara."],
  tone: "normal",
  america: false,
});

describe("voz", () => {
  it("acepta una línea sin marcador", () => {
    const next = acceptVoiceLine(draft, "Apenas estaba calentando servidores. 🤖");
    expect(next.voice).toBe("openai");
    expect(next.locked.join("\n")).toBe(draft.locked.join("\n"));
    expect(next.text.startsWith(draft.locked.join("\n"))).toBe(true);
    expect(next.personality).not.toMatch(/\d+\s*-\s*\d+/);
  });

  it("se queda con la plantilla si el modelo mete el marcador", () => {
    const next = acceptVoiceLine(draft, "Qué golazo, ya van 1-0.");
    expect(next.voice).toBe("plantilla");
    expect(next.personality).toBe(draft.personality);
  });

  it("no llama a OpenAI si no hay línea de personalidad", async () => {
    const fetchImpl = vi.fn();
    const quiet = { ...draft, personality: null, text: draft.locked.join("\n") };
    const next = await applyVoice(quiet, { OPENAI_API_KEY: "presente" }, fetchImpl);
    expect(next.voice).toBe("plantilla");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
