import { describe, expect, it } from "vitest";
import { mapPlanningLine, mapPlanningLines } from "./planning-line-mapping";

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
