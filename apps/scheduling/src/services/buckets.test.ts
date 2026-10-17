import { describe, expect, it } from "vitest";
import type { Employee, ScheduleLine } from "../engine/types";
import type { JobRow } from "./job-tracking";
import {
  EMPTY_FILTER,
  bucketFillLines,
  dropOffs,
  filterSync,
  insertIndex,
  matchesFilter,
  orderItems,
  viewSort,
  type BucketItem,
  type BucketList,
} from "./buckets";

const item = (jobNo: string, releasedDate: string, extra: Partial<BucketItem> = {}): BucketItem => ({
  id: `i-${jobNo}`, bucketId: "b", jobNo, customerName: `C ${jobNo}`, task: "", estimatedHours: 2,
  releasedDate, sortOrder: 0, pinned: false, source: "manual", ...extra,
});
const bucket = (extra: Partial<BucketList> = {}): BucketList => ({
  id: "b", kind: "production", name: "Vinyl bucket", color: "#C8E6D4", textColor: "#04342c", description: "",
  mode: "manual", filter: null, deptKey: "V", defaultEmployees: [], sortOrder: 0, collapsed: false, ...extra,
});
const row = (jobNo: string, extra: Partial<JobRow> = {}): JobRow =>
  ({ jobNo, inBc: true, name: `Cust ${jobNo}`, job: jobNo, status: "In Production", priority: "", mfgRegion: "WK",
     installRegion: "WK", sales: "Vic B", salespersonCode: "VB", releaseDate: "2026-10-01", redDate: "", mfgTarget: "",
     installTarget: "", ...extra }) as JobRow;

describe("orderItems", () => {
  it("puts the oldest released first, unknown dates last", () => {
    const o = orderItems([item("J3", ""), item("J2", "2026-10-05"), item("J1", "2026-09-30")]);
    expect(o.map((i) => i.jobNo)).toEqual(["J1", "J2", "J3"]);
  });
  it("keeps the hand order once a job was dragged", () => {
    const o = orderItems([
      item("J1", "2026-09-30", { sortOrder: 2, pinned: true }),
      item("J2", "2026-10-05", { sortOrder: 0, pinned: true }),
      item("J3", "2026-10-07", { sortOrder: 1 }),
    ]);
    expect(o.map((i) => i.jobNo)).toEqual(["J2", "J3", "J1"]);
  });
  it("inserts a new job before the first one released after it", () => {
    expect(insertIndex([item("J1", "2026-09-30"), item("J2", "2026-10-05")], "2026-10-01")).toBe(1);
    expect(insertIndex([item("J1", "2026-09-30")], "")).toBe(1);
  });
});

describe("viewSort", () => {
  it("sorts by a Jobs list date without changing the list", () => {
    const rows = new Map([["J1", row("J1", { redDate: "2026-11-01" })], ["J2", row("J2", { redDate: "2026-10-20" })]]);
    const items = [item("J1", ""), item("J2", "")];
    expect(viewSort(items, "redDate", (j) => rows.get(j)).map((i) => i.jobNo)).toEqual(["J2", "J1"]);
    expect(viewSort(items, "list", () => undefined)).toEqual(items);
  });
});

describe("filters", () => {
  it("matches status, region, customer and release dates", () => {
    const f = { ...EMPTY_FILTER, statuses: ["In Production"], mfgRegion: "nek", customer: "biscuit", releasedFrom: "2026-09-01" };
    expect(matchesFilter(row("J1", { mfgRegion: "NEK", name: "The Big Biscuit" }), f)).toBe(true);
    expect(matchesFilter(row("J1", { mfgRegion: "WK", name: "The Big Biscuit" }), f)).toBe(false);
    expect(matchesFilter(row("J1", { mfgRegion: "NEK", name: "The Big Biscuit", releaseDate: "2026-08-01" }), f)).toBe(false);
  });
  it("adds new matches and removes filter jobs that stopped matching — never hand-added ones", () => {
    const b = bucket({ mode: "filter", filter: { ...EMPTY_FILTER, mfgRegion: "NEK" } });
    const items = [item("J1", "", { source: "filter" }), item("J2", "", { source: "manual" })];
    const sync = filterSync(b, items, [row("J1", { mfgRegion: "WK" }), row("J2", { mfgRegion: "WK" }), row("J3", { mfgRegion: "NEK" }), row("J4", { mfgRegion: "NEK" })], (j) => j === "J4");
    expect(sync.add.map((r) => r.jobNo)).toEqual(["J3"]);
    expect(sync.remove.map((i) => i.jobNo)).toEqual(["J1"]);
  });
});

describe("dropOffs", () => {
  it("drops jobs whose step for the bucket's department is complete", () => {
    const done = new Map([["J1", new Set(["V"])], ["J2", new Set(["P"])]]);
    const out = dropOffs(bucket(), [item("J1", ""), item("J2", "")], (j) => done.get(j) ?? new Set());
    expect(out.map((i) => i.jobNo)).toEqual(["J1"]);
    expect(dropOffs(bucket({ deptKey: "" }), [item("J1", "")], () => new Set(["V"]))).toEqual([]);
  });
});

describe("bucketFillLines", () => {
  const aaron = { id: "aaron", name: "Aaron", departmentId: "vinyl", standardHoursPerDay: 8, worksWeekends: false } as Employee;
  const job = (day: string, from: number, to: number): ScheduleLine =>
    ({ id: `j-${day}`, jobNo: "J9", employeeId: "aaron", startDateTime: new Date(`${day}T${String(from).padStart(2, "0")}:00:00`),
       endDateTime: new Date(`${day}T${String(to).padStart(2, "0")}:00:00`) }) as ScheduleLine;
  const days = ["2026-10-19", "2026-10-20", "2026-10-24"].map((d) => new Date(`${d}T00:00:00`)); // Mon, Tue, Sat
  const fill = bucketFillLines({
    buckets: [bucket({ defaultEmployees: ["aaron"] })],
    itemsOf: () => [item("J1", "2026-09-30")],
    employees: [aaron],
    schedule: [job("2026-10-20", 8, 10), job("2026-10-19", 8, 16)],
    days,
  }).get("aaron")!;
  it("fills only the free time, one card per workday, after the day's jobs", () => {
    expect(fill).toHaveLength(1); // Mon is full, Sat is a weekend
    expect(fill[0]!.startDateTime).toEqual(new Date("2026-10-20T10:00:00"));
    expect(fill[0]!.estimatedHours).toBe(6);
    expect(fill[0]).toMatchObject({ mirrorOf: "bucket", bucketId: "b", isLocked: true });
    expect(fill[0]!.planningLineDescription).toContain("1. J1");
  });
});
