import { describe, expect, it } from "vitest";
import { allowsCronPost, cronHalf, isGoleada, sharedTopic } from "@/lib/engines/cron-budget";

describe("tope del cron por partido", () => {
  it("deja una publicación por tiempo", () => {
    expect(allowsCronPost({
      half: "primero",
      usedFirst: false,
      usedSecond: false,
      homeScore: 1,
      awayScore: 0,
      consensus: false,
    })).toBe(true);
    expect(allowsCronPost({
      half: "primero",
      usedFirst: true,
      usedSecond: false,
      homeScore: 1,
      awayScore: 0,
      consensus: false,
    })).toBe(false);
    expect(allowsCronPost({
      half: "segundo",
      usedFirst: true,
      usedSecond: false,
      homeScore: 1,
      awayScore: 1,
      consensus: false,
    })).toBe(true);
  });

  it("la goleada y el tema repetido en más de tres páginas se brincan el tope", () => {
    expect(isGoleada(4, 1)).toBe(true);
    expect(isGoleada(2, 0)).toBe(false);
    expect(allowsCronPost({
      half: "primero",
      usedFirst: true,
      usedSecond: true,
      homeScore: 4,
      awayScore: 1,
      consensus: false,
    })).toBe(true);
    expect(allowsCronPost({
      half: "segundo",
      usedFirst: true,
      usedSecond: true,
      homeScore: 1,
      awayScore: 0,
      consensus: true,
    })).toBe(true);
  });

  it("el medio tiempo es el primero y el final es el segundo", () => {
    expect(cronHalf({ kind: "HALFTIME", key: "halftime:9", minute: null, status: "HALFTIME" })).toBe("primero");
    expect(cronHalf({ kind: "FULL_TIME", key: "fulltime:9", minute: 90, status: "FT" })).toBe("segundo");
    expect(cronHalf({ kind: "FLASH", key: "api:1", minute: 12, status: "LIVE" })).toBe("primero");
    expect(cronHalf({ kind: "PULSE", key: "pulse:9:2", minute: 70, status: "LIVE" })).toBe("segundo");
  });
});

describe("tema compartido", () => {
  const pages = (word: string, count: number) => Array.from({ length: count }, (_, index) => ({
    author: `Pagina ${index + 1}`,
    text: `España dejó un ${word} clarísimo ante Croacia`,
  }));

  it("publica cuando más de tres fanpages dicen lo mismo", () => {
    expect(sharedTopic(pages("arbitro", 4))).toBe(true);
    expect(sharedTopic(pages("arbitro", 3))).toBe(false);
  });

  it("el nombre del equipo cuenta como tema", () => {
    expect(sharedTopic([
      { author: "A", text: "España España España" },
      { author: "B", text: "España jugó" },
      { author: "C", text: "Vamos España" },
      { author: "D", text: "España otra vez" },
    ])).toBe(true);
  });
});
