import { describe, expect, it } from "vitest";
import type { ScheduleLine } from "../engine/types";
import { crossSiteBadges } from "./cross-site";

const line = (id: string, jobNo: string, employeeId: string, day: string, extra: Partial<ScheduleLine> = {}): ScheduleLine =>
  ({
    id, jobNo, customerName: "", startDateTime: new Date(`${day}T08:00:00`), endDateTime: new Date(`${day}T12:00:00`),
    estimatedHours: 4, overrideHours: null, employeeId, departmentId: employeeId === "aaron" ? "vinyl" : "paint",
    customerDueDate: null, isLocked: false, jobSequence: 0, ...extra,
  }) as ScheduleLine;

const base = {
  regionOf: (id: string) => (id === "aaron" ? ("NEK" as const) : ("WK" as const)),
  deptName: (d: string) => (d === "paint" ? "Paint" : "Vinyl"),
  mfgRegionOf: (j: string) => (j === "J3" ? "WK" : ""),
};

describe("crossSiteBadges", () => {
  it("flags an NEK card whose job has Hutchinson production cards", () => {
    const b = crossSiteBadges({ ...base, lines: [line("a1", "J1", "aaron", "2026-10-20"), line("h1", "J1", "terry", "2026-10-22")] });
    expect(b.get("a1")?.text).toBe("→ HUT");
    expect(b.get("a1")?.title).toContain("Paint Thu Oct 22");
    expect(b.has("h1")).toBe(false);
  });
  it("uses the Jobs list Mfg Region when Hutchinson hasn't scheduled it yet", () => {
    const b = crossSiteBadges({ ...base, lines: [line("a3", "J3", "aaron", "2026-10-20")] });
    expect(b.get("a3")?.title).toContain("Mfg Region WK");
  });
  it("leaves NEK-only jobs and custom cards alone", () => {
    const b = crossSiteBadges({
      ...base,
      lines: [line("a2", "J2", "aaron", "2026-10-20"), line("c", "J1", "aaron", "2026-10-20", { isCustom: true }), line("h", "J1", "terry", "2026-10-21")],
    });
    expect(b.size).toBe(0);
  });
});
