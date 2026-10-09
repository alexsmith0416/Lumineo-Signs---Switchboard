import { describe, expect, it } from "vitest";
import {
  jobPoSummary,
  searchPOs,
  statusAfterDelivery,
  summaryText,
  vendorStatusOf,
  workLists,
  type PoDelivery,
  type PoReceipt,
  type WarehousePO,
} from "./po-receiving";

const po = (poNo: string, jobNo: string, o: Partial<WarehousePO> = {}): WarehousePO => ({
  poNo,
  jobNo,
  vendorNo: "V1",
  vendorName: "Sample Metals",
  orderDate: "2026-09-20",
  status: "Released",
  ...o,
});
const delivery = (poNo: string, date: string, o: Partial<PoDelivery> = {}): PoDelivery => ({
  id: `${poNo}-${date}`,
  poNo,
  jobNo: "J1",
  date,
  site: "",
  location: "Receiving Shelf",
  receivedBy: "Tester",
  notes: "",
  final: false,
  ...o,
});
const receipt = (poNo: string, vendorStatus: string): PoReceipt => ({ poNo, jobNo: "J1", vendorStatus, statusBy: "", statusAt: "" });

describe("a PO's Vendor Status", () => {
  it("is the one set by hand when there is one", () => {
    expect(vendorStatusOf(receipt("P1", "Delayed"), [delivery("P1", "2026-10-01")])).toBe("Delayed");
  });
  it("otherwise follows the deliveries: a final one → Received, any → Partially Received", () => {
    expect(vendorStatusOf(undefined, [delivery("P1", "2026-10-01")])).toBe("Partially Received");
    expect(vendorStatusOf(undefined, [delivery("P1", "2026-10-01", { final: true })])).toBe("Received");
    expect(vendorStatusOf(undefined, [])).toBe("");
  });
  it("a new delivery sets Received when final, Partially Received when not", () => {
    expect(statusAfterDelivery(true)).toBe("Received");
    expect(statusAfterDelivery(false)).toBe("Partially Received");
  });
});

describe("a job's PO roll-up", () => {
  const pos = [po("P1", "J1"), po("P2", "J1"), po("P0", "J1", { status: "Archived" })];
  const deliveries: Record<string, PoDelivery[]> = {
    P1: [
      delivery("P1", "2026-10-01", { location: "Supply Room" }),
      delivery("P1", "2026-10-03", { final: true, site: "Hutchinson", location: "Vinyl Room" }),
    ],
  };

  it("is Materials ready only when every non-archived PO is Received", () => {
    const status = (s: Record<string, string>) => (n: string) => s[n] ?? "";
    const of = (n: string) => deliveries[n] ?? [];
    expect(jobPoSummary(pos, status({ P1: "Received" }), of).materialsReady).toBe(false);
    expect(jobPoSummary(pos, status({ P1: "Received", P2: "received" }), of).materialsReady).toBe(true);
    expect(jobPoSummary([po("P0", "J1", { status: "Archived" })], () => "", of).materialsReady).toBe(false);
  });

  it("counts open / partial / received / archived and lists locations newest first", () => {
    const s = jobPoSummary(pos, (n) => (n === "P1" ? "Received" : "Partially Received"), (n) => deliveries[n] ?? []);
    expect(s).toEqual({ open: 2, received: 1, partial: 1, archived: 1, materialsReady: false, locations: ["Hutchinson · Vinyl Room", "Supply Room"] });
    expect(summaryText(s)).toBe("2 POs · 1 partial · 1 received");
  });

  it("reads 'all received' and '… closed'", () => {
    expect(summaryText({ open: 2, received: 2, partial: 0, archived: 0, materialsReady: true, locations: [] })).toBe("2 POs · all received");
    expect(summaryText({ open: 0, received: 0, partial: 0, archived: 3, materialsReady: false, locations: [] })).toBe("3 closed");
    expect(summaryText({ open: 0, received: 0, partial: 0, archived: 0, materialsReady: false, locations: [] })).toBe("");
  });
});

describe("searching POs", () => {
  const pos = [po("PO-100", "J1"), po("PO-101", "J1", { vendorName: "Acrylics Co" }), po("PO-200", "J2")];
  const names: Record<string, string> = { J1: "Shelter Insurance", J2: "City Hall" };
  const nameOf = (j: string) => names[j] ?? "";

  it("brings a matched PO's whole job, marking the match", () => {
    expect(searchPOs(pos, "po-101", nameOf)).toEqual([{ jobNo: "J1", pos: [pos[0], pos[1]], matchedPo: "PO-101" }]);
  });
  it("finds by job #, job name and vendor", () => {
    expect(searchPOs(pos, "j2", nameOf).map((r) => r.jobNo)).toEqual(["J2"]);
    expect(searchPOs(pos, "shelter", nameOf).map((r) => r.jobNo)).toEqual(["J1"]);
    expect(searchPOs(pos, "acrylic", nameOf).map((r) => r.jobNo)).toEqual(["J1"]);
  });
  it("puts an exact PO / job match first", () => {
    expect(searchPOs(pos, "PO-200", nameOf)[0]!.jobNo).toBe("J2");
    expect(searchPOs(pos, "  ", nameOf)).toEqual([]);
  });
});

describe("the work lists", () => {
  const pos = [
    po("P1", "J1", { orderDate: "2026-09-25" }),
    po("P2", "J1", { orderDate: "2026-09-10" }),
    po("P3", "J2"),
    po("P4", "J2", { status: "Archived" }),
  ];
  const deliveries: Record<string, PoDelivery[]> = {
    P3: [delivery("P3", "2026-10-06")],
    P4: [delivery("P4", "2026-09-01", { final: true })],
  };
  const status = (n: string) => vendorStatusOf(undefined, deliveries[n] ?? []);
  const lists = workLists(pos, status, (n) => deliveries[n] ?? [], "2026-10-08");

  it("waiting = open POs with nothing received, oldest order first", () => {
    expect(lists.waiting.map((p) => p.poNo)).toEqual(["P2", "P1"]);
  });
  it("partial = partially received POs", () => {
    expect(lists.partial.map((p) => p.poNo)).toEqual(["P3"]);
  });
  it("recent = a delivery in the last 7 days", () => {
    expect(lists.recent.map((p) => p.poNo)).toEqual(["P3"]);
  });
});
