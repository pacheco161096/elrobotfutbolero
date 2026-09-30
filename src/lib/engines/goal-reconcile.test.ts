import { reconcileGoals } from "@/lib/engines/goal-reconcile";
import { describe, expect, it } from "vitest";

const velez = {
  playerId: 36308,
  minute: 26,
  extra: null,
  player: "Jairo Vélez",
  team: "Peru",
  detail: "Normal Goal",
};

describe("conciliación de goles", () => {
  it("un solo gol en la lista corrige el minuto y el nombre", () => {
    const plan = reconcileGoals(
      [{ id: "viejo", ...velez, minute: 27, player: "J. Velez" }],
      [velez],
    );
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([{ id: "viejo", goal: velez }]);
  });

  it("dos goles del mismo jugador en la misma lista se quedan los dos", () => {
    const second = { ...velez, minute: 27, player: "J. Velez" };
    const plan = reconcileGoals(
      [{ id: "primero", ...velez }],
      [velez, second],
    );
    expect(plan.update.map((item) => item.id)).toEqual(["primero"]);
    expect(plan.insert).toEqual([second]);
  });

  it("si la lista omite un gol lejano, ese registro se queda", () => {
    const early = { ...velez, minute: 10, player: "J. Velez" };
    const late = { ...velez, minute: 80 };
    const plan = reconcileGoals(
      [
        { id: "temprano", ...early },
        { id: "tarde", ...late },
      ],
      [late],
    );
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([{ id: "tarde", goal: late }]);
  });
});
