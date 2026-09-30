import { describe, expect, it } from "vitest";
import { daysOnHold, holdTransition, planStatusBackfill, stepsToComplete, type HoldFields } from "./job-status";

type St = "completed" | "active" | "included";
const steps = (...a: Array<[string, St]>) => a.map(([key, state]) => ({ key, state }));
const TODAY = new Date(2026, 8, 29, 15, 0);
const hold = (o: Partial<HoldFields> = {}): HoldFields => ({ holdReason: "", dateToHold: "", dateOffHold: "", priorHoldDays: 0, ...o });

describe("stepsToComplete", () => {
  const job = steps(["R", "completed"], ["MF", "active"], ["P", "included"], ["I", "included"]);
  it("completes every open step for a complete status", () => {
    for (const s of ["Complete-need paperwork", "Complete to Admin", "Complete Invoiced", "Service Complete to Admin"]) {
      expect(stepsToComplete(s, job)).toEqual(["MF", "P", "I"]);
    }
  });
  it("completes the production steps for an installation status, leaving Install", () => {
    expect(stepsToComplete("Installation", job)).toEqual(["MF", "P"]);
    expect(stepsToComplete("Install - waiting on product", job)).toEqual(["MF", "P"]);
  });
  it("does nothing for other statuses", () => {
    expect(stepsToComplete("MFG - Routing", job)).toEqual([]);
    expect(stepsToComplete("Hold - Customer", job)).toEqual([]);
  });
});

describe("holdTransition", () => {
  it("stamps Date to Hold and the reason when a job goes on hold", () => {
    expect(holdTransition(hold(), "MFG - Routing", "Hold - Permit", "2026-09-29"))
      .toEqual({ holdReason: "Hold - Permit", dateToHold: "2026-09-29", dateOffHold: "" });
  });
  it("stamps Date off Hold when it comes off", () => {
    expect(holdTransition(hold({ holdReason: "Hold - Permit", dateToHold: "2026-09-20" }), "Hold - Permit", "MFG - Routing", "2026-09-29"))
      .toEqual({ dateOffHold: "2026-09-29" });
  });
  it("carries a finished hold's days into priorHoldDays on the next hold", () => {
    const t = hold({ holdReason: "Hold - Permit", dateToHold: "2026-09-01", dateOffHold: "2026-09-08", priorHoldDays: 2 });
    expect(holdTransition(t, "MFG - Paint Prep / Paint", "Hold - Customer", "2026-09-29"))
      .toEqual({ holdReason: "Hold - Customer", dateToHold: "2026-09-29", dateOffHold: "", priorHoldDays: 9 });
  });
  it("switching between holds keeps the hold running, with the new reason", () => {
    expect(holdTransition(hold({ holdReason: "Hold - Permit", dateToHold: "2026-09-20" }), "Hold - Permit", "Hold - Local", "2026-09-29"))
      .toEqual({ holdReason: "Hold - Local" });
  });
  it("leaves the hold fields alone between non-hold statuses", () => {
    expect(holdTransition(hold(), "Upcoming Mfg.", "MFG - Routing", "2026-09-29")).toEqual({});
  });
});

describe("daysOnHold", () => {
  it("counts a finished hold, an ongoing one to today, and earlier holds", () => {
    expect(daysOnHold(hold({ dateToHold: "2026-09-14", dateOffHold: "2026-09-21" }), TODAY)).toBe(7);
    expect(daysOnHold(hold({ dateToHold: "2026-09-24" }), TODAY)).toBe(5);
    expect(daysOnHold(hold({ dateToHold: "2026-09-24", priorHoldDays: 3 }), TODAY)).toBe(8);
    expect(daysOnHold(hold(), TODAY)).toBe(0);
  });
});

describe("planStatusBackfill", () => {
  it("lists the jobs whose steppers are behind their status", () => {
    const plan = planStatusBackfill(
      [
        { jobNo: "J1", status: "Complete Invoiced" },
        { jobNo: "J2", status: "Installation" },
        { jobNo: "J3", status: "MFG - Routing" },
        { jobNo: "J4", status: "Complete to Admin" },
      ],
      (jobNo) =>
        jobNo === "J4"
          ? steps(["MF", "completed"], ["I", "completed"])
          : steps(["MF", "active"], ["I", "included"]),
    );
    expect(plan).toEqual([
      { jobNo: "J1", status: "Complete Invoiced", keys: ["MF", "I"], allKeys: ["MF", "I"], kind: "complete" },
      { jobNo: "J2", status: "Installation", keys: ["MF"], allKeys: ["MF", "I"], kind: "install" },
    ]);
  });
});
