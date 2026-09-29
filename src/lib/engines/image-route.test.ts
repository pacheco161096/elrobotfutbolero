import { analysisScene, imageRoute, matchImageQuery } from "@/lib/engines/image-route";
import { pickWebImage } from "@/lib/integrations/web-image";
import { describe, expect, it } from "vitest";

describe("foto del partido o imagen creada", () => {
  it("si se habla del partido, la imagen se busca", () => {
    expect(imageRoute({
      eventType: "GOAL",
      source: "GOOOOOOL DEL AMERICA. Doblete de Henry Martín.",
      line: "Otra vez el América. Qué raro. 🤖",
    })).toBe("buscar");
    expect(imageRoute({
      eventType: "GOAL",
      source: "Cinco minutos le duró el empate al América. Necaxa ya gana otra vez.",
      line: "Y pensar que el América se creía el rey del empate. 🤖",
    })).toBe("buscar");
    expect(imageRoute({
      eventType: "GOAL",
      source: "LOS MANDARON AL RAYO. En esa época América y Necaxa mandaban jugadores.",
      line: "Se prestaban jugadores y ahora se ven la cara. 🤖",
    })).toBe("buscar");
    expect(matchImageQuery({ home: "Necaxa", away: "Club America", eventType: "RED_CARD" })).toBe(
      "Necaxa vs Club America expulsión",
    );
  });

  it("elige una foto pública del partido y descarta fanpage, marca de agua y otro marcador", () => {
    const picked = pickWebImage({
      results: [
        { image: "https://scontent.xx.fbcdn.net/gol.jpg", title: "América gol", width: 800 },
        { image: "https://www.tudn.com/henry.jpg", title: "Henry Martín gol América Necaxa TUDN", url: "https://www.tudn.com/nota", width: 900 },
        { image: "https://cdn.example/amistoso.jpg", title: "Italia Turquía 0-0 amistoso", width: 900 },
        { image: "https://icdn.football-italia.net/henry.jpg", title: "Henry Martín gol América Necaxa", width: 900 },
      ],
    }, ["Necaxa", "Club America"], "https://scontent.xx.fbcdn.net/gol.jpg", { home: 1, away: 0 });
    expect(picked).toBe("https://icdn.football-italia.net/henry.jpg");
  });

  it("un partido cerrado se dibuja aburrido y uno abierto, despierto", () => {
    expect(analysisScene({ goalCount: 0, line: "Bélgica 0-0 Francia. Partido cerrado." })).toMatch(/asleep/);
    expect(analysisScene({ goalCount: 3, line: "Turquía 0-3 Italia. Esto se abrió." })).toMatch(/amused/);
  });
});
