import { describe, expect, it } from "vitest";
import { pollPlan } from "@/lib/worker/poll";

const now = new Date("2026-09-27T20:00:00.000Z");

describe("sondeo en vivo", () => {
  it("no llama a la API si no hay partido activo", () => {
    expect(pollPlan([{ status: "SCHEDULED", lastPolledAt: null }, { status: "FT", lastPolledAt: null }], now)).toEqual({
      callApi: false,
      nextMs: 60_000,
    });
  });

  it("pide la API si un partido en vivo no se ha sondeado", () => {
    const plan = pollPlan([{ status: "LIVE", lastPolledAt: null }], now);
    expect(plan.callApi).toBe(true);
    expect(plan.nextMs).toBe(15_000);
  });

  it("espera el intervalo si el sondeo fue hace un momento", () => {
    const plan = pollPlan([{ status: "LIVE", lastPolledAt: "2026-09-27T19:59:50.000Z" }], now);
    expect(plan.callApi).toBe(false);
    expect(plan.nextMs).toBe(15_000);
  });

  it("baja la frecuencia si el partido está suspendido", () => {
    const plan = pollPlan([{ status: "SUSPENDED", lastPolledAt: null }], now);
    expect(plan.nextMs).toBe(90_000);
  });
});
