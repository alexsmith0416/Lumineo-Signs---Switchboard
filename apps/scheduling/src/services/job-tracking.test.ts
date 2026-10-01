import { describe, expect, it } from "vitest";
import { buildJobRows, currentStatus, daysInProcess, defaultJobName, sharePointCustomer, type JobTrack } from "./job-tracking";

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
  it("counts whole days since the order (release) date", () => {
    expect(daysInProcess("2026-09-09", TODAY)).toBe(20);
  });
  it("is null without an order date, and never negative", () => {
    expect(daysInProcess("", TODAY)).toBeNull();
    expect(daysInProcess("2026-10-05", TODAY)).toBe(0);
  });
});

describe("DOH and Actual DIP", () => {
  const [row] = buildJobRows([], [track({ dateToHold: "2026-09-14", dateOffHold: "2026-09-21", priorHoldDays: 2 })], new Map(), TODAY);
  it("DIP is the whole span; DOH counts every hold; Actual DIP subtracts it", () => {
    expect(row).toMatchObject({ dip: 20, doh: 9, actualDip: 11 });
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
    { jobNo: "J39571", name: "McPherson CVB", description: "Sign swap", remaining: 1200, city: "McPherson", state: "ks", salesperson: "QTOTTA", orderAmount: 8400 },
    { jobNo: "J40001", name: "New Co", description: "Pylon", remaining: 50_000, city: "Salina", salesperson: "DWELU" },
  ];
  const schedules = new Map([["J39571", { redDate: "2026-10-02", productionCompleteDate: "2026-09-30", releasedDate: "2026-09-19" }]]);
  const rows = buildJobRows(bc, [track(), track({ jobNo: "J28500", legacyStatus: "Service Complete to Admin" })], schedules, TODAY);
  const by = (j: string) => rows.find((r) => r.jobNo === j)!;

  it("has one row per job across BC and tracking", () => {
    expect(rows.map((r) => r.jobNo).sort()).toEqual(["J28500", "J39571", "J40001"]);
  });
  it("joins BC, tracking and schedule fields", () => {
    expect(by("J39571")).toMatchObject({
      job: "J39571 McPherson CVB", status: "Installation", tracked: true, inBc: true,
      value: 8400, remaining: 1200, redDate: "2026-10-02", mfgTargetMod: "2026-09-30",
    });
  });
  it("fills Sales, Region and Location from BC over the Airtable values", () => {
    expect(by("J39571")).toMatchObject({ sales: "QT", region: "NEK", location: "McPherson, KS" });
  });
  it("uses the release date as the Order Date, and counts DIP from it", () => {
    expect(by("J39571")).toMatchObject({ orderDate: "2026-09-19", dip: 10 });
  });
  it("shows a new BC job as not tracked yet, with BC's salesperson and city", () => {
    expect(by("J40001")).toMatchObject({ status: "Not tracked yet", tracked: false, inBc: true, sales: "DW", region: "WK", location: "Salina", dip: null });
  });
  it("flags a tracked job that isn't in the BC sync", () => {
    expect(by("J28500")).toMatchObject({ tracked: true, inBc: false, value: null, job: "J28500" });
  });
});

describe("value", () => {
  const bcJobs = [
    { jobNo: "J1", name: "A", description: "", remaining: 5000, city: "", salesperson: "", orderAmount: 20_000 },
    { jobNo: "J2", name: "B", description: "", remaining: 0, city: "", salesperson: "", orderAmount: null },
  ];
  const rows = buildJobRows(bcJobs, [], new Map(), TODAY, new Map([["J1", 900], ["J2", 1200]]));
  it("is the Sales Order amount, with the remaining balance alongside", () => {
    expect(rows.find((r) => r.jobNo === "J1")).toMatchObject({ value: 20_000, remaining: 5000 });
  });
  it("falls back to the invoice amount on the job's cards", () => {
    expect(rows.find((r) => r.jobNo === "J2")).toMatchObject({ value: 1200, remaining: 0 });
  });
});

describe("target dates", () => {
  const bcJob = { jobNo: "J1", name: "A", description: "", remaining: 0, city: "", salesperson: "", releaseDate: "2026-09-03" };
  const vinylOnly = () => ({ productionWeeks: 4, installWeeks: 7, rule: { name: "Vinyl only" } });
  it("uses BC's release date for Order Date and the targets, with the job's lead time", () => {
    const [row] = buildJobRows([bcJob], [], new Map(), TODAY, new Map(), vinylOnly);
    expect(row).toMatchObject({
      releaseDate: "2026-09-03", orderDate: "2026-09-03",
      mfgTarget: "2026-10-01", installTarget: "2026-10-22", mfgFinalDate: "2026-10-01", leadRule: "Vinyl only",
    });
  });
  it("an in-app release date and production override win; Mfg Final follows the override", () => {
    const sch = new Map([["J1", { redDate: "", productionCompleteDate: "2026-11-02", releasedDate: "2026-09-10" }]]);
    const [row] = buildJobRows([bcJob], [], sch, TODAY);
    expect(row).toMatchObject({ releaseDate: "2026-09-10", mfgTarget: "2026-10-29", mfgTargetMod: "2026-11-02", mfgFinalDate: "2026-11-02" });
  });
  it("keeps an Airtable Mfg Final date as the modified date", () => {
    const [row] = buildJobRows([bcJob], [track({ jobNo: "J1", mfgFinalDate: "2026-10-20" })], new Map(), TODAY);
    expect(row).toMatchObject({ mfgTarget: "2026-10-22", mfgTargetMod: "2026-10-20", mfgFinalDate: "2026-10-20" });
  });
});

describe("job name", () => {
  const bc = (o: object) => ({ jobNo: "J39569", name: "", description: "", remaining: 0, city: "", salesperson: "", ...o });
  it("is BC's ship-to name", () => {
    expect(defaultJobName(bc({ name: "Shelter Insurance" }))).toBe("Shelter Insurance");
  });
  it("ignores a BC name that is just the job number, using the SharePoint customer folder", () => {
    expect(defaultJobName(bc({ name: "J39569", folderName: "Shelter Insurance - Josh Alexander" }))).toBe("Shelter Insurance - Josh Alexander");
    expect(defaultJobName(bc({ name: "J39569" }))).toBe("");
  });
  it("reads the customer folder out of the SharePoint link", () => {
    expect(sharePointCustomer("https://x.sharepoint.com/sites/JobFiles/Shared Documents/S/Shelter Insurance - Josh Alexander/Shelter Insurance - Josh Alexander/McPherson/J39569"))
      .toBe("Shelter Insurance - Josh Alexander");
    expect(sharePointCustomer("https://x.sharepoint.com/sites/JobFiles/Shared%20Documents/D/Dan%27s%20Cycle/J38194")).toBe("Dan's Cycle");
    expect(sharePointCustomer("")).toBe("");
  });
  it("a manual name wins; the default stays available", () => {
    const [row] = buildJobRows([bc({ name: "J39569", folderName: "Shelter" })], [track({ jobNo: "J39569", jobName: "Shelter - McPherson" })], new Map(), TODAY);
    expect(row).toMatchObject({ name: "Shelter - McPherson", defaultName: "Shelter", job: "J39569 Shelter - McPherson" });
  });
});

describe("sales override", () => {
  const bc = [{ jobNo: "J1", name: "A", description: "", remaining: 0, city: "", salesperson: "NHASKELL" }];
  it("shows BC's salesperson until the app changes it, and BC's again when cleared", () => {
    expect(buildJobRows(bc, [track({ jobNo: "J1", sales: "VB" })], new Map(), TODAY)[0]!.sales).toBe("NH");
    expect(buildJobRows(bc, [track({ jobNo: "J1", salesOverride: "NH, VB" })], new Map(), TODAY)[0]!.sales).toBe("NH, VB");
    expect(buildJobRows(bc, [track({ jobNo: "J1", salesOverride: "" })], new Map(), TODAY)[0]!.sales).toBe("NH");
  });
});
