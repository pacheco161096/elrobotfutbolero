import { acceptSpeechBundle, speechAction, speechPromptBlock, SPEECH_DUE_MS, SPEECH_TTL_MS } from "@/lib/engines/speech";
import { describe, expect, it } from "vitest";

const now = new Date("2026-09-28T18:00:00.000Z");
const source = "Neta que el árbitro ya se pasó de lanza y nadie dice nada en la tribuna.";

describe("habla", () => {
  it("guarda el giro y deja fuera la cita de la fanpage", () => {
    const notes = acceptSpeechBundle(
      JSON.stringify({
        frases: ["Cierran la queja con un neta, como si ya no hubiera más que decir."],
        tendencias: ["El reclamo al árbitro se está contando como telenovela de capítulo diario."],
        visual: ["La imagen del momento es una captura con la frase enorme al centro."],
      }),
      [source],
      now,
    );
    expect(notes.map((note) => note.kind)).toEqual(["frase", "tendencia", "visual"]);
    expect(notes[0].expiresAt).toBe(new Date(now.getTime() + SPEECH_TTL_MS.frase).toISOString());
    expect(notes[1].expiresAt).toBe(new Date(now.getTime() + SPEECH_TTL_MS.tendencia).toISOString());
  });

  it("no guarda una línea copiada ni un marcador", () => {
    const notes = acceptSpeechBundle(
      JSON.stringify({
        frases: [source, "Ya van 2-0 y la tribuna no perdona."],
        tendencias: [],
        visual: [],
      }),
      [source],
      now,
    );
    expect(notes).toEqual([]);
  });

  it("la voz recibe el habla y la tendencia queda marcada como opcional", () => {
    const block = speechPromptBlock([
      { kind: "frase", body: "Cierran la queja con un neta." },
      { kind: "tendencia", body: "El reclamo se cuenta como capítulo diario." },
      { kind: "visual", body: "Captura con la frase enorme." },
    ]);
    expect(block).toContain("Cómo se habla:");
    expect(block).toContain("solo si cae sola");
    expect(block).not.toContain("Captura");
    expect(speechPromptBlock([
      { kind: "frase", body: "6 El Generalísimo OMichoacaneando Ya puro running, ya nadie choca bien amanecido" },
    ])).toBe("");
  });

  it("un almacén vacío no inventa habla", () => {
    expect(speechPromptBlock([])).toBe("");
    expect(acceptSpeechBundle("no es json", [], now)).toEqual([]);
  });

  it("arranca cuatro veces al día y no repite si acaba de guardar", () => {
    expect(speechAction({
      mode: "start",
      status: null,
      startedAt: null,
      finishedAt: null,
      now,
    })).toBe("trigger");
    expect(speechAction({
      mode: "start",
      status: "done",
      startedAt: null,
      finishedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      now,
    })).toBe("idle");
    expect(speechAction({
      mode: "start",
      status: "done",
      startedAt: null,
      finishedAt: new Date(now.getTime() - SPEECH_DUE_MS).toISOString(),
      now,
    })).toBe("trigger");
  });

  it("el worker solo retoma una búsqueda abierta", () => {
    expect(speechAction({
      mode: "resume",
      status: "done",
      startedAt: null,
      finishedAt: new Date(now.getTime() - SPEECH_DUE_MS).toISOString(),
      now,
    })).toBe("idle");
    expect(speechAction({
      mode: "resume",
      status: "running",
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      finishedAt: null,
      now,
    })).toBe("poll");
  });

  it("una búsqueda colgada se suelta para la siguiente pasada", () => {
    expect(speechAction({
      mode: "start",
      status: "running",
      startedAt: new Date(now.getTime() - 50 * 60 * 1000).toISOString(),
      finishedAt: null,
      now,
    })).toBe("expire");
    expect(speechAction({
      mode: "start",
      status: "failed",
      startedAt: null,
      finishedAt: now.toISOString(),
      now,
    })).toBe("trigger");
  });
});
