import { imageRoute, matchImageQuery } from "@/lib/engines/image-route";
import { pickWebImage } from "@/lib/integrations/web-image";
import { describe, expect, it } from "vitest";

describe("foto del partido o imagen creada", () => {
  it("un gol se busca; el meme del empate y el recuento se crean", () => {
    expect(imageRoute({
      eventType: "GOAL",
      source: "GOOOOOOL DEL AMERICA. Doblete de Henry Martín.",
      line: "Otra vez el América. Qué raro. 🤖",
    })).toBe("buscar");
    expect(imageRoute({
      eventType: "GOAL",
      source: "Cinco minutos le duró el empate al América. Necaxa ya gana otra vez.",
      line: "Y pensar que el América se creía el rey del empate. 🤖",
    })).toBe("crear");
    expect(imageRoute({
      eventType: "GOAL",
      source: "LOS MANDARON AL RAYO. En esa época América y Necaxa mandaban jugadores.",
      line: "Se prestaban jugadores y ahora se ven la cara. 🤖",
    })).toBe("crear");
    expect(matchImageQuery({ home: "Necaxa", away: "Club America", eventType: "RED_CARD" })).toBe(
      "Necaxa vs Club America expulsión Liga MX",
    );
  });

  it("elige una foto pública del partido y descarta la de la fanpage", () => {
    const picked = pickWebImage({
      results: [
        { image: "https://scontent.xx.fbcdn.net/gol.jpg", title: "América gol", width: 800 },
        { image: "https://www.tudn.com/henry.jpg", title: "Henry Martín gol América Necaxa", url: "https://www.tudn.com/nota", width: 900 },
      ],
    }, ["Necaxa", "Club America"], "https://scontent.xx.fbcdn.net/gol.jpg");
    expect(picked).toBe("https://www.tudn.com/henry.jpg");
  });
});
