import { describe, expect, it } from "vitest";
import { installCardsToCheck, installWarnings } from "./install-readiness";

const d = (s: string) => new Date(`${s}T08:00:00`);

describe("installWarnings", () => {
  const installStart = d("2026-10-21"); // Wed

  it("warns for open production cards ending after the install starts — latest per department", () => {
    const w = installWarnings({
      installStart,
      prod: [
        { deptName: "Paint", end: d("2026-10-20"), done: false }, // before: fine
        { deptName: "Assembly", end: d("2026-10-22"), done: false },
        { deptName: "Assembly", end: d("2026-10-23"), done: false },
        { deptName: "Vinyl", end: d("2026-10-24"), done: true }, // dept complete: ignored
      ],
      materials: null,
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("Assembly is scheduled until Fri 10/23");
  });

  it("gives the times when production ends later the same day", () => {
    const w = installWarnings({
      installStart,
      prod: [{ deptName: "Vinyl", end: new Date("2026-10-21T15:00:00"), done: false }],
      materials: null,
    });
    expect(w).toEqual(["Vinyl is scheduled until 3:00 PM Wed 10/21, after this install starts (8:00 AM)"]);
  });

  it("warns when not every PO is received, never when there are no POs", () => {
    expect(installWarnings({ installStart, prod: [], materials: { open: 3, received: 1, materialsReady: false } })).toEqual([
      "Materials not ready — 1 of 3 POs received",
    ]);
    expect(installWarnings({ installStart, prod: [], materials: { open: 2, received: 2, materialsReady: true } })).toEqual([]);
    expect(installWarnings({ installStart, prod: [], materials: null })).toEqual([]);
  });
});

describe("installCardsToCheck", () => {
  const card = (id: string, jobNo: string, start: string, extra = {}) => ({ id, jobNo, startDateTime: d(start), ...extra });

  it("checks new cards and moved starts once per job; skips resizes, custom and mirrored cards", () => {
    const before = [card("a", "J1", "2026-10-20"), card("b", "J2", "2026-10-20")];
    const changed = [
      card("a", "J1", "2026-10-20"), // same start (a resize) → skip
      card("b", "J2", "2026-10-22"), // moved
      card("c", "J3", "2026-10-22"), // new
      card("d", "J3", "2026-10-23"), // same job again
      card("e", "Group", "2026-10-22", { isCustom: true }),
      card("f", "J4", "2026-10-22", { mirrorOf: "bucket" }),
    ];
    expect(installCardsToCheck(changed, before).map((l) => l.id)).toEqual(["b", "c"]);
  });
});
