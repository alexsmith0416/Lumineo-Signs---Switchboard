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
 */

/** crfdf_jobtrack, as the app reads it. Dates are "YYYY-MM-DD" (or ""). */
export interface JobTrack {
  jobNo: string;
  statusOverride: string;
  priority: string;
  holdReason: string;
  dateToHold: string;
  dateOffHold: string;
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
  location: string;
  region: string;
  mfgRegion: string;
  installRegion: string;
  ulSign: boolean;
  notes: string;
  legacyStatus: string;
  legacyProcess: string;
}

/** The BC side of a job (crfdf_bcjobs). */
export interface BcJobSummary {
  jobNo: string;
  name: string;
  description: string;
  remaining: number;
  city: string;
  salesperson: string;
}

/** The crfdf_jobschedule dates the Jobs view shows ("YYYY-MM-DD" or ""). */
export interface JobScheduleDates {
  redDate: string;
  productionCompleteDate: string;
}

export type StatusSource = "override" | "hold" | "airtable" | "untracked";

/** One Jobs-view row. Field keys follow the Airtable app's so its views port. */
export interface JobRow {
  id: string;
  jobNo: string;
  name: string;
  /** "J39571 McPherson CVB" — the primary column. */
  job: string;
  status: string;
  statusSource: StatusSource;
  tracked: boolean;
  inBc: boolean;
  description: string;
  sales: string;
  location: string;
  region: string;
  priority: string;
  orderDate: string;
  mfgFinalDate: string;
  mfgTargetMod: string;
  redDate: string;
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
  value: number | null;
  /** Days in process: days since the order, minus days on hold. */
  dip: number | null;
}

const DAY = 86_400_000;

const dayOf = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Days in process (DIP): whole days from the order date to today, minus the
 * days spent on hold (Date to Hold → Date off Hold, or → today while still on
 * hold). Null without an order date. Never negative.
 */
export function daysInProcess(
  t: Pick<JobTrack, "orderDate" | "dateToHold" | "dateOffHold">,
  today: Date,
): number | null {
  const opened = dayOf(t.orderDate);
  if (!opened) return null;
  const now = startOfDay(today);
  let days = Math.round((now.getTime() - opened.getTime()) / DAY);
  const held = dayOf(t.dateToHold);
  if (held) {
    const released = dayOf(t.dateOffHold) ?? now;
    days -= Math.max(0, Math.round((released.getTime() - held.getTime()) / DAY));
  }
  return Math.max(0, days);
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

/** Join BC jobs, tracking rows and schedule dates into Jobs-view rows. */
export function buildJobRows(
  bcJobs: readonly BcJobSummary[],
  tracks: readonly JobTrack[],
  schedules: ReadonlyMap<string, JobScheduleDates>,
  today: Date,
): JobRow[] {
  const bcBy = new Map(bcJobs.map((j) => [j.jobNo, j]));
  const trackBy = new Map(tracks.map((t) => [t.jobNo, t]));
  const jobNos = [...new Set([...bcBy.keys(), ...trackBy.keys()])];
  return jobNos.map((jobNo) => {
    const bc = bcBy.get(jobNo);
    const t = trackBy.get(jobNo);
    const sch = schedules.get(jobNo);
    const { status, source } = currentStatus(t);
    const name = bc?.name || "";
    return {
      id: jobNo,
      jobNo,
      name,
      job: name ? `${jobNo} ${name}` : jobNo,
      status,
      statusSource: source,
      tracked: !!t,
      inBc: !!bc,
      description: bc?.description ?? "",
      sales: t?.sales || bc?.salesperson || "",
      location: t?.location || bc?.city || "",
      region: t?.region ?? "",
      priority: t?.priority ?? "",
      orderDate: t?.orderDate ?? "",
      mfgFinalDate: t?.mfgFinalDate ?? "",
      mfgTargetMod: sch?.productionCompleteDate ?? "",
      redDate: sch?.redDate ?? "",
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
      value: bc ? bc.remaining : null,
      dip: t ? daysInProcess(t, today) : null,
    };
  });
}
