import { describe, expect, it } from "vitest";
import { assessSchedule, inconsistentFindings, shouldFetchEvents } from "@/lib/cron/assess";
import { authorizeCron } from "@/lib/http/cron";

const now = new Date("2026-09-27T19:00:00.000Z");

describe("agenda del cron", () => {
  it("pasa a prepartido un encuentro dentro de la ventana, sin pedir la API", () => {
    const assessment = assessSchedule(
      [{ fixtureId: "1", status: "SCHEDULED", kickoffAt: "2026-09-27T19:30:00.000Z" }],
      now,
    );
    expect(assessment.preMatch).toEqual(["1"]);
    expect(assessment.refresh).toBe(false);
  });

  it("pide un refresco si el partido ya debió empezar y no está cerrado", () => {
    const assessment = assessSchedule(
      [
        { fixtureId: "1", status: "SCHEDULED", kickoffAt: "2026-09-27T17:00:00.000Z" },
        { fixtureId: "2", status: "FT", kickoffAt: "2026-09-26T23:00:00.000Z" },
      ],
      now,
    );
    expect(assessment.refresh).toBe(true);
    expect(assessment.preMatch).toEqual([]);
  });

  it("no consulta la API si todo lo empezado ya tiene final", () => {
    const assessment = assessSchedule(
      [{ fixtureId: "2", status: "FT", kickoffAt: "2026-09-26T23:00:00.000Z" }],
      now,
    );
    expect(assessment.refresh).toBe(false);
  });

  it("no vuelve a pedir eventos de un final viejo que ya tiene registro", () => {
    expect(shouldFetchEvents({
      status: "FT",
      kickoffAt: "2026-09-25T01:00:00.000Z",
      eventCount: 4,
      now,
    })).toBe(false);
  });

  it("sí pide eventos de un partido en vivo", () => {
    expect(shouldFetchEvents({
      status: "LIVE",
      kickoffAt: "2026-09-27T18:00:00.000Z",
      eventCount: 1,
      now,
    })).toBe(true);
  });

  it("marca inconsistente un programado que ya debió empezar", () => {
    const findings = inconsistentFindings(
      [{ fixtureId: "9", status: "SCHEDULED", kickoffAt: "2026-09-27T17:00:00.000Z" }],
      now,
    );
    expect(findings.map((item) => item.code)).toEqual(["state_inconsistent"]);
  });
});

describe("acceso al cron", () => {
  const env = { CRON_SECRET: "secreto-de-prueba", DATABASE_URL: "postgres://local", API_FOOTBALL_KEY: "llave" };

  it("rechaza una llamada sin el secreto", async () => {
    const response = authorizeCron(new Request("https://local/api/cron/sync-matches"), ["database", "apiFootball"], env);
    expect(response?.status).toBe(401);
  });

  it("deja pasar la llamada con el bearer correcto", () => {
    const request = new Request("https://local/api/cron/sync-matches", { headers: { authorization: "Bearer secreto-de-prueba" } });
    expect(authorizeCron(request, ["database", "apiFootball"], env)).toBeNull();
  });
});
