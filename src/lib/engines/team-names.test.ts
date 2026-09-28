import { teamOfficial, teamSpoken } from "@/lib/engines/team-names";
import { describe, expect, it } from "vitest";

describe("nombres de equipos", () => {
  it("afuera de México el nombre oficial va en español, sin apodo", () => {
    for (let n = 0; n < 20; n += 1) {
      expect(teamSpoken("Belgium", `hoy:${n}`)).toBe("Bélgica");
      expect(teamSpoken("France", `hoy:${n}`)).toBe("Francia");
      expect(teamSpoken("Türkiye", `hoy:${n}`)).toBe("Turquía");
    }
  });

  it("en México el apodo va primero y los dos juntos solo si el apodo no está en el nombre", () => {
    const forms = new Set<string>();
    let withNickname = 0;
    for (let n = 0; n < 100; n += 1) {
      const form = teamSpoken("Guadalajara", `jornada:${n}`);
      forms.add(form);
      if (form !== "Guadalajara") withNickname += 1;
    }
    expect(forms.has("las Chivas")).toBe(true);
    expect(forms.has("las Chivas de Guadalajara")).toBe(true);
    expect(forms.has("Guadalajara")).toBe(true);
    expect(withNickname).toBeGreaterThan(60);
    expect(withNickname).toBeLessThan(80);

    for (let n = 0; n < 30; n += 1) {
      const name = teamSpoken("Atletico San Luis", `asl:${n}`);
      expect(name).toBe("Atlético de San Luis");
      expect(name.toLowerCase()).not.toContain("el atlético");
    }
    for (let n = 0; n < 40; n += 1) {
      const name = teamSpoken("Santos Laguna", `santos:${n}`);
      expect(name === "Santos" || name === "Santos Laguna").toBe(true);
      expect(name).not.toContain("de Santos");
    }
  });

  it("el nombre oficial en español no depende del sorteo", () => {
    expect(teamOfficial("FC Juarez")).toBe("Juárez");
    expect(teamOfficial("U.N.A.M. - Pumas")).toBe("Pumas");
  });
});
