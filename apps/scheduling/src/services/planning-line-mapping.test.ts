import { describe, expect, it } from "vitest";
import type { Department } from "../engine/types";
import {
  departmentNameForLine,
  isProductionTask,
  mapPlanningLine,
  mapPlanningLines,
  resolveDepartmentId,
} from "./planning-line-mapping";

describe("mapPlanningLine", () => {
  it("maps metal fab keywords", () => {
    expect(mapPlanningLine("Cut and form 16ga panels")).toBe("dept-metal");
    expect(mapPlanningLine("Weld raceway")).toBe("dept-metal");
    expect(mapPlanningLine("Channel letter blanks")).toBe("dept-metal");
  });

  it("maps paint keywords", () => {
    expect(mapPlanningLine("Prime and topcoat")).toBe("dept-paint");
    expect(mapPlanningLine("Powder coat letters")).toBe("dept-paint");
  });

  it("maps assembly keywords", () => {
    expect(mapPlanningLine("LED assembly and wiring")).toBe("dept-assembly");
    expect(mapPlanningLine("Mount and final assembly")).toBe("dept-assembly");
  });

  it("maps vinyl keywords", () => {
    expect(mapPlanningLine("Apply vinyl graphics")).toBe("dept-vinyl");
    expect(mapPlanningLine("Braille decals")).toBe("dept-vinyl");
  });

  it("returns null when nothing matches", () => {
    expect(mapPlanningLine("Pay licensing fee")).toBeNull();
  });
});

describe("mapPlanningLines", () => {
  it("annotates each line with its department", () => {
    const result = mapPlanningLines([
      { lineNo: 10, description: "Cut metal", estimatedHours: 4 },
      { lineNo: 20, description: "Paint coat", estimatedHours: 2 },
      { lineNo: 30, description: "Something irrelevant", estimatedHours: 1 },
    ]);
    expect(result[0]!.departmentId).toBe("dept-metal");
    expect(result[1]!.departmentId).toBe("dept-paint");
    expect(result[2]!.departmentId).toBeNull();
  });
});

describe("isProductionTask", () => {
  it("treats 3000-band job tasks as production", () => {
    expect(isProductionTask("3020")).toBe(true);
    expect(isProductionTask("3999")).toBe(true);
  });
  it("treats 4000-band (install) and everything else as non-production", () => {
    expect(isProductionTask("4010")).toBe(false);
    expect(isProductionTask("2000")).toBe(false);
    expect(isProductionTask("")).toBe(false);
    expect(isProductionTask(undefined)).toBe(false);
  });
});

describe("departmentNameForLine", () => {
  it("prefers the exact resource-code map over the description keyword", () => {
    // 2011 = Cabinet Metal Labor → Metal Fab, even if the description is vague.
    expect(departmentNameForLine("2011", "misc labor")).toBe("Metal Fab");
    expect(departmentNameForLine("2416", "misc")).toBe("Vinyl / Graphics");
  });
  it("falls back to the description keyword when there is no resource code", () => {
    expect(departmentNameForLine("", "Prime and topcoat")).toBe("Paint");
    expect(departmentNameForLine(undefined, "nothing relevant")).toBeNull();
  });
});

describe("resolveDepartmentId", () => {
  const mk = (id: string, name: string): Department => ({ id, name, flowOrder: 0, color: "#000" });
  const live = new Map([
    ["guid-1", mk("guid-1", "Metal Fab")],
    ["guid-2", mk("guid-2", "Vinyl / Graphics")],
  ]);
  it("resolves a canonical name to the live (GUID-keyed) department id", () => {
    expect(resolveDepartmentId("Metal Fab", live)).toBe("guid-1");
  });
  it("tolerates minor naming differences via contains match", () => {
    const alt = new Map([["g", mk("g", "Vinyl")]]);
    expect(resolveDepartmentId("Vinyl / Graphics", alt)).toBe("g");
  });
  it("returns null for an unknown or empty name", () => {
    expect(resolveDepartmentId("Nonexistent", live)).toBeNull();
    expect(resolveDepartmentId(null, live)).toBeNull();
  });
});
