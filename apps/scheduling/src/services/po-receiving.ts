/**
 * Warehouse Management — receiving against purchase orders (pure). Oct 8, 2026.
 *
 * The POs come from BC (crfdf_jobpo, BCSync_JobPOs). The app adds, per PO:
 *  - a VENDOR STATUS (the Airtable list + "Partially Received"), set by hand by
 *    Admin / Ops — never automatically from BC (approvals may still be pending);
 *  - DELIVERIES: one line per delivery received (date, the site it came in at and
 *    the storage spot there, who,
 *    notes). A partial delivery puts the PO in Partially Received; the final
 *    one in Received. A PO split across locations is just another line.
 * Receiving here never posts the receipt in BC — the PO's writer does that.
 *
 * A job is MATERIALS READY when every one of its non-archived POs is Received
 * (archived = BC closed it). Then BC's Job Purchasing step is completed.
 */
import { ARCHIVED, type JobPO } from "./job-pos";
import { deliveryPlace } from "./warehouse-sites";

/** Vendor Status options (the Airtable list + Partially Received). */
export const VENDOR_STATUSES: readonly string[] = [
  "Ordered", "Shipping", "Partially Received", "Received", "Ready to Pick Up", "Shipped",
  "Artwork Approved", "Delayed", "On Hold",
];
export const RECEIVED = "Received";
export const PARTIALLY_RECEIVED = "Partially Received";

/** A job PO with its job (a row of crfdf_jobpo). */
export interface WarehousePO extends JobPO {
  jobNo: string;
}

export interface PoReceipt {
  poNo: string;
  jobNo: string;
  vendorStatus: string;
  statusBy: string;
  /** ISO, "" = never set. */
  statusAt: string;
}

export interface PoDelivery {
  id: string;
  poNo: string;
  jobNo: string;
  /** YYYY-MM-DD. */
  date: string;
  /** The site it was received at ("Hutchinson"; "" on deliveries from before sites). */
  site: string;
  /** The storage spot there. */
  location: string;
  receivedBy: string;
  notes: string;
  /** The last delivery — the PO is Received. */
  final: boolean;
}

const sameStatus = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A PO's Vendor Status: the one set on it, else what its deliveries say
 * (a final one → Received, any → Partially Received), else "".
 */
export function vendorStatusOf(receipt: PoReceipt | undefined, deliveries: readonly PoDelivery[]): string {
  if (receipt?.vendorStatus) return receipt.vendorStatus;
  if (deliveries.some((d) => d.final)) return RECEIVED;
  return deliveries.length ? PARTIALLY_RECEIVED : "";
}

export const isReceived = (status: string): boolean => sameStatus(status, RECEIVED);
export const isPartial = (status: string): boolean => sameStatus(status, PARTIALLY_RECEIVED);

/** The status a new delivery puts the PO in. */
export const statusAfterDelivery = (final: boolean): string => (final ? RECEIVED : PARTIALLY_RECEIVED);

export interface JobPoSummary {
  /** Non-archived POs. */
  open: number;
  received: number;
  partial: number;
  /** Archived (closed in BC) — history only. */
  archived: number;
  /** Every non-archived PO Received (and there is at least one). */
  materialsReady: boolean;
  /** Where the job's received material is stored ("Hutchinson · Warehouse - Floor"),
   *  newest first, no repeats. */
  locations: string[];
}

/** A job's PO roll-up, for the Jobs list chip, the job panel and the cards. */
export function jobPoSummary(
  pos: readonly WarehousePO[],
  statusOf: (poNo: string) => string,
  deliveriesOf: (poNo: string) => readonly PoDelivery[],
): JobPoSummary {
  const live = pos.filter((p) => p.status !== ARCHIVED);
  const statuses = live.map((p) => statusOf(p.poNo));
  const received = statuses.filter(isReceived).length;
  const locations: string[] = [];
  const all = pos.flatMap((p) => deliveriesOf(p.poNo)).sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of all) {
    const place = deliveryPlace(d);
    if (place && !locations.includes(place)) locations.push(place);
  }
  return {
    open: live.length,
    received,
    partial: statuses.filter(isPartial).length,
    archived: pos.length - live.length,
    materialsReady: live.length > 0 && received === live.length,
    locations,
  };
}

/** "3 POs · 1 partial · 1 received" — the Jobs list chip text. */
export function summaryText(s: JobPoSummary): string {
  if (!s.open && !s.archived) return "";
  if (!s.open) return `${s.archived} closed`;
  const parts = [`${s.open} PO${s.open === 1 ? "" : "s"}`];
  if (s.partial) parts.push(`${s.partial} partial`);
  if (s.received) parts.push(s.received === s.open ? "all received" : `${s.received} received`);
  return parts.join(" · ");
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Search the POs by PO #, job #, vendor or job name. A match on a PO also
 * brings its job's other POs (so the receiver sees the whole job); results
 * are grouped by job. `nameOf` gives a job's name.
 */
export function searchPOs(
  pos: readonly WarehousePO[],
  query: string,
  nameOf: (jobNo: string) => string,
): Array<{ jobNo: string; pos: WarehousePO[]; matchedPo: string | null }> {
  const q = norm(query);
  if (!q) return [];
  const byJob = new Map<string, WarehousePO[]>();
  for (const p of pos) byJob.set(p.jobNo, [...(byJob.get(p.jobNo) ?? []), p]);
  const out: Array<{ jobNo: string; pos: WarehousePO[]; matchedPo: string | null }> = [];
  for (const [jobNo, list] of byJob) {
    const po = list.find((p) => norm(p.poNo).includes(q));
    const job = norm(jobNo).includes(q) || norm(nameOf(jobNo)).includes(q);
    const vendor = list.some((p) => norm(p.vendorName).includes(q) || norm(p.vendorNo) === q);
    if (po || job || vendor) out.push({ jobNo, pos: list, matchedPo: po?.poNo ?? null });
  }
  // Exact PO / job matches first, then by job number.
  const rank = (r: { jobNo: string; matchedPo: string | null }) =>
    (r.matchedPo && norm(r.matchedPo) === q) || norm(r.jobNo) === q ? 0 : 1;
  return out.sort((a, b) => rank(a) - rank(b) || a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true }));
}

/** Days between two YYYY-MM-DD dates (b − a). */
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The work lists shown before anything is searched:
 *  - partial: POs partially received, still waiting on the rest;
 *  - recent: POs with a delivery in the last `days` days, newest first;
 *  - waiting: open, non-archived POs nothing has been received on, oldest order first.
 */
export function workLists(
  pos: readonly WarehousePO[],
  statusOf: (poNo: string) => string,
  deliveriesOf: (poNo: string) => readonly PoDelivery[],
  today: string,
  days = 7,
): { partial: WarehousePO[]; recent: WarehousePO[]; waiting: WarehousePO[] } {
  const live = pos.filter((p) => p.status !== ARCHIVED);
  const lastDelivery = (p: WarehousePO) => deliveriesOf(p.poNo).reduce((m, d) => (d.date > m ? d.date : m), "");
  return {
    partial: live.filter((p) => isPartial(statusOf(p.poNo))),
    recent: pos
      .filter((p) => {
        const d = lastDelivery(p);
        return d && daysBetween(d, today) <= days;
      })
      .sort((a, b) => (lastDelivery(a) < lastDelivery(b) ? 1 : -1)),
    waiting: live
      .filter((p) => !deliveriesOf(p.poNo).length && !isReceived(statusOf(p.poNo)))
      .sort((a, b) => (a.orderDate || "9999").localeCompare(b.orderDate || "9999")),
  };
}
