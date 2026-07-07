// Business Central job data — served from the Sign365 → Power Automate →
// Dataverse mirror (docs/18-sign365-api-reference.md). This module reads
// four mirror tables and assembles the full job picture the UI needs:
//
//   crfdf_bcjob           → job no, ship-to customer (display name), ship-to
//                           address/ZIP, promised date
//   crfdf_bcplanningline  → Resource-type labor lines for the picker
//   crfdf_bccostandsales  → contract value + invoiced → remaining to invoice
//   crfdf_bctripresource  → trips per job; men + trucks per trip
//
// The app NEVER calls the Sign365 API directly — Power Automate owns the
// BC client secret and keeps these tables fresh (hot tier: 5–10 min).

import {
  getDataverseReader,
  str,
  num,
  dateOrNull,
  type DataverseRow,
} from "./dataverse-reader";
import { menFromResourceNo } from "./resource-department-map";

/** Lumineo's BC job-task bands — every job shares the same tree:
 *  1000s Admin · 2000s Design & Survey · 3000s Production ·
 *  4000s Installation · 5000s Shop Supplies · 9000s Opening/WIP. */
export type JobTaskPhase =
  | "admin"
  | "design"
  | "production"
  | "installation"
  | "supplies"
  | "wip"
  | "other";

export function phaseOfTaskNo(jobTaskNo: string): JobTaskPhase {
  const band = parseInt(jobTaskNo, 10);
  if (Number.isNaN(band)) return "other";
  if (band >= 1000 && band < 2000) return "admin";
  if (band >= 2000 && band < 3000) return "design";
  if (band >= 3000 && band < 4000) return "production";
  if (band >= 4000 && band < 5000) return "installation";
  if (band >= 5000 && band < 6000) return "supplies";
  if (band >= 9000) return "wip";
  return "other";
}

export interface BcPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
  /** BC job task the line posts to (e.g. 3020 Production Labor,
   *  4010 Install Labor). Drives production-vs-install routing. */
  jobTaskNo: string;
  phase: JobTaskPhase;
  /** BC resource code the line posts to (planning line `no`). 2000-band
   *  codes are department labor categories — the EXACT dept mapping. */
  resourceNo: string;
}

export interface BcTrip {
  tripNo: string;
  /** Crew members scheduled on this trip */
  men: number;
  /** Trucks assigned to this trip */
  trucks: number;
  date: Date | null;
}

export interface BcJob {
  jobNo: string;
  /** Ship-to customer name — the display name for the job across the UI. */
  customerName: string;
  /** Bill-to, kept for invoicing reference. */
  billToCustomerName: string;
  promisedDate: string;
  planningLines: BcPlanningLine[];
  /** Ship-to address pieces — drive the weather chip + map links. */
  shipToAddress: string;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  /** jobCostAndSales roll-up */
  contractValue: number;
  invoicedAmount: number;
  remainingToInvoice: number;
  /** TripsResources roll-up — estimated trips with per-trip crew/truck counts */
  trips: BcTrip[];
}

// Mirror table logical names (docs/18 §5). If your pac-generated services
// use different names, change them here only.
const T_JOB = "crfdf_bcjob";
const T_PLANNING_LINE = "crfdf_bcplanningline";
const T_COST_SALES = "crfdf_bccostandsales";
const T_TRIP_RESOURCE = "crfdf_bctripresource";

// The job-number column on crfdf_bcjob is crfdf_jobnumber (the alternate
// key the BCSync_Jobs flow upserts on). Planning lines use crfdf_jobno.
const JOB_NO_COL = "crfdf_jobnumber";
const PL_JOB_NO_COL = "crfdf_jobno";

function normalizeJobNo(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, "").toUpperCase();
  if (trimmed.startsWith("J")) return trimmed;
  return `J${trimmed}`;
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * BC Production data mixes J-prefixed and unprefixed job numbers — the
 * jobs table shows "J23221" while jobPlanningLines rows carry "23743".
 * Every jobNo filter therefore matches BOTH forms.
 */
function jobNoVariants(jobNo: string): string[] {
  const upper = jobNo.trim().toUpperCase();
  const bare = upper.startsWith("J") ? upper.slice(1) : upper;
  return [...new Set([upper.startsWith("J") ? upper : `J${bare}`, bare])];
}

function jobNoFilter(field: string, jobNo: string): string {
  return (
    "(" +
    jobNoVariants(jobNo)
      .map((v) => `${field} eq '${escapeOData(v)}'`)
      .join(" or ") +
    ")"
  );
}

type BcJobHeader = Omit<
  BcJob,
  "planningLines" | "trips" | "contractValue" | "invoicedAmount" | "remainingToInvoice"
>;

function rowToJobHeader(row: DataverseRow): BcJobHeader {
  // The BCSync_Jobs flow writes the customer NAME (once the Customers join
  // is live) or the customer CODE (interim) into crfdf_customername.
  // crfdf_billtocustomerno always holds the code. Ship-to columns are
  // populated by the Customers join; empty until then.
  const shipToName = str(row, "crfdf_shiptoname", "crfdf_shiptocustomername", "shipToName");
  const customerName = str(row, "crfdf_customername", "customerName");
  const billToNo = str(row, "crfdf_billtocustomerno", "billToCustomerNo");
  return {
    // Real table column is crfdf_jobnumber (the alternate-key column).
    jobNo: str(row, "crfdf_jobnumber", "crfdf_jobno", "crfdf_no", "no", "jobNo"),
    // Prefer ship-to name, then whatever's in customername (name or code),
    // then the bare bill-to code, then description as last resort.
    customerName:
      shipToName ||
      customerName ||
      billToNo ||
      str(row, "crfdf_description", "description"),
    billToCustomerName: customerName || billToNo,
    promisedDate: (() => {
      const d = dateOrNull(row, "crfdf_promiseddate", "crfdf_endingdate", "promisedDate");
      // BC uses 0001-01-01 as "no date" on open jobs — treat as unset.
      if (!d || d.getFullYear() < 1970) return new Date().toISOString();
      return d.toISOString();
    })(),
    shipToAddress: str(row, "crfdf_shiptoaddress", "shipToAddress"),
    shipToCity: str(row, "crfdf_shiptocity", "shipToCity"),
    shipToState: str(row, "crfdf_shiptostate", "crfdf_shiptocounty", "shipToState"),
    shipToZip: str(row, "crfdf_shiptozip", "crfdf_shiptopostcode", "shipToPostCode", "shipToZip"),
  };
}

function rowToPlanningLine(row: DataverseRow): BcPlanningLine {
  const jobTaskNo = str(row, "crfdf_jobtaskno", "jobTaskNo");
  return {
    lineNo: num(row, "crfdf_lineno", "lineNo"),
    description: str(row, "crfdf_description", "description"),
    estimatedHours: num(row, "crfdf_quantity", "crfdf_estimatedhours", "quantity"),
    jobTaskNo,
    phase: phaseOfTaskNo(jobTaskNo),
    resourceNo: str(row, "crfdf_no", "no", "crfdf_resourceno", "resourceNo"),
  };
}

async function loadPlanningLines(jobNo: string): Promise<BcPlanningLine[]> {
  const reader = getDataverseReader();
  const rows = await reader.retrieveMultiple(T_PLANNING_LINE, {
    // Resource lines only — G/L Account / Item / Text lines are not
    // schedulable labor. BC's field is `jobType` ("Resource" |
    // "G/L Account" | "Item"); the sync flow writes it into crfdf_type.
    filter: `${jobNoFilter(PL_JOB_NO_COL, jobNo)} and crfdf_type eq 'Resource'`,
    orderBy: "crfdf_lineno asc",
  });
  return rows.map(rowToPlanningLine);
}

/** Contract value fallback when crfdf_bccostandsales has no row yet:
 *  sum the job's Billable planning lines (crfdf_linetype = 'Billable',
 *  crfdf_totalprice = BC totalPriceLCY). Matches how BC expresses the
 *  invoice schedule (e.g. "DOWN PAYMENTS" + "FINAL PAYMENT" G/L lines). */
async function contractFromBillableLines(jobNo: string): Promise<number> {
  const reader = getDataverseReader();
  const rows = await reader.retrieveMultiple(T_PLANNING_LINE, {
    filter: `${jobNoFilter(PL_JOB_NO_COL, jobNo)} and crfdf_linetype eq 'Billable'`,
  });
  return rows.reduce((sum, row) => sum + num(row, "crfdf_totalprice", "totalPriceLCY"), 0);
}

async function loadCostAndSales(
  jobNo: string,
): Promise<{ contractValue: number; invoicedAmount: number; remainingToInvoice: number }> {
  const reader = getDataverseReader();
  const rows = await reader.retrieveMultiple(T_COST_SALES, {
    filter: jobNoFilter(PL_JOB_NO_COL, jobNo),
    top: 1,
  });
  const row = rows[0];
  if (!row) {
    // No jobCostAndSales mirror row yet (Sign365 sync pending) — derive
    // contract value from Billable planning lines; invoiced is unknown,
    // so remaining = contract. Good enough for scheduling decisions.
    const contractValue = await contractFromBillableLines(jobNo);
    return { contractValue, invoicedAmount: 0, remainingToInvoice: contractValue };
  }

  const contractValue = num(
    row,
    "crfdf_contractvalue",
    "crfdf_totalsalesprice",
    "contractValue",
    "totalPrice",
  );
  const invoicedAmount = num(
    row,
    "crfdf_invoicedamount",
    "crfdf_billedamount",
    "invoicedAmount",
    "billedAmount",
  );
  // Prefer an explicit remaining column if the sync flow computes one;
  // otherwise derive it. Clamp at 0 so credit memos don't show negative.
  const explicit = num(row, "crfdf_remainingtoinvoice", "remainingToInvoice");
  const remainingToInvoice =
    explicit > 0 ? explicit : Math.max(0, contractValue - invoicedAmount);
  return { contractValue, invoicedAmount, remainingToInvoice };
}

async function loadTrips(jobNo: string): Promise<BcTrip[]> {
  const reader = getDataverseReader();
  const rows = await reader.retrieveMultiple(T_TRIP_RESOURCE, {
    filter: jobNoFilter(PL_JOB_NO_COL, jobNo),
    orderBy: "crfdf_tripno asc",
  });

  // One mirror row per (trip, resource). Group by trip; classify each
  // resource. Three cases (verified against Production resources):
  //   - crew placeholders "WK 2 MAN - TBD" / "NEK 1 MAN" → men += N
  //     (the man-count is encoded in the resource code)
  //   - trucks/machines: crfdf_resourcetype "Machine", or fleet codes
  //     (F##, D##, Chevy, crane, bucket)
  //   - everything else: one person (1000-band employee resources)
  const byTrip = new Map<string, { men: number; trucks: number; date: Date | null }>();
  for (const row of rows) {
    const tripNo = str(row, "crfdf_tripno", "tripNo") || "1";
    const bucket = byTrip.get(tripNo) ?? { men: 0, trucks: 0, date: null };
    const resType = str(row, "crfdf_resourcetype", "resourceType").toLowerCase();
    const resNo = str(row, "crfdf_resourceno", "resourceNo");
    const placeholderMen = menFromResourceNo(resNo);
    if (placeholderMen !== null) {
      bucket.men += placeholderMen;
    } else {
      const isTruck =
        resType === "machine" ||
        resType === "truck" ||
        /^(f|d)\d+$|chevy|crane|bucket/i.test(resNo);
      if (isTruck) bucket.trucks += 1;
      else bucket.men += 1;
    }
    bucket.date = bucket.date ?? dateOrNull(row, "crfdf_tripdate", "tripDate");
    byTrip.set(tripNo, bucket);
  }

  return [...byTrip.entries()].map(([tripNo, b]) => ({
    tripNo,
    men: b.men,
    trucks: b.trucks,
    date: b.date,
  }));
}

async function hydrateJob(headerRow: DataverseRow): Promise<BcJob> {
  const header = rowToJobHeader(headerRow);
  const [planningLines, costSales, trips] = await Promise.all([
    loadPlanningLines(header.jobNo),
    loadCostAndSales(header.jobNo),
    loadTrips(header.jobNo),
  ]);
  return { ...header, planningLines, trips, ...costSales };
}

export const bcService = {
  /**
   * Search by job number ("J35899" / "35899") or ship-to customer name.
   * Number-shaped queries try exact match then startswith; anything else
   * falls through to a name contains() across ship-to + bill-to.
   */
  async searchJob(query: string): Promise<BcJob[]> {
    const reader = getDataverseReader();
    const trimmed = query.trim();
    if (!trimmed) return [];

    const looksLikeJobNo = /^j?\d+$/i.test(trimmed.replace(/\s+/g, ""));
    let headers: DataverseRow[] = [];

    if (looksLikeJobNo) {
      // Exact match against BOTH forms (J23743 + 23743), then prefix match.
      headers = await reader.retrieveMultiple(T_JOB, {
        filter: jobNoFilter(JOB_NO_COL, trimmed),
        top: 5,
      });
      if (headers.length === 0) {
        const variants = jobNoVariants(trimmed);
        headers = await reader.retrieveMultiple(T_JOB, {
          filter: variants
            .map((v) => `startswith(${JOB_NO_COL}, '${escapeOData(v)}')`)
            .join(" or "),
          top: 8,
        });
      }
    } else {
      // Name search — against crfdf_customername (the name or code the
      // Jobs flow wrote) and the description.
      const nameQuery = escapeOData(trimmed);
      headers = await reader.retrieveMultiple(T_JOB, {
        filter: `contains(crfdf_customername, '${nameQuery}') or contains(crfdf_description, '${nameQuery}')`,
        top: 8,
      });
    }

    return Promise.all(headers.map(hydrateJob));
  },

  async getJob(jobNo: string): Promise<BcJob | null> {
    const reader = getDataverseReader();
    const rows = await reader.retrieveMultiple(T_JOB, {
      filter: jobNoFilter(JOB_NO_COL, normalizeJobNo(jobNo)),
      top: 1,
    });
    if (rows.length === 0) return null;
    return hydrateJob(rows[0]);
  },
};

export type BcService = typeof bcService;
