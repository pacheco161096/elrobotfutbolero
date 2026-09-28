import { estimateUsd, imageUsd } from "@/lib/integrations/ai-cost";
import { readZernioSignal } from "@/lib/integrations/learn";
import { imageForPost } from "@/lib/engines/visual";
import { describe, expect, it } from "vitest";

describe("costo y pieza visual", () => {
  it("estima gpt-4o-mini y deja sin tarifa un modelo desconocido", () => {
    expect(estimateUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75);
    expect(estimateUsd("modelo-raro", 10, 10)).toBeNull();
    expect(imageUsd("dall-e-3")).toBe(0.04);
  });

  it("el flash no lleva imagen y el segundo post sí, si hay una", () => {
    expect(imageForPost("FLASH", "https://cdn.example/gol.jpg", false)).toBeNull();
    expect(imageForPost("PREVIA", "https://cdn.example/gol.jpg", false)).toBeNull();
    expect(imageForPost("CONTEXT", "https://cdn.example/gol.jpg", false)).toBe("https://cdn.example/gol.jpg");
    expect(imageForPost("CONTEXT", "https://cdn.example/gol.jpg", true)).toBeNull();
  });

  it("aprende reacciones solo si el webhook trae el id del post y un número", () => {
    expect(readZernioSignal({ post: { _id: "abc" }, likes: 4, comments: 1 })).toEqual({
      externalId: "abc",
      engagement: { likes: 4, comments: 1 },
    });
    expect(readZernioSignal({ account: { _id: "no-es-el-post" } })).toEqual({ externalId: null, engagement: {} });
  });
});
