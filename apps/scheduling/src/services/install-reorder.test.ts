import { describe, expect, it } from "vitest";
import type { Employee } from "../engine/types";
import { computeRosterReorder } from "./install-reorder";

// Minimal install-roster fixture: two location groups (0 and 1), 4 crews.
//   display order (location asc, position asc): A(0,1) B(0,2) C(1,3) D(1,4)
function crew(id: string, location: number, position: number): Employee {
  return {
    id,
    name: id,
    departmentId: String(location),
    productivityRate: 1,
    standardHoursPerDay: 8,
    maxOvertimePerDay: 0,
    worksWeekends: false,
    position,
  };
}

const CREWS = [crew("A", 0, 1), crew("B", 0, 2), crew("C", 1, 3), crew("D", 1, 4)];

const byId = (moves: ReturnType<typeof computeRosterReorder>) =>
  new Map(moves.map((m) => [m.id, m]));

describe("computeRosterReorder", () => {
  it("moves a crew into another location group and top of order (drop before A)", () => {
    const moves = byId(computeRosterReorder(CREWS, "D", { beforeId: "A" }));
    // New order: D A B C → D adopts A's location (0) and position 01.
    expect(moves.get("D")).toEqual({ id: "D", location: 0, position: "01" });
    expect(moves.get("A")).toEqual({ id: "A", location: 0, position: "02" });
    expect(moves.get("B")).toEqual({ id: "B", location: 0, position: "03" });
    expect(moves.get("C")).toEqual({ id: "C", location: 1, position: "04" });
  });

  it("appends a crew to a different location group (header drop)", () => {
    const moves = byId(computeRosterReorder(CREWS, "A", { groupLocation: 1 }));
    // New order: B C D A → A moves to location 1, last.
    expect(moves.get("A")).toEqual({ id: "A", location: 1, position: "04" });
    expect(moves.get("B")).toEqual({ id: "B", location: 0, position: "01" });
  });

  it("reorders within a group (drop B before A)", () => {
    const moves = byId(computeRosterReorder(CREWS, "B", { beforeId: "A" }));
    // New order: B A C D → only A and B swap positions; locations unchanged.
    expect(moves.get("B")).toEqual({ id: "B", location: 0, position: "01" });
    expect(moves.get("A")).toEqual({ id: "A", location: 0, position: "02" });
    expect(moves.has("C")).toBe(false);
    expect(moves.has("D")).toBe(false);
  });

  it("is a no-op when dropped on itself", () => {
    expect(computeRosterReorder(CREWS, "A", { beforeId: "A" })).toEqual([]);
  });

  it("returns nothing for an unknown crew", () => {
    expect(computeRosterReorder(CREWS, "ZZ", { beforeId: "A" })).toEqual([]);
  });
});
