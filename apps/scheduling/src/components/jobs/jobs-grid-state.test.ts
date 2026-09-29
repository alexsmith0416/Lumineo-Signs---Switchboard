import { describe, expect, it } from "vitest";
import type { JobRow } from "../../services/job-tracking";
import { applyGrid, buildGroupTree, flattenTree, matchFilter, type FilterCondition } from "./jobs-grid-state";

const row = (o: Partial<JobRow>): JobRow =>
  ({
    id: o.jobNo ?? "J1", jobNo: "J1", name: "", job: "J1", status: "Installation", statusSource: "airtable",
    tracked: true, inBc: true, description: "", sales: "", location: "", region: "", priority: "", orderDate: "",
    mfgFinalDate: "", mfgTargetMod: "", redDate: "", notes: "", powerlines: "", holdReason: "", dateToHold: "",
    dateOffHold: "", expeditor: "", dateInstalled: "", dateToAdmin: "", dateInvoiced: "", vendor: "", po: "",
    vendorStatus: "", storageLocation: "", vendorShipDate: "", vendorShipDate2: "", outsourcedArrival: "",
    graphics: "", routingType: "", ulSign: false, process: "", mfgRegion: "", installRegion: "", value: null, dip: null,
    ...o,
  }) as JobRow;

const f = (o: Partial<FilterCondition>): FilterCondition => ({ id: "f", conjunction: "and", field: "status", op: "is", value: "", ...o });

describe("matchFilter", () => {
  const r = row({ sales: "VB, NH", status: "Hold - Customer", ulSign: true });
  it("handles is / contains / empty", () => {
    expect(matchFilter(r, f({ op: "is", value: "hold - customer" }))).toBe(true);
    expect(matchFilter(r, f({ op: "contains", value: "hold" }))).toBe(true);
    expect(matchFilter(r, f({ field: "notes", op: "is_empty" }))).toBe(true);
  });
  it("matches any value of a multi-value cell", () => {
    expect(matchFilter(r, f({ field: "sales", op: "is_any_of", value: "NH,QT" }))).toBe(true);
    expect(matchFilter(r, f({ field: "sales", op: "is_none_of", value: "NH" }))).toBe(false);
  });
  it("treats a ticked checkbox as a value", () => {
    expect(matchFilter(r, f({ field: "ulSign", op: "is_not_empty" }))).toBe(true);
  });
});

describe("applyGrid", () => {
  const rows = [
    row({ jobNo: "J3", job: "J3 Gamma", status: "Installation", dip: 30 }),
    row({ jobNo: "J1", job: "J1 Alpha", status: "Complete to Admin", dip: 5 }),
    row({ jobNo: "J2", job: "J2 Beta", status: "Not tracked yet", dip: null }),
  ];
  it("orders by status tier by default", () => {
    expect(applyGrid(rows, "", { sorts: [], filters: [], groups: [] }).map((r) => r.jobNo)).toEqual(["J1", "J3", "J2"]);
  });
  it("applies the user's sort first", () => {
    expect(applyGrid(rows, "", { sorts: [{ field: "dip", asc: false }], filters: [], groups: [] }).map((r) => r.jobNo))
      .toEqual(["J3", "J1", "J2"]);
  });
  it("searches the job name", () => {
    expect(applyGrid(rows, "beta", { sorts: [], filters: [], groups: [] }).map((r) => r.jobNo)).toEqual(["J2"]);
  });
  it("combines filters with and / or", () => {
    const filters = [f({ value: "installation" }), f({ id: "g", conjunction: "or", value: "complete to admin" })];
    expect(applyGrid(rows, "", { sorts: [], filters, groups: [] })).toHaveLength(2);
  });
});

describe("group tree", () => {
  const rows = [row({ jobNo: "J1", status: "Installation", region: "WK" }), row({ jobNo: "J2", status: "Installation", region: "NEK" }), row({ jobNo: "J3", status: "Complete to Admin", region: "WK" })];
  const tree = buildGroupTree(rows, [{ field: "status", asc: true }, { field: "region", asc: true }]);
  it("nests groups, status groups in tier order", () => {
    expect(tree.map((n) => [n.key, n.count])).toEqual([["Complete to Admin", 1], ["Installation", 2]]);
    expect(tree[1]!.children.map((n) => n.key)).toEqual(["NEK", "WK"]);
  });
  it("hides a collapsed group's rows", () => {
    const flat = flattenTree(tree, new Set(["Installation"]));
    expect(flat.filter((i) => i.kind === "row")).toHaveLength(1);
  });
});
