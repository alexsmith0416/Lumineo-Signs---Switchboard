/**
 * Job tracking — the Jobs view's data model (pure).
 *
 * Replaces the Airtable "LNI Production Schedule / Expeditor" list. A row is a
 * BC job (crfdf_bcjobs — every open job appears the moment BC opens it) joined
 * with its crfdf_jobtrack row (the Airtable-only fields: holds, expeditor date,
 * vendor, date to admin / invoiced, …) and its crfdf_jobschedule dates (red
 * date, production-complete override). Tracked jobs missing from the BC sync
 * still show, flagged.
 *
 * Phase 1 (Sep 29, 2026) is read-only. Current Status is the manual override,
 * else the hold reason, else the status carried over from Airtable. Phase 2
 * derives it from the lifecycle stepper. See START-HERE → Job Tracking.
 *
 * BC fills what it knows (stage 1): the name (ship-to customer, unless renamed),
 * Sales / Region from the salesperson, Location from the ship-to city + state,
 * Order Date = the release date, Value = the Sales Order amount.
 */
import type { ShipTo } from "./ship-to";
import { regionForSalesperson, salesInitials } from "./sales-pm";
import { daysOnHold } from "./job-status";
import { DEFAULT_LEAD_TIME, jobTargetDates, type LeadTime } from "./lead-times";

/** crfdf_jobtrack, as the app reads it. Dates are "YYYY-MM-DD" (or ""). */
export interface JobTrack {
  /** crfdf_jobtrackid (absent on rows not saved yet). */
  id?: string;
  jobNo: string;
  /** A manual name that overrides the BC ship-to name ("" = use BC's). */
  jobName?: string;
  statusOverride: string;
  priority: string;
  holdReason: string;
  dateToHold: string;
  dateOffHold: string;
  /** Days on hold from earlier, finished holds (see job-status holdTransition). */
  priorHoldDays?: number;
  orderDate: string;
  mfgFinalDate: string;
  expeditorDate: string;
  dateInstalled: string;
  dateToAdmin: string;
  dateInvoiced: string;
  vendor: string;
  poNumber: string;
  vendorStatus: string;
  storageLocation: string;
  vendorShipDate: string;
  vendorShipDate2: string;
  outsourcedArrival: string;
  graphics: string;
  routingType: string;
  powerlines: string;
  sales: string;
  /** Sales initials set in the app ("VB, NH") — wins over BC's salesperson; never written to BC. */
  salesOverride?: string;
  location: string;
  region: string;
  mfgRegion: string;
  installRegion: string;
  ulSign: boolean;
  notes: string;
  legacyStatus: string;
  legacyProcess: string;
  /** Custom field values, keyed by field key (services/custom-fields.ts). */
  customValues?: Record<string, unknown>;
}

/** A tracking row with nothing filled in yet. */
export function emptyJobTrack(jobNo: string): JobTrack {
  return {
    jobNo, jobName: "", priorHoldDays: 0, statusOverride: "", priority: "", holdReason: "", dateToHold: "", dateOffHold: "",
    orderDate: "", mfgFinalDate: "", expeditorDate: "", dateInstalled: "", dateToAdmin: "", dateInvoiced: "",
    vendor: "", poNumber: "", vendorStatus: "", storageLocation: "", vendorShipDate: "", vendorShipDate2: "",
    outsourcedArrival: "", graphics: "", routingType: "", powerlines: "", sales: "", salesOverride: "", location: "", region: "",
    mfgRegion: "", installRegion: "", ulSign: false, notes: "", legacyStatus: "", legacyProcess: "",
  };
}

/** The BC side of a job (crfdf_bcjobs). */
export interface BcJobSummary {
  jobNo: string;
  name: string;
  description: string;
  remaining: number;
  city: string;
  /** Ship-to state ("KS"). */
  state?: string;
  /** Ship-to street address ("123 Main St"). */
  address?: string;
  /** Ship-to ZIP. */
  zip?: string;
  /** BC salesperson code ("NHASKELL"). */
  salesperson: string;
  /** The customer folder in the job's SharePoint URL — the name fallback for
   *  jobs BC synced with no customer name. */
  folderName?: string;
  /** The job's SharePoint folder (crfdf_sharepointurl), "" when BC has none. */
  sharepointUrl?: string;
  /** The Sales Order amount (excl. tax), null until the sync has it. */
  orderAmount?: number | null;
  /** BC's order-release date ("YYYY-MM-DD" or ""). */
  releaseDate?: string;
}

/** The crfdf_jobschedule dates the Jobs view shows ("YYYY-MM-DD" or ""). */
export interface JobScheduleDates {
  redDate: string;
  productionCompleteDate: string;
  releasedDate?: string;
  scheduledInstallDate?: string;
}

export type StatusSource = "override" | "hold" | "airtable" | "untracked";

/** One Jobs-view row. Field keys follow the Airtable app's so its views port. */
export interface JobRow {
  id: string;
  jobNo: string;
  name: string;
  /** The name the job gets when it isn't renamed (BC's ship-to customer). */
  defaultName: string;
  /** The job's SharePoint folder, "" when BC has none. */
  sharepointUrl: string;
  /** The sketch's file name ("" = none) — filled in by the Jobs view from the sketch store. */
  sketch?: string;
  /** "J39571 McPherson CVB" — the primary column. */
  job: string;
  status: string;
  statusSource: StatusSource;
  tracked: boolean;
  inBc: boolean;
  description: string;
  sales: string;
  /** BC salesperson code ("NHASKELL"), "" when BC has none. */
  salespersonCode: string;
  location: string;
  /** Full BC ship-to address (street, city, state, ZIP). */
  shipTo: ShipTo;
  region: string;
  priority: string;
  orderDate: string;
  /** Mfg Modified when set and different from Mfg Target, else Mfg Target. */
  mfgFinalDate: string;
  /** Release + the job's production lead time. */
  mfgTarget: string;
  /** Mfg Modified: the in-app production override, else the Airtable Mfg Final date. */
  mfgTargetMod: string;
  /** Release + the job's install lead time. */
  installTarget: string;
  /** The lead-time rule that set the targets ("" = the 7 / 10 week default). */
  leadRule: string;
  redDate: string;
  releaseDate: string;
  scheduledInstall: string;
  notes: string;
  powerlines: string;
  holdReason: string;
  dateToHold: string;
  dateOffHold: string;
  expeditor: string;
  dateInstalled: string;
  dateToAdmin: string;
  dateInvoiced: string;
  vendor: string;
  po: string;
  vendorStatus: string;
  storageLocation: string;
  vendorShipDate: string;
  vendorShipDate2: string;
  outsourcedArrival: string;
  graphics: string;
  routingType: string;
  ulSign: boolean;
  process: string;
  mfgRegion: string;
  installRegion: string;
  /** Total job value: the Sales Order amount. */
  value: number | null;
  /** What's left to bill: BC's remaining balance. */
  remaining: number | null;
  /** Days in process: days since the release (Order Date). */
  dip: number | null;
  /** Days on hold (all holds). */
  doh: number;
  /** DIP minus DOH. */
  actualDip: number | null;
}

const DAY = 86_400_000;

const dayOf = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Days in process (DIP): whole days from the order date (= the release date)
 * to today. Null without one. Never negative. Actual DIP subtracts the days on
 * hold (job-status `daysOnHold`).
 */
export function daysInProcess(orderDate: string, today: Date): number | null {
  const opened = dayOf(orderDate);
  if (!opened) return null;
  return Math.max(0, Math.round((startOfDay(today).getTime() - opened.getTime()) / DAY));
}

/** Current Status (Phase 1): override → hold → Airtable carry-over. */
export function currentStatus(t: JobTrack | undefined): { status: string; source: StatusSource } {
  if (!t) return { status: "Not tracked yet", source: "untracked" };
  if (t.statusOverride) return { status: t.statusOverride, source: "override" };
  if (t.holdReason && !t.dateOffHold) return { status: t.holdReason, source: "hold" };
  // Merged Airtable rows carry "A | B" — the first is the lead order's status.
  const legacy = t.legacyStatus.split("|")[0]?.trim() ?? "";
  return { status: legacy || "—", source: "airtable" };
}

/** A BC name that is really just the job number (or blank) isn't a name. */
const realName = (s: string | undefined, jobNo: string): string => {
  const v = (s ?? "").trim();
  return v && v.toUpperCase() !== jobNo.toUpperCase() ? v : "";
};

/** The job's default name: BC's ship-to customer name, else the customer
 *  folder from its SharePoint link. "" when BC has neither. */
export function defaultJobName(bc: BcJobSummary | undefined): string {
  if (!bc) return "";
  return realName(bc.name, bc.jobNo) || realName(bc.folderName, bc.jobNo);
}

/** The customer folder in a job's SharePoint link:
 *  ".../Shared Documents/S/Shelter Insurance - Josh Alexander/..." → that name. */
export function sharePointCustomer(url: string): string {
  const m = /Shared(?:%20| )Documents\/[^/]+\/([^/]+)\//i.exec(url);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]!).trim();
  } catch {
    return m[1]!.trim();
  }
}

/** "Wichita, KS" from BC's ship-to city + state. */
export function shipToLocation(bc: Pick<BcJobSummary, "city" | "state"> | undefined): string {
  if (!bc) return "";
  return [bc.city.trim(), (bc.state ?? "").trim().toUpperCase()].filter(Boolean).join(", ");
}

/** Join BC jobs, tracking rows and schedule dates into Jobs-view rows. */
export function buildJobRows(
  bcJobs: readonly BcJobSummary[],
  tracks: readonly JobTrack[],
  schedules: ReadonlyMap<string, JobScheduleDates>,
  today: Date,
  /** Invoice amounts typed on the job's calendar cards — the calendar's $
   *  fallback when BC's remaining balance is empty. */
  invoiceByJob: ReadonlyMap<string, number> = new Map(),
  /** A job's lead time (lead-times.ts `leadTimeFor` over its stepper steps). */
  leadFor: (jobNo: string) => LeadTime & { rule?: { name: string } | null } = () => DEFAULT_LEAD_TIME,
): JobRow[] {
  const bcBy = new Map(bcJobs.map((j) => [j.jobNo, j]));
  const trackBy = new Map(tracks.map((t) => [t.jobNo, t]));
  const jobNos = [...new Set([...bcBy.keys(), ...trackBy.keys()])];
  return jobNos.map((jobNo) => {
    const bc = bcBy.get(jobNo);
    const t = trackBy.get(jobNo);
    const sch = schedules.get(jobNo);
    const { status, source } = currentStatus(t);
    const defaultName = defaultJobName(bc);
    const name = t?.jobName?.trim() || defaultName;
    // Release: the in-app override, else BC's. Order Date = the release date;
    // the Airtable date until there is one.
    const releaseDate = sch?.releasedDate || bc?.releaseDate || "";
    const orderDate = releaseDate || t?.orderDate || "";
    // The Airtable Mfg Final dates were firm dates, so they stand as the
    // "modified" date until the in-app override replaces them.
    const mfgModified = sch?.productionCompleteDate || t?.mfgFinalDate || "";
    const lead = leadFor(jobNo);
    const targets = jobTargetDates({ release: releaseDate, lead, mfgModified });
    const code = bc?.salesperson ?? "";
    const dip = daysInProcess(orderDate, today);
    const doh = t ? daysOnHold({ dateToHold: t.dateToHold, dateOffHold: t.dateOffHold, priorHoldDays: t.priorHoldDays ?? 0 }, today) : 0;
    return {
      id: jobNo,
      jobNo,
      name,
      defaultName,
      sharepointUrl: bc?.sharepointUrl ?? "",
      job: name ? `${jobNo} ${name}` : jobNo,
      status,
      statusSource: source,
      tracked: !!t,
      inBc: !!bc,
      description: bc?.description ?? "",
      // An edit made in the app wins; else BC's salesperson; else the Airtable value.
      sales: t?.salesOverride?.trim() || salesInitials(code) || t?.sales || "",
      salespersonCode: code,
      location: shipToLocation(bc) || t?.location || "",
      shipTo: { address: bc?.address ?? "", city: bc?.city ?? "", state: bc?.state ?? "", zip: bc?.zip ?? "" },
      region: code ? regionForSalesperson(code) : t?.region || "WK",
      priority: t?.priority ?? "",
      orderDate,
      mfgFinalDate: targets.mfgFinal || mfgModified,
      mfgTarget: targets.mfgTarget,
      mfgTargetMod: mfgModified,
      installTarget: targets.installTarget,
      leadRule: lead.rule?.name ?? "",
      redDate: sch?.redDate ?? "",
      releaseDate,
      scheduledInstall: sch?.scheduledInstallDate ?? "",
      notes: t?.notes ?? "",
      powerlines: t?.powerlines ?? "",
      holdReason: t?.holdReason ?? "",
      dateToHold: t?.dateToHold ?? "",
      dateOffHold: t?.dateOffHold ?? "",
      expeditor: t?.expeditorDate ?? "",
      dateInstalled: t?.dateInstalled ?? "",
      dateToAdmin: t?.dateToAdmin ?? "",
      dateInvoiced: t?.dateInvoiced ?? "",
      vendor: t?.vendor ?? "",
      po: t?.poNumber ?? "",
      vendorStatus: t?.vendorStatus ?? "",
      storageLocation: t?.storageLocation ?? "",
      vendorShipDate: t?.vendorShipDate ?? "",
      vendorShipDate2: t?.vendorShipDate2 ?? "",
      outsourcedArrival: t?.outsourcedArrival ?? "",
      graphics: t?.graphics ?? "",
      routingType: t?.routingType ?? "",
      ulSign: t?.ulSign ?? false,
      process: t?.legacyProcess ?? "",
      mfgRegion: t?.mfgRegion ?? "",
      installRegion: t?.installRegion ?? "",
      // The Sales Order amount, else the invoice amount typed on the job's cards.
      value: bc?.orderAmount || invoiceByJob.get(jobNo) || null,
      remaining: bc ? bc.remaining : null,
      dip,
      doh,
      actualDip: dip == null ? null : Math.max(0, dip - doh),
    };
  });
}
