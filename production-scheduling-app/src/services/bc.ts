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

export interface BcPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
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

function normalizeJobNo(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, "").toUpperCase();
  if (trimmed.startsWith("J")) return trimmed;
  return `J${trimmed}`;
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

type BcJobHeader = Omit<
  BcJob,
  "planningLines" | "trips" | "contractValue" | "invoicedAmount" | "remainingToInvoice"
>;

function rowToJobHeader(row: DataverseRow): BcJobHeader {
  const shipToName = str(row, "crfdf_shiptoname", "crfdf_shiptocustomername", "shipToName");
  const billToName = str(row, "crfdf_billtoname", "crfdf_customername", "billToName", "customerName");
  return {
    jobNo: str(row, "crfdf_jobno", "crfdf_no", "no", "jobNo"),
    // Ship-to customer is THE display name; fall back to bill-to when the
    // job ships to the billing customer (BC leaves ship-to blank then).
    customerName: shipToName || billToName,
    billToCustomerName: billToName,
    promisedDate:
      dateOrNull(row, "crfdf_promiseddate", "crfdf_endingdate", "promisedDate")?.toISOString() ??
      new Date().toISOString(),
    shipToAddress: str(row, "crfdf_shiptoaddress", "shipToAddress"),
    shipToCity: str(row, "crfdf_shiptocity", "shipToCity"),
    shipToState: str(row, "crfdf_shiptostate", "crfdf_shiptocounty", "shipToState"),
    shipToZip: str(row, "crfdf_shiptozip", "crfdf_shiptopostcode", "shipToPostCode", "shipToZip"),
  };
}

function rowToPlanningLine(row: DataverseRow): BcPlanningLine {
  return {
    lineNo: num(row, "crfdf_lineno", "lineNo"),
    description: str(row, "crfdf_description", "description"),
    estimatedHours: num(row, "crfdf_quantity", "crfdf_estimatedhours", "quantity"),
  };
}

async function loadPlanningLines(jobNo: string): Promise<BcPlanningLine[]> {
  const reader = getDataverseReader();
  const rows = await reader.retrieveMultiple(T_PLANNING_LINE, {
    // Resource lines only — Item / Cost / Text lines are not schedulable
    // labor. Matches the Canvas app's galPlanningLines filter and the
    // option-set value the sync flow writes.
    filter: `crfdf_jobno eq '${escapeOData(jobNo)}' and crfdf_type eq 'Resource'`,
    orderBy: "crfdf_lineno asc",
  });
  return rows.map(rowToPlanningLine);
}

async function loadCostAndSales(
  jobNo: string,
): Promise<{ contractValue: number; invoicedAmount: number; remainingToInvoice: number }> {
  const reader = getDataverseReader();
  const rows = await reader.retrieveMultiple(T_COST_SALES, {
    filter: `crfdf_jobno eq '${escapeOData(jobNo)}'`,
    top: 1,
  });
  const row = rows[0];
  if (!row) return { contractValue: 0, invoicedAmount: 0, remainingToInvoice: 0 };

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
    filter: `crfdf_jobno eq '${escapeOData(jobNo)}'`,
    orderBy: "crfdf_tripno asc",
  });

  // One mirror row per (trip, resource). Group by trip; classify each
  // resource as man vs truck. The sync flow stores the BC resource type in
  // crfdf_resourcetype ("Person" | "Machine"); the resource-no prefix is
  // the fallback (Lumineo fleet codes: F##, D##, Chevy, crane, bucket).
  const byTrip = new Map<string, { men: number; trucks: number; date: Date | null }>();
  for (const row of rows) {
    const tripNo = str(row, "crfdf_tripno", "tripNo") || "1";
    const bucket = byTrip.get(tripNo) ?? { men: 0, trucks: 0, date: null };
    const resType = str(row, "crfdf_resourcetype", "resourceType").toLowerCase();
    const resNo = str(row, "crfdf_resourceno", "resourceNo");
    const isTruck =
      resType === "machine" ||
      resType === "truck" ||
      /^(f|d)\d+$|chevy|crane|bucket/i.test(resNo);
    if (isTruck) bucket.trucks += 1;
    else bucket.men += 1;
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
      const jobNo = normalizeJobNo(trimmed);
      headers = await reader.retrieveMultiple(T_JOB, {
        filter: `crfdf_jobno eq '${escapeOData(jobNo)}'`,
        top: 5,
      });
      if (headers.length === 0) {
        headers = await reader.retrieveMultiple(T_JOB, {
          filter: `startswith(crfdf_jobno, '${escapeOData(jobNo)}')`,
          top: 8,
        });
      }
    } else {
      const nameQuery = escapeOData(trimmed);
      headers = await reader.retrieveMultiple(T_JOB, {
        filter: `contains(crfdf_shiptoname, '${nameQuery}') or contains(crfdf_billtoname, '${nameQuery}')`,
        top: 8,
      });
    }

    return Promise.all(headers.map(hydrateJob));
  },

  async getJob(jobNo: string): Promise<BcJob | null> {
    const reader = getDataverseReader();
    const rows = await reader.retrieveMultiple(T_JOB, {
      filter: `crfdf_jobno eq '${escapeOData(normalizeJobNo(jobNo))}'`,
      top: 1,
    });
    if (rows.length === 0) return null;
    return hydrateJob(rows[0]);
  },
};

export type BcService = typeof bcService;
