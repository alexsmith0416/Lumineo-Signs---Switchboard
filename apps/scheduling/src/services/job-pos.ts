// A job's purchase orders, for the job panel's "Purchase orders" section.
// Rows come from crfdf_jobpo (BCSync_JobPOs flow: our BC queries LumineoJobPOs
// for open orders + LumineoJobPOArchive for orders BC has archived once fully
// received / invoiced). Pure — no I/O.

export interface JobPO {
  poNo: string;
  vendorNo: string;
  vendorName: string;
  /** YYYY-MM-DD, "" = none. */
  orderDate: string;
  /** Open / Released / Pending Approval / Pending Prepayment, or "Archived". */
  status: string;
}

export const ARCHIVED = "Archived";

const BC_ORIGIN = "https://businesscentral.dynamics.com";
const BC_COMPANY = "Luminous Neon";
const BC_PURCHASE_ORDER_PAGE = 50; // Purchase Order card
const BC_PURCHASE_ORDER_ARCHIVES_PAGE = 9347; // Purchase Order Archives list (every version)

/** Opens the PO in BC: the order itself while it's open, its archived versions once it's gone. */
export function bcPurchaseOrderUrl(po: Pick<JobPO, "poNo" | "status">): string {
  const archived = po.status === ARCHIVED;
  const page = archived ? BC_PURCHASE_ORDER_ARCHIVES_PAGE : BC_PURCHASE_ORDER_PAGE;
  const filter = `'No.' IS '${po.poNo}'`;
  return `${BC_ORIGIN}/?company=${encodeURIComponent(BC_COMPANY)}&page=${page}&filter=${encodeURIComponent(filter)}`;
}

/** Newest order first; undated last; then by PO number. */
export function sortJobPOs(pos: JobPO[]): JobPO[] {
  return [...pos].sort((a, b) => {
    if (a.orderDate !== b.orderDate) {
      if (!a.orderDate) return 1;
      if (!b.orderDate) return -1;
      return a.orderDate < b.orderDate ? 1 : -1;
    }
    return a.poNo.localeCompare(b.poNo, undefined, { numeric: true });
  });
}

/** "2026-09-14" → "Sep 14, 2026" (date-only text; no time zone involved). */
export function formatOrderDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[Number(m[2]) - 1];
  return mon ? `${mon} ${Number(m[3])}, ${m[1]}` : ymd;
}
