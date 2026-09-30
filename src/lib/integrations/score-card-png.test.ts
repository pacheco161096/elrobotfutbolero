import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderScoreCard } from "@/lib/integrations/score-card-png";

describe("imagen del marcador", () => {
  it("sale en 1080 por 1350", async () => {
    const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#225533" } }).jpeg().toBuffer();
    const flag = await sharp({ create: { width: 80, height: 48, channels: 3, background: "#cc0000" } }).png().toBuffer();
    const png = await renderScoreCard({
      photo,
      homeMark: flag,
      awayMark: flag,
      homeMarkKind: "bandera",
      awayMarkKind: "bandera",
      homeCode: "ESP",
      awayCode: "CRO",
      homeScore: 4,
      awayScore: 1,
      homeGoals: [
        { minute: 3, name: "LAMINE YAMAL" },
        { minute: 31, name: "PUBILL" },
        { minute: 63, name: "LAMINE YAMAL" },
        { minute: 89, name: "NICO WILLIAMS" },
      ],
      awayGoals: [{ minute: 29, name: "BELJO" }],
    });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
    expect(meta.format).toBe("png");
  });
});
