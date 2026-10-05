import { describe, expect, it } from "vitest";
import { ARCHIVED, bcPurchaseOrderUrl, formatOrderDate, sortJobPOs, type JobPO } from "./job-pos";

const po = (poNo: string, orderDate: string, status = "Released"): JobPO => ({
  poNo, vendorNo: "", vendorName: "", orderDate, status,
});

describe("job POs", () => {
  it("sorts newest order first, undated last, then by PO number", () => {
    const out = sortJobPOs([po("PO-9", ""), po("PO-2", "2026-09-01"), po("PO-10", "2026-09-20"), po("PO-1", "2026-09-01")]);
    expect(out.map((p) => p.poNo)).toEqual(["PO-10", "PO-1", "PO-2", "PO-9"]);
  });

  it("links an open PO to the Purchase Order card and an archived one to the archives", () => {
    expect(bcPurchaseOrderUrl(po("PO-1", "", "Open"))).toContain("page=50&");
    const arch = bcPurchaseOrderUrl(po("PO-1", "", ARCHIVED));
    expect(arch).toContain("page=9347&");
    expect(decodeURIComponent(arch)).toContain("'No.' IS 'PO-1'");
  });

  it("formats date-only text without a time zone", () => {
    expect(formatOrderDate("2026-01-05")).toBe("Jan 5, 2026");
    expect(formatOrderDate("")).toBe("");
  });
});
