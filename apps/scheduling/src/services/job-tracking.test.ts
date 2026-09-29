import { describe, expect, it } from "vitest";
import { buildJobRows, currentStatus, daysInProcess, type JobTrack } from "./job-tracking";

const TODAY = new Date(2026, 8, 29, 15, 0); // Tue Sep 29, 2026, mid-afternoon

function track(o: Partial<JobTrack> = {}): JobTrack {
  return {
    jobNo: "J39571", statusOverride: "", priority: "", holdReason: "", dateToHold: "", dateOffHold: "",
    orderDate: "2026-09-09", mfgFinalDate: "", expeditorDate: "", dateInstalled: "", dateToAdmin: "",
    dateInvoiced: "", vendor: "", poNumber: "", vendorStatus: "", storageLocation: "", vendorShipDate: "",
    vendorShipDate2: "", outsourcedArrival: "", graphics: "", routingType: "", powerlines: "", sales: "VB",
    location: "Wichita", region: "WK", mfgRegion: "WK", installRegion: "WK", ulSign: false, notes: "",
    legacyStatus: "Installation", legacyProcess: "In Process", ...o,
  };
}

describe("daysInProcess", () => {
  it("counts whole days since the order", () => {
    expect(daysInProcess(track(), TODAY)).toBe(20);
  });
  it("subtracts a finished hold", () => {
    expect(daysInProcess(track({ dateToHold: "2026-09-14", dateOffHold: "2026-09-21" }), TODAY)).toBe(13);
  });
  it("subtracts an ongoing hold up to today", () => {
    expect(daysInProcess(track({ dateToHold: "2026-09-24" }), TODAY)).toBe(15);
  });
  it("is null without an order date, and never negative", () => {
    expect(daysInProcess(track({ orderDate: "" }), TODAY)).toBeNull();
    expect(daysInProcess(track({ orderDate: "2026-10-05" }), TODAY)).toBe(0);
  });
});

describe("currentStatus", () => {
  it("prefers the manual override", () => {
    expect(currentStatus(track({ statusOverride: "Morton - National", holdReason: "Hold - Local" })))
      .toEqual({ status: "Morton - National", source: "override" });
  });
  it("shows an active hold", () => {
    expect(currentStatus(track({ holdReason: "Hold - Customer" }))).toEqual({ status: "Hold - Customer", source: "hold" });
  });
  it("ignores a hold that has ended", () => {
    expect(currentStatus(track({ holdReason: "Hold - Customer", dateOffHold: "2026-09-20" })).source).toBe("airtable");
  });
  it("falls back to the lead Airtable status of a merged job", () => {
    expect(currentStatus(track({ legacyStatus: "Steel MFG | MFG - Routing" }))).toEqual({ status: "Steel MFG", source: "airtable" });
  });
  it("marks a job with no tracking row", () => {
    expect(currentStatus(undefined)).toEqual({ status: "Not tracked yet", source: "untracked" });
  });
});

describe("buildJobRows", () => {
  const bc = [
    { jobNo: "J39571", name: "McPherson CVB", description: "Sign swap", remaining: 1200, city: "McPherson", salesperson: "NH" },
    { jobNo: "J40001", name: "New Co", description: "Pylon", remaining: 50_000, city: "Salina", salesperson: "DW" },
  ];
  const schedules = new Map([["J39571", { redDate: "2026-10-02", productionCompleteDate: "2026-09-30" }]]);
  const rows = buildJobRows(bc, [track(), track({ jobNo: "J28500", legacyStatus: "Service Complete to Admin" })], schedules, TODAY);
  const by = (j: string) => rows.find((r) => r.jobNo === j)!;

  it("has one row per job across BC and tracking", () => {
    expect(rows.map((r) => r.jobNo).sort()).toEqual(["J28500", "J39571", "J40001"]);
  });
  it("joins BC, tracking and schedule fields", () => {
    expect(by("J39571")).toMatchObject({
      job: "J39571 McPherson CVB", status: "Installation", tracked: true, inBc: true,
      sales: "VB", location: "Wichita", value: 1200, redDate: "2026-10-02", mfgTargetMod: "2026-09-30", dip: 20,
    });
  });
  it("shows a new BC job as not tracked yet, with BC's salesperson and city", () => {
    expect(by("J40001")).toMatchObject({ status: "Not tracked yet", tracked: false, inBc: true, sales: "DW", location: "Salina", dip: null });
  });
  it("flags a tracked job that isn't in the BC sync", () => {
    expect(by("J28500")).toMatchObject({ tracked: true, inBc: false, value: null, job: "J28500" });
  });
});
