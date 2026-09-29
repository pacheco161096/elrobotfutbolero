import { acceptImageText } from "@/lib/engines/image-text";
import { describe, expect, it } from "vitest";

const now = new Date("2026-09-29T16:00:00.000Z");

describe("texto de imagen", () => {
  it("junta el meme y censura la grosería sin tocar lo demás", () => {
    const note = acceptImageText("Neta que este\npendejo ya se pasó", now);
    expect(note?.kind).toBe("frase");
    expect(note?.body).toBe("Neta que este p*ndejo ya se pasó");
  });

  it("descarta un ruido que no es una frase", () => {
    expect(acceptImageText("||| ### 1234 ??", now)).toBeNull();
    expect(acceptImageText("hola", now)).toBeNull();
    expect(acceptImageText("Nuevo idesecomodarmolpara) [comoda otros g", now)).toBeNull();
    expect(acceptImageText("6 El Generalísimo OMichoacaneando Ya puro running, ya nadie choca bien amanecido", now)).toBeNull();
  });
});
