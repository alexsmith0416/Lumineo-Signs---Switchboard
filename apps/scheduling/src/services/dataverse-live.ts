/**
 * Live Dataverse data source (Phase 2).
 *
 * Implements the full `ScheduleDataSource` read/write surface against the real
 * deployed tables in Alex Smith's Environment via the generated Power SDK
 * client (`MicrosoftDataverseService`).
 *
 * Tables (real schema):
 *   crfdf_department            → Department
 *   crfdf_employee              → Employee
 *   crfdf_productionscheduleline → ScheduleLine
 *
 * The Power SDK is imported lazily (`getClient()` runs at the generated
 * module's load, and needs the Power Apps runtime), so merely importing THIS
 * module is side-effect-free — the SDK only loads when a method is first
 * called (i.e. under `pac code run`, never in plain dev/build/tests).
 */
import type { ResourceAdminInput, ScheduleDataSource } from "./data-source";
import { isLaneEmployeeId, laneEmployeeId } from "./department-lane";
import { overlapsWindow, scheduleLineWindowFilter } from "./week-window";
import {
  INSTALL_LOCATIONS,
  INSTALL_LOCATION_COLORS,
  REGION_LOCATIONS,
} from "./install-meta";
import {
  cacheAddCard,
  cacheRemoveCard,
  cacheUpdateCard,
  setRegionCards,
  type InstallRegionKey,
} from "./install-cards";
import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";
import type { ShipmentItem, ShipmentLoad, ShipmentStatus } from "../shipping/types";
import type { QueueGroup, QueueItem, QueueKind } from "./job-queue-data";
import type { PresetKind, SavedCardPreset } from "./custom-card-data";
import type { RosterOverride } from "./roster-overrides";
import type { JobSchedule } from "./job-schedule-data";
import { departmentNameForLine, isInstallResource, isProductionResource } from "./planning-line-mapping";
import {
  buildCompletionPush,
  buildSchedulePush,
  pushRowName,
  type BcPlanningPush,
} from "./bc-planning-sync";

// Entity SET names (plural). The real production roster lives in the "1"
// family — crfdf_department1 / crfdf_employee1 — which is what the
// schedule-line lookups (crfdf_employee → crfdf_employee1,
// crfdf_department → crfdf_department1) actually reference.
const SET = {
  departments: "crfdf_department1s",
  employees: "crfdf_employee1s",
  lines: "crfdf_productionschedulelines",
} as const;

const ACCEPT = "application/json";
const PREFER_READ = 'odata.include-annotations="*"';
const PREFER_WRITE = "return=representation";

// New persistence tables (entity-set names).
const SHIP = {
  loads: "crfdf_shipmentloads",
  items: "crfdf_shipmentitems",
  cards: "crfdf_installcards",
} as const;
const STATUS_TO_OPT: Record<ShipmentStatus, number> = { planned: 0, ready: 1, loaded: 2, delivered: 3 };
const OPT_TO_STATUS: ShipmentStatus[] = ["planned", "ready", "loaded", "delivered"];

const uuid = (): string => crypto.randomUUID();

type Row = Record<string, unknown>;

// Roster employee id → BC resource number (crfdf_no), populated as employees
// load. Lets the BC push resolve `assignedTo` from a schedule line's employeeId
// (the outbox enqueue point only has the line, not the Employee object).
const employeeResourceNo = new Map<string, string>();

// Lazy SDK handle — defers getClient() (needs the runtime) to first use, and
// resolves the Dataverse org URL from the app context. The connector's
// ListRecords/CreateRecord/... operations require the organization explicitly
// (otherwise: "Invalid organization URL 'null' provided"), so we use the
// *WithOrganization variants with the org URL from IContext.app.dataverseOrgUrl.
// The env's Dataverse org URL — final fallback if neither the connector's
// GetOrganizations nor the app context surfaces it.
const ORG_FALLBACK = "https://org8fa22efd.crm.dynamics.com";

type Svc = typeof import("../generated").MicrosoftDataverseService;
async function resolveOrg(S: Svc): Promise<string> {
  // 1. The connector's own organization list (portable; one entry per env).
  try {
    const r = await S.GetOrganizations();
    const url = r.success ? r.data?.value?.[0]?.Url : undefined;
    if (url) return url;
  } catch {
    /* fall through */
  }
  // 2. App context (not populated by every host).
  try {
    const { getContext } = await import("@microsoft/power-apps/app");
    const ctx = await getContext();
    if (ctx.app.dataverseOrgUrl) return ctx.app.dataverseOrgUrl;
  } catch {
    /* fall through */
  }
  // 3. Known env org URL.
  return ORG_FALLBACK;
}
// Single in-flight init promise so EVERY caller awaits the SAME service+org
// resolution. (The old code assigned the service before the org URL resolved, so
// a concurrent call — e.g. the burst of reads a resize/reload fires — could grab
// an empty org and fail with "Invalid organization URL provided".)
let _sdkPromise: Promise<{ S: Svc; org: string }> | null = null;
async function sdk(): Promise<{ S: Svc; org: string }> {
  if (!_sdkPromise) {
    _sdkPromise = (async () => {
      const S = (await import("../generated")).MicrosoftDataverseService;
      const org = await resolveOrg(S);
      if (!org) throw new Error("Could not resolve Dataverse organization URL");
      return { S, org };
    })();
  }
  try {
    return await _sdkPromise;
  } catch (e) {
    _sdkPromise = null; // a failed init shouldn't poison every future call
    throw e;
  }
}

const isOrgUrlError = (msg: string) => /organization url/i.test(msg);

// A write is "transient" when a retry is likely to succeed — network blips,
// throttling, gateway errors, a stale org URL. These are exactly the failures
// behind the "my edit didn't take, but it worked when I did it again" reports:
// the store's catch reloads the board (erasing the optimistic edit) instead of
// retrying. Retrying here is the automatic "do it again" so the reload never
// fires for a transient blip.
const isTransientWrite = (msg: string): boolean =>
  isOrgUrlError(msg) ||
  /\b(429|500|502|503|504)\b|timeout|timed out|network|socket|ECONN|ETIMEDOUT|fetch failed|throttl|too many requests|temporarily|unavailable|transient|connection/i.test(
    msg,
  );

interface SdkResult {
  success: boolean;
  error?: { message?: string };
  data?: unknown;
}

/** Run a Dataverse write, retrying transient failures a few times with backoff.
 *  `op` re-acquires sdk() each attempt so an org-URL re-resolve takes effect. */
async function writeWithRetry(op: () => Promise<SdkResult>, attempts = 3): Promise<SdkResult> {
  let res = await op();
  let tries = 1;
  while (!res.success && tries < attempts && isTransientWrite(res.error?.message ?? "")) {
    if (isOrgUrlError(res.error?.message ?? "")) _sdkPromise = null; // force org re-resolve
    await new Promise((r) => setTimeout(r, 150 * tries)); // 150ms, 300ms
    res = await op();
    tries++;
  }
  return res;
}

/** Retrying Dataverse write helpers — use for user-edit writes so a transient
 *  blip doesn't trigger a board reload that erases the edit. */
async function dvUpdate(set: string, id: string, rec: Row): Promise<SdkResult> {
  return writeWithRetry(async () => {
    const { S, org } = await sdk();
    return S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, set, id, rec);
  });
}
async function dvCreate(set: string, rec: Row): Promise<SdkResult> {
  return writeWithRetry(async () => {
    const { S, org } = await sdk();
    return S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, set, rec);
  });
}
async function dvDelete(set: string, id: string): Promise<SdkResult> {
  return writeWithRetry(async () => {
    const { S, org } = await sdk();
    return S.DeleteRecordWithOrganization(org, set, id);
  });
}

// crfdf_spandays (manual visual span) is newer than the schedule-line tables;
// until it's created it must not poison other schedule-line writes.
let scheduleSpanCol = true;
const missingSpanCol = (msg: string) => scheduleSpanCol && /crfdf_spandays/i.test(msg);

async function list(
  entitySet: string,
  opts: { select?: string; filter?: string; orderby?: string } = {},
): Promise<Row[]> {
  const run = async () => {
    const { S, org } = await sdk();
    return S.ListRecordsWithOrganization(
      org, entitySet, PREFER_READ, ACCEPT, false, false, opts.select, opts.filter, opts.orderby,
    );
  };
  let res = await run();
  // Belt-and-suspenders: if a stale/empty org slipped through, re-resolve once.
  if (!res.success && isOrgUrlError(res.error?.message ?? "")) {
    _sdkPromise = null;
    res = await run();
  }
  if (!res.success) throw new Error(res.error?.message ?? `ListRecords(${entitySet}) failed`);
  const data = res.data as { value?: Row[] } | undefined;
  return (data?.value ?? []).map((it) => ((it as { dynamicProperties?: Row }).dynamicProperties ?? it) as Row);
}

const s = (v: unknown, fb = ""): string => (v == null ? fb : String(v));
const n = (v: unknown, fb = 0): number => (v == null || v === "" ? fb : Number(v));
const nOrNull = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
const dt = (v: unknown): Date => new Date(String(v));
const dtOrNull = (v: unknown): Date | null => (v == null || v === "" ? null : new Date(String(v)));
const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

// The schedule-line / install-card tables have no dedicated job-description
// column, so the BC job description is co-stored with the task text in the
// existing description column, separated by a sentinel (U+241E, a symbol char
// that never occurs in BC text). Cards saved before this ran have no sentinel,
// so they decode as { jobDescription: "", planningLineDescription: <whole> }.
const DESC_SEP = "␞";
const encodeDesc = (line: Partial<ScheduleLine>): string => {
  const task = line.planningLineDescription ?? "";
  return line.jobDescription ? `${line.jobDescription}${DESC_SEP}${task}` : task;
};
const decodeDesc = (raw: string): { jobDescription: string; planningLineDescription: string } => {
  const i = raw.indexOf(DESC_SEP);
  return i >= 0
    ? { jobDescription: raw.slice(0, i), planningLineDescription: raw.slice(i + 1) }
    : { jobDescription: "", planningLineDescription: raw };
};

function mapLine(r: Row): ScheduleLine {
  const desc = decodeDesc(s(r.crfdf_planninglinedescription));
  return {
    id: s(r.crfdf_productionschedulelineid),
    jobNo: s(r.crfdf_jobno),
    customerName: s(r.crfdf_customername),
    jobDescription: desc.jobDescription,
    planningLineDescription: desc.planningLineDescription,
    startDateTime: dt(r.crfdf_startdatetime),
    endDateTime: dt(r.crfdf_enddatetime),
    estimatedHours: n(r.crfdf_estimatedhours),
    overrideHours: nOrNull(r.crfdf_overridehours),
    spanDays: nOrNull(r.crfdf_spandays),
    // Team (department-wide) lines store no employee; their runtime resource is
    // the synthetic department lane so the board + engine can key off it.
    employeeId: Boolean(r.crfdf_departmentwide)
      ? laneEmployeeId(s(r["_crfdf_department_value"]))
      : s(r["_crfdf_employee_value"]),
    departmentId: s(r["_crfdf_department_value"]),
    departmentWide: Boolean(r.crfdf_departmentwide) || undefined,
    customerDueDate: dtOrNull(r.crfdf_customerduedate),
    isLocked: Boolean(r.crfdf_islocked),
    jobSequence: n(r.crfdf_jobsequence),
    preferredStart: dtOrNull(r.crfdf_preferredstart),
    invoiceAmount: nOrNull(r.crfdf_invoiceamount),
    crewPersons: nOrNull(r.crfdf_crewpersons),
    crewTrucks: nOrNull(r.crfdf_crewtrucks),
    crewCranes: nOrNull(r.crfdf_crewcranes),
    crewLifts: nOrNull(r.crfdf_crewlifts),
    crewBuckets: nOrNull(r.crfdf_crewbuckets),
    installZip: r.crfdf_installzip == null ? null : s(r.crfdf_installzip),
    region: r.crfdf_region == null ? null : s(r.crfdf_region),
    isCustom: Boolean(r.crfdf_iscustom),
    customColor: r.crfdf_customcolor == null ? null : s(r.crfdf_customcolor),
    customTextColor: r.crfdf_customtextcolor == null ? null : s(r.crfdf_customtextcolor),
  };
}

/** Map a ScheduleLine (or partial) to a Dataverse record payload. */
function toRecord(line: Partial<ScheduleLine>): Row {
  const rec: Row = {};
  if (line.jobNo !== undefined) rec.crfdf_jobno = line.jobNo;
  if (line.customerName !== undefined) rec.crfdf_customername = line.customerName;
  if (line.planningLineDescription !== undefined || line.jobDescription !== undefined)
    rec.crfdf_planninglinedescription = encodeDesc(line);
  if (line.startDateTime !== undefined) rec.crfdf_startdatetime = iso(line.startDateTime);
  if (line.endDateTime !== undefined) rec.crfdf_enddatetime = iso(line.endDateTime);
  if (line.estimatedHours !== undefined) rec.crfdf_estimatedhours = line.estimatedHours;
  if (line.overrideHours !== undefined) rec.crfdf_overridehours = line.overrideHours;
  if (scheduleSpanCol && line.spanDays !== undefined) rec.crfdf_spandays = line.spanDays;
  if (line.customerDueDate !== undefined) rec.crfdf_customerduedate = iso(line.customerDueDate);
  if (line.isLocked !== undefined) rec.crfdf_islocked = line.isLocked;
  if (line.jobSequence !== undefined) rec.crfdf_jobsequence = line.jobSequence;
  if (line.preferredStart !== undefined) rec.crfdf_preferredstart = iso(line.preferredStart);
  if (line.invoiceAmount !== undefined) rec.crfdf_invoiceamount = line.invoiceAmount;
  if (line.crewPersons !== undefined) rec.crfdf_crewpersons = line.crewPersons;
  if (line.crewTrucks !== undefined) rec.crfdf_crewtrucks = line.crewTrucks;
  if (line.crewCranes !== undefined) rec.crfdf_crewcranes = line.crewCranes;
  if (line.crewLifts !== undefined) rec.crfdf_crewlifts = line.crewLifts;
  if (line.crewBuckets !== undefined) rec.crfdf_crewbuckets = line.crewBuckets;
  if (line.installZip !== undefined) rec.crfdf_installzip = line.installZip;
  if (line.region !== undefined) rec.crfdf_region = line.region;
  if (line.isCustom !== undefined) rec.crfdf_iscustom = line.isCustom;
  if (line.customColor !== undefined) rec.crfdf_customcolor = line.customColor;
  if (line.customTextColor !== undefined) rec.crfdf_customtextcolor = line.customTextColor;
  // Team (department-wide) flag. NOTE: requires a Yes/No column
  // `crfdf_departmentwide` on crfdf_productionscheduleline; without it, team
  // jobs won't persist in the deployed app (dev/mock is unaffected).
  if (line.departmentWide !== undefined) rec.crfdf_departmentwide = line.departmentWide;
  // Lookups via @odata.bind. A team line's employeeId is the synthetic lane id
  // (not a real GUID), so never bind it — the line belongs to the department.
  if (line.employeeId && !isLaneEmployeeId(line.employeeId))
    rec["crfdf_Employee@odata.bind"] = `/${SET.employees}(${line.employeeId})`;
  if (line.departmentId) rec["crfdf_Department@odata.bind"] = `/${SET.departments}(${line.departmentId})`;
  return rec;
}

export const liveProductionDataSource: ScheduleDataSource = {
  kind: "production",

  async loadDepartments(): Promise<Department[]> {
    // No $select — selecting a lookup _value alias 400s through the connector,
    // and crfdf_department1 is small. It has no crfdf_floworder/crfdf_color yet,
    // so flow order falls back to name order and color to gray.
    const rows = await list(SET.departments, { orderby: "crfdf_departmentname asc" });
    return rows.map((r, i) => ({
      id: s(r.crfdf_department1id),
      name: s(r.crfdf_departmentname, "Department"),
      flowOrder: r.crfdf_floworder == null ? i + 1 : n(r.crfdf_floworder),
      color: s(r.crfdf_color, "#cccccc"),
    }));
  },

  async loadEmployees(): Promise<Employee[]> {
    // Also load departments to resolve the department-name text when the lookup
    // is unset. No $select (see loadDepartments). crfdf_employee1 has no
    // rate/hours columns yet → engine defaults below.
    const [deptRows, rows] = await Promise.all([
      list(SET.departments, {}),
      list(SET.employees, {}),
    ]);
    const nameToDeptId = new Map(
      deptRows.map((d) => [s(d.crfdf_departmentname).trim().toLowerCase(), s(d.crfdf_department1id)]),
    );
    return rows.map((r) => ({
      id: s(r.crfdf_employee1id),
      name: s(r.crfdf_employeename, "Employee"),
      // Prefer the lookup; fall back to matching the department-name text.
      departmentId:
        s(r["_crfdf_department_value"]) ||
        nameToDeptId.get(s(r.crfdf_departmentname).trim().toLowerCase()) ||
        "",
      productivityRate: n(r.crfdf_productivityrate, 1) || 1,
      standardHoursPerDay: n(r.crfdf_standardhoursperday, 8),
      maxOvertimePerDay: n(r.crfdf_maxovertimeperday, 0),
      worksWeekends: Boolean(r.crfdf_worksweekends),
      hourlyRate: nOrNull(r.crfdf_hourlyrate) ?? undefined,
      bcResourceNo: s(r.crfdf_no) || undefined,
    })).map((e) => {
      // Cache the id → BC resource-no so the outbox enqueue (which only has the
      // schedule line's employeeId) can resolve the BC `assignedTo`.
      if (e.bcResourceNo) employeeResourceNo.set(e.id, e.bcResourceNo);
      return e;
    });
  },

  async loadScheduleLines(from: Date, to: Date): Promise<ScheduleLine[]> {
    // Overlap window, not "starts in this week" — see week-window.ts. A task
    // that runs across a week boundary must load on BOTH weeks' boards.
    const filter = scheduleLineWindowFilter(from, to);
    const rows = await list(SET.lines, { filter, orderby: "crfdf_startdatetime asc" });
    const lines = rows.map(mapLine);
    // Overlay the current ship-to / sales-order customer name + outstanding
    // value from BC so cards reflect BC even for lines created earlier. Falls
    // back to the line's stored values when BC has none for that job.
    const [meta, salesByJob, spByJob] = await Promise.all([
      bcJobMetaByJobNo(),
      salespersonByJobNo(),
      sharepointUrlByJobNo(),
    ]);
    return lines.map((l) => {
      const m = l.jobNo ? meta.get(l.jobNo) : undefined;
      const sales = l.jobNo ? salesByJob.get(l.jobNo) : undefined;
      const sp = l.jobNo ? spByJob.get(l.jobNo) : undefined;
      if (!m && !sales && !sp) return l;
      return {
        ...l,
        ...(m
          ? {
              customerName: m.name || l.customerName,
              remainingValue: m.remaining,
              installZip: l.installZip || m.shipToZip || null,
            }
          : {}),
        ...(sales ? { salespersonCode: sales } : {}),
        ...(sp ? { sharepointUrl: sp } : {}),
      };
    });
  },

  // No Dataverse tables for these yet — empty until crfdf_employeeworkhours /
  // crfdf_overtimeoverride are added.
  async loadWorkHours(): Promise<WorkHoursOverride[]> {
    return [];
  },
  async loadOvertimeOverrides(): Promise<OvertimeOverride[]> {
    return [];
  },

  async updateScheduleLine(id: string, changes: Partial<ScheduleLine>): Promise<ScheduleLine> {
    let res = await dvUpdate(SET.lines, id, toRecord(changes));
    if (!res.success && missingSpanCol(res.error?.message ?? "")) {
      scheduleSpanCol = false; // column not created yet — drop it and retry
      res = await dvUpdate(SET.lines, id, toRecord(changes));
    }
    if (!res.success) throw new Error(res.error?.message ?? `UpdateRecord(${id}) failed`);
    const body = res.data as Row | undefined;
    const line = body && body.crfdf_productionschedulelineid ? mapLine(body) : ({ id, ...changes } as ScheduleLine);
    // Mirror a scheduling change (start/end/assignee) back to the BC planning
    // step. Only when one of those actually changed — not on lock/hours-only
    // edits. Team-lane lines carry no person, so no BC assignee. Fire-and-forget.
    if (changes.startDateTime !== undefined || changes.endDateTime !== undefined || changes.employeeId !== undefined) {
      const assignedTo =
        line.employeeId && !isLaneEmployeeId(line.employeeId) ? employeeResourceNo.get(line.employeeId) ?? "" : "";
      void enqueueBcPush(buildSchedulePush(line, { assignedTo }));
    }
    return line;
  },

  async createScheduleLine(line: ScheduleLine): Promise<ScheduleLine> {
    // No crfdf_name — the primary-name column isn't crfdf_name on this table.
    const rec = toRecord(line);
    const res = await dvCreate(SET.lines, rec);
    if (!res.success) throw new Error(res.error?.message ?? `CreateRecord failed`);
    // CreateRecord returns void; the new id is in the response location header
    // which the generated wrapper doesn't surface — return the input line. A
    // reload (loadWeek) picks up the server id. TODO: capture the created id.
    return line;
  },

  async deleteScheduleLine(id: string): Promise<void> {
    const res = await dvDelete(SET.lines, id);
    if (!res.success) throw new Error(res.error?.message ?? `DeleteRecord(${id}) failed`);
  },

  // --- Roster admin (right-click) on crfdf_employee1 ----------------------
  // Production employees carry a name and a department lookup (crfdf_department
  // → crfdf_department1, same target as the schedule-line lookup, so the same
  // nav property + entity set bind works here).
  async createResource(input: ResourceAdminInput): Promise<void> {
    const { S, org } = await sdk();
    const rec = employeeRecord(input);
    const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SET.employees, rec);
    if (!res.success) throw new Error(res.error?.message ?? `CreateEmployee failed`);
  },
  async updateResource(id: string, input: ResourceAdminInput): Promise<void> {
    const { S, org } = await sdk();
    const res = await S.UpdateRecordWithOrganization(
      PREFER_WRITE, ACCEPT, org, SET.employees, id, employeeRecord(input),
    );
    if (!res.success) throw new Error(res.error?.message ?? `UpdateEmployee(${id}) failed`);
  },
  async deleteResource(id: string): Promise<void> {
    const { S, org } = await sdk();
    const res = await S.DeleteRecordWithOrganization(org, SET.employees, id);
    if (!res.success) throw new Error(res.error?.message ?? `DeleteEmployee(${id}) failed`);
  },
};

/** Map an admin input to a crfdf_employee1 record payload (name + dept lookup +
 *  hours/efficiency). */
function employeeRecord(input: ResourceAdminInput): Row {
  const rec: Row = {};
  if (input.name !== undefined) rec.crfdf_employeename = input.name;
  if (input.departmentId)
    rec["crfdf_Department@odata.bind"] = `/${SET.departments}(${input.departmentId})`;
  if (input.standardHoursPerDay !== undefined)
    rec.crfdf_standardhoursperday = input.standardHoursPerDay;
  if (input.productivityRate !== undefined) rec.crfdf_productivityrate = input.productivityRate;
  return rec;
}

// ---------------------------------------------------------------------------
// Installation roster (crfdf_InstallationEmployees)
// ---------------------------------------------------------------------------
// The install calendar groups crews by physical LOCATION within a REGION:
//   region (Two Option): false = WK, true = NEK
//   location (Picklist): 0 Hutchinson · 1 Wichita · 2 Dodge City  (WK)
//                        3 Olathe · 4 Topeka · 5 Lawrence          (NEK)
//                        6 Additional Jobs                         (both)
// Each location maps to a Department (group band); employees order by their
// zero-padded `crfdf_positiononschedule` string within the group. Job cards are
// not wired yet — loadScheduleLines returns [] (roster live, cards later).
const INSTALL_SET = "crfdf_installationemployeeses";

function mapInstallEmployee(r: Row): Employee {
  const loc = n(r.crfdf_location, 6);
  const truck = s(r.crfdf_truck).trim();
  const isAssistRow = Boolean(s(r.crfdf_assistsourceemp).trim());
  return {
    id: s(r.crfdf_installationemployeesid),
    name: s(r.crfdf_employeename, "Employee"),
    // Group id = location option value (matches the Department ids below).
    departmentId: String(loc),
    productivityRate: 1,
    standardHoursPerDay: 8,
    maxOvertimePerDay: 0,
    worksWeekends: false,
    truckNumber: truck === "" ? null : truck,
    // Assist (lent production) rows are never crane operators on the install
    // board — the CCO badge belongs to real install crew only.
    isCertifiedCraneOperator: isAssistRow ? false : Boolean(r.crfdf_certifiedcraneoperator),
    position: n(r.crfdf_positiononschedule, 0),
    isAssist: isAssistRow,
  };
}

// --- "Assist installation": a production employee lent to an install board ---
// Stored as a crfdf_installationemployees row with crfdf_assistsourceemp set
// (the production employee id). It shows as a crew row on that region's board;
// the production board greys the source employee's assigned days.
/** Which half of an assist day the person is on the install board: a full day,
 *  or just the morning / afternoon (the other half they stay on production). */
export type AssistHalf = "full" | "am" | "pm";

export interface AssistAssignment {
  id: string;
  name: string;
  regionIsNek: boolean;
  sourceEmpId: string;
  weekStart: string; // yyyy-mm-dd
  days: number[]; // weekday indices 0=Mon..4=Fri; [] = all week
  /** Per-partial-day half (am/pm). Days absent here are full days. */
  halves: Record<number, "am" | "pm">;
}

/** Parse "1:am,3:pm" → { 1: "am", 3: "pm" }. Blank/legacy → {}. */
function parseAssistHalves(raw: string): Record<number, "am" | "pm"> {
  const out: Record<number, "am" | "pm"> = {};
  for (const part of raw.split(",")) {
    const [d, h] = part.split(":");
    const di = Number((d ?? "").trim());
    const half = (h ?? "").trim().toLowerCase();
    if (!Number.isNaN(di) && (half === "am" || half === "pm")) out[di] = half;
  }
  return out;
}

export async function fetchAssistRows(): Promise<AssistAssignment[]> {
  const rows = await list(INSTALL_SET, {}).catch(() => [] as Row[]);
  return rows
    .filter((r) => s(r.crfdf_assistsourceemp).trim())
    .map((r) => ({
      id: s(r.crfdf_installationemployeesid),
      name: s(r.crfdf_employeename),
      regionIsNek: Boolean(r.crfdf_region),
      sourceEmpId: s(r.crfdf_assistsourceemp).trim(),
      weekStart: s(r.crfdf_assistweekstart).slice(0, 10),
      // Empty (all week) must stay []; "".split(",") is [""] which Number()s to
      // 0, so guard the empty case before splitting.
      days: s(r.crfdf_assistdays).trim()
        ? s(r.crfdf_assistdays)
            .split(",")
            .map((x) => Number(x.trim()))
            .filter((x) => !Number.isNaN(x))
        : [],
      halves: s(r.crfdf_assisthalves).trim() ? parseAssistHalves(s(r.crfdf_assisthalves)) : {},
    }));
}

export async function createAssistRow(input: {
  sourceEmpId: string;
  name: string;
  regionIsNek: boolean;
  weekStart: string;
  days: number[];
  halves?: Record<number, "am" | "pm">;
}): Promise<void> {
  const { S, org } = await sdk();
  const rec: Row = {
    crfdf_employeename: input.name,
    crfdf_region: input.regionIsNek,
    // Bottom of the region's primary location group (Hutchinson for WK, Olathe
    // for NEK) — position 9999 sorts them last within it.
    crfdf_location: (input.regionIsNek ? REGION_LOCATIONS.nek : REGION_LOCATIONS.wk)[0],
    crfdf_positiononschedule: "9999",
    crfdf_assistsourceemp: input.sourceEmpId,
    crfdf_assistweekstart: input.weekStart,
    crfdf_assistdays: input.days.join(","),
  };
  // Only send the newer half-day column when there's an AM/PM to record, so a
  // whole-day assist still saves even if crfdf_assisthalves isn't provisioned.
  const halfEntries = Object.entries(input.halves ?? {});
  if (halfEntries.length > 0) {
    rec.crfdf_assisthalves = halfEntries.map(([d, h]) => `${d}:${h}`).join(",");
  }
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, INSTALL_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createAssistRow failed");
}

/** Edit an existing assist's days/halves (e.g. drop one day) without recreating
 *  it. Callers delete the row instead when no days remain. */
export async function updateAssistRow(
  id: string,
  input: { days: number[]; halves?: Record<number, "am" | "pm"> },
): Promise<void> {
  const { S, org } = await sdk();
  const halfEntries = Object.entries(input.halves ?? {});
  const withHalves: Row = {
    crfdf_assistdays: input.days.join(","),
    // Explicitly clear the half column when no half days remain.
    crfdf_assisthalves: halfEntries.map(([d, h]) => `${d}:${h}`).join(","),
  };
  let res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, INSTALL_SET, id, withHalves);
  if (!res.success) {
    // Older orgs may not have crfdf_assisthalves provisioned — retry days only.
    res = await S.UpdateRecordWithOrganization(
      PREFER_WRITE, ACCEPT, org, INSTALL_SET, id, { crfdf_assistdays: input.days.join(",") },
    );
  }
  if (!res.success) throw new Error(res.error?.message ?? `updateAssistRow(${id}) failed`);
}

export async function removeAssistRow(id: string): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.DeleteRecordWithOrganization(org, INSTALL_SET, id);
  if (!res.success) throw new Error(res.error?.message ?? "removeAssistRow failed");
}

function createLiveInstallDataSource(
  isNek: boolean,
  locations: number[],
): ScheduleDataSource {
  const region: InstallRegionKey = isNek ? "nek" : "wk";
  return {
    kind: "installation",

    async loadDepartments(): Promise<Department[]> {
      return locations.map((v) => ({
        id: String(v),
        name: INSTALL_LOCATIONS[v] ?? `Location ${v}`,
        flowOrder: v,
        color: INSTALL_LOCATION_COLORS[v] ?? "#cccccc",
      }));
    },

    async loadEmployees(): Promise<Employee[]> {
      // Fetch all rows and split by region client-side — the table is tiny
      // (~two dozen rows) and this sidesteps any connector $filter quirks on a
      // Two Option column.
      const rows = await list(INSTALL_SET, {});
      return rows
        .filter((r) => Boolean(r.crfdf_region) === isNek)
        .map(mapInstallEmployee);
    },

    // Cards (custom blocks + placed shipment cards) persist to crfdf_installcard.
    // We load ALL of this region's cards into the reactive cache (so the
    // Shipping "Scheduled" badge is accurate) and return the week's subset.
    async loadScheduleLines(from: Date, to: Date): Promise<ScheduleLine[]> {
      const rows = await list(SHIP.cards, { filter: `crfdf_region eq ${isNek}` });
      const [meta, salesByJob, spByJob] = await Promise.all([
        bcJobMetaByJobNo(),
        salespersonByJobNo(),
        sharepointUrlByJobNo(),
      ]);
      const mapped = rows.map(mapCardRecord);
      // Auto-fill crew (trips/men/trucks) from BC planning lines for any card
      // that has no manually-entered crew. One planning-line read per distinct
      // job on the board that needs it; manual entry (crfdf_crew*) still wins.
      const needCrew = [
        ...new Set(mapped.filter((l) => l.jobNo && !hasManualCrew(l)).map((l) => l.jobNo)),
      ];
      const crewByJob = new Map<string, BcJobCrew>();
      await Promise.all(
        needCrew.map(async (jn) => {
          const c = deriveCrewFromLines(await planningLinesFor(jn));
          if (c) crewByJob.set(jn, c);
        }),
      );
      const all = mapped.map((l) => {
        const m = l.jobNo ? meta.get(l.jobNo) : undefined;
        const sales = l.jobNo ? salesByJob.get(l.jobNo) : undefined;
        const sp = l.jobNo ? spByJob.get(l.jobNo) : undefined;
        const c = l.jobNo && !hasManualCrew(l) ? crewByJob.get(l.jobNo) : undefined;
        if (!m && !c && !sales && !sp) return l;
        return {
          ...l,
          ...(m
            ? {
                customerName: m.name || l.customerName,
                remainingValue: m.remaining,
                installZip: l.installZip || m.shipToZip || null,
              }
            : {}),
          ...(sales ? { salespersonCode: sales } : {}),
          ...(sp ? { sharepointUrl: sp } : {}),
          ...(c
            ? { crewTrips: c.crewTrips, crewPersons: c.crewPersons, crewTrucks: c.crewTrucks }
            : {}),
        };
      });
      setRegionCards(region, all);
      // Overlap window (see week-window.ts): a card that starts before this week
      // but runs into it still belongs on the board.
      return all.filter((l) => overlapsWindow(l, from, to));
    },
    async loadWorkHours(): Promise<WorkHoursOverride[]> {
      return [];
    },
    async loadOvertimeOverrides(): Promise<OvertimeOverride[]> {
      return [];
    },

    async updateScheduleLine(id: string, changes: Partial<ScheduleLine>): Promise<ScheduleLine> {
      let res = await dvUpdate(SHIP.cards, id, cardToRecord(changes, isNek, false));
      if (!res.success && (installExtraColsAvailable || missingSpanCol(res.error?.message ?? ""))) {
        // Newer columns may be missing — drop them and retry so the edit sticks.
        installExtraColsAvailable = false;
        if (missingSpanCol(res.error?.message ?? "")) scheduleSpanCol = false;
        res = await dvUpdate(SHIP.cards, id, cardToRecord(changes, isNek, false));
      }
      if (!res.success) throw new Error(res.error?.message ?? `UpdateInstallCard(${id}) failed`);
      const body = res.data as Row | undefined;
      const line = body?.crfdf_installcardid ? mapCardRecord(body) : ({ id, ...changes } as ScheduleLine);
      cacheUpdateCard(region, id, line);
      // Mirror an install-step scheduling change back to BC (same outbox as
      // production). Only on a start/end/assignee change; fire-and-forget.
      if (changes.startDateTime !== undefined || changes.endDateTime !== undefined || changes.employeeId !== undefined) {
        const assignedTo =
          line.employeeId && !isLaneEmployeeId(line.employeeId) ? employeeResourceNo.get(line.employeeId) ?? "" : "";
        void enqueueBcPush(buildSchedulePush(line, { assignedTo }));
      }
      return line;
    },
    async createScheduleLine(line: ScheduleLine): Promise<ScheduleLine> {
      const id = uuid();
      const rec = { crfdf_installcardid: id, ...cardToRecord(line, isNek, true) };
      let res = await dvCreate(SHIP.cards, rec);
      if (!res.success && installExtraColsAvailable) {
        // Newer columns may be missing — drop them and retry so the card saves.
        installExtraColsAvailable = false;
        res = await dvCreate(SHIP.cards, rec);
      }
      if (!res.success) throw new Error(res.error?.message ?? "CreateInstallCard failed");
      const created = { ...line, id };
      cacheAddCard(region, created);
      return created;
    },
    async deleteScheduleLine(id: string): Promise<void> {
      const res = await dvDelete(SHIP.cards, id);
      if (!res.success) throw new Error(res.error?.message ?? `DeleteInstallCard(${id}) failed`);
      cacheRemoveCard(region, id);
    },

    // Roster admin (right-click): create / edit / delete a crew row on
    // crfdf_InstallationEmployees. Region/location are scalar columns (Two
    // Option / Picklist), so no @odata.bind — just plain values.
    async createResource(input: ResourceAdminInput): Promise<void> {
      const { S, org } = await sdk();
      const res = await S.CreateRecordWithOrganization(
        PREFER_WRITE, ACCEPT, org, INSTALL_SET, installRecord(input),
      );
      if (!res.success) throw new Error(res.error?.message ?? `CreateCrew failed`);
    },
    async updateResource(id: string, input: ResourceAdminInput): Promise<void> {
      const { S, org } = await sdk();
      const res = await S.UpdateRecordWithOrganization(
        PREFER_WRITE, ACCEPT, org, INSTALL_SET, id, installRecord(input),
      );
      if (!res.success) throw new Error(res.error?.message ?? `UpdateCrew(${id}) failed`);
    },
    async deleteResource(id: string): Promise<void> {
      const { S, org } = await sdk();
      const res = await S.DeleteRecordWithOrganization(org, INSTALL_SET, id);
      if (!res.success) throw new Error(res.error?.message ?? `DeleteCrew(${id}) failed`);
    },
  };
}

/** Map an admin input to a crfdf_InstallationEmployees record payload. */
function installRecord(input: ResourceAdminInput): Row {
  const rec: Row = {};
  if (input.name !== undefined) rec.crfdf_employeename = input.name;
  if (input.truckNumber !== undefined)
    rec.crfdf_truck = input.truckNumber === "" ? null : input.truckNumber;
  if (input.isCertifiedCraneOperator !== undefined)
    rec.crfdf_certifiedcraneoperator = input.isCertifiedCraneOperator;
  if (input.location !== undefined) rec.crfdf_location = input.location;
  if (input.region !== undefined) rec.crfdf_region = input.region;
  if (input.position !== undefined) rec.crfdf_positiononschedule = input.position;
  return rec;
}

export const liveWkInstallDataSource = createLiveInstallDataSource(
  false,
  REGION_LOCATIONS.wk,
);
export const liveNekInstallDataSource = createLiveInstallDataSource(
  true,
  REGION_LOCATIONS.nek,
);

// ---------------------------------------------------------------------------
// Install cards (crfdf_installcard) — map / payload
// ---------------------------------------------------------------------------
// Flipped off (for the session) if a write fails because the newer install-card
// columns aren't provisioned yet — so cards keep saving. Reset on reload.
let installExtraColsAvailable = true;

function mapCardRecord(r: Row): ScheduleLine {
  const title = s(r.crfdf_name);
  const desc = decodeDesc(s(r.crfdf_notes));
  return {
    id: s(r.crfdf_installcardid),
    jobNo: s(r.crfdf_jobno) || title,
    customerName: title,
    installZip: s(r.crfdf_installzip) || null,
    crewPersons: nOrNull(r.crfdf_crewpersons),
    crewTrucks: nOrNull(r.crfdf_crewtrucks),
    crewTrips: nOrNull(r.crfdf_crewtrips),
    crewCranes: nOrNull(r.crfdf_crewcranes),
    crewLifts: nOrNull(r.crfdf_crewlifts),
    jobDescription: desc.jobDescription,
    planningLineDescription: desc.planningLineDescription,
    startDateTime: dt(r.crfdf_startdatetime),
    endDateTime: dt(r.crfdf_enddatetime),
    estimatedHours: n(r.crfdf_estimatedhours, 8),
    overrideHours: nOrNull(r.crfdf_overridehours),
    spanDays: nOrNull(r.crfdf_spandays),
    employeeId: s(r["_crfdf_employee_value"]),
    departmentId: String(n(r.crfdf_locationvalue, 6)),
    customerDueDate: null,
    isLocked: Boolean(r.crfdf_islocked),
    jobSequence: 0,
    isCustom: Boolean(r.crfdf_iscustom),
    customColor: s(r.crfdf_customcolor) || null,
    customTextColor: s(r.crfdf_customtextcolor) || null,
    finalInstall: Boolean(r.crfdf_finalinstall),
    shipmentLoadId: r["_crfdf_shipmentload_value"] == null ? null : s(r["_crfdf_shipmentload_value"]),
  };
}

function cardToRecord(line: Partial<ScheduleLine>, isNek: boolean, forCreate: boolean): Row {
  const rec: Row = {};
  const title = line.customerName || line.jobNo;
  if (title !== undefined) rec.crfdf_name = title || "Card";
  if (line.planningLineDescription !== undefined || line.jobDescription !== undefined)
    rec.crfdf_notes = encodeDesc(line);
  if (line.startDateTime !== undefined) rec.crfdf_startdatetime = iso(line.startDateTime);
  if (line.endDateTime !== undefined) rec.crfdf_enddatetime = iso(line.endDateTime);
  if (line.estimatedHours !== undefined) rec.crfdf_estimatedhours = line.estimatedHours;
  if (line.overrideHours !== undefined) rec.crfdf_overridehours = line.overrideHours;
  if (scheduleSpanCol && line.spanDays !== undefined) rec.crfdf_spandays = line.spanDays;
  if (line.departmentId !== undefined) rec.crfdf_locationvalue = Number(line.departmentId) || 0;
  if (line.isLocked !== undefined) rec.crfdf_islocked = line.isLocked;
  if (line.isCustom !== undefined) rec.crfdf_iscustom = line.isCustom;
  if (line.customColor !== undefined) rec.crfdf_customcolor = line.customColor;
  if (line.customTextColor !== undefined) rec.crfdf_customtextcolor = line.customTextColor;
  // The jobno/zip/crew/trips columns are newer; only include them while they're
  // known to be provisioned, so a card still saves if the schema lags behind.
  if (installExtraColsAvailable) {
    if (line.jobNo !== undefined && !line.isCustom) rec.crfdf_jobno = line.jobNo;
    if (line.installZip !== undefined) rec.crfdf_installzip = line.installZip;
    if (line.crewPersons !== undefined) rec.crfdf_crewpersons = line.crewPersons;
    if (line.crewTrucks !== undefined) rec.crfdf_crewtrucks = line.crewTrucks;
    if (line.crewTrips !== undefined) rec.crfdf_crewtrips = line.crewTrips;
    if (line.crewCranes !== undefined) rec.crfdf_crewcranes = line.crewCranes;
    if (line.crewLifts !== undefined) rec.crfdf_crewlifts = line.crewLifts;
    if (line.finalInstall !== undefined) rec.crfdf_finalinstall = line.finalInstall;
  }
  if (forCreate) rec.crfdf_region = isNek;
  if (line.employeeId) rec["crfdf_employee@odata.bind"] = `/${INSTALL_SET}(${line.employeeId})`;
  if (line.shipmentLoadId) rec["crfdf_shipmentload@odata.bind"] = `/${SHIP.loads}(${line.shipmentLoadId})`;
  return rec;
}

/** Load every install card into the reactive cache (both regions) — used at
 *  app start so the Shipping "Scheduled" badge is correct before the install
 *  calendar is opened. */
export async function hydrateInstallCardCache(): Promise<void> {
  const rows = await list(SHIP.cards, {});
  const all = rows.map(mapCardRecord);
  setRegionCards("wk", all.filter((_l, i) => Boolean(rows[i]!.crfdf_region) === false));
  setRegionCards("nek", all.filter((_l, i) => Boolean(rows[i]!.crfdf_region) === true));
}

// ---------------------------------------------------------------------------
// Shipping loads + items (crfdf_shipmentload / crfdf_shipmentitem)
// ---------------------------------------------------------------------------
function mapLoadHead(r: Row): Omit<ShipmentLoad, "items"> {
  return {
    id: s(r.crfdf_shipmentloadid),
    name: s(r.crfdf_name),
    autoName: Boolean(r.crfdf_autoname),
    shipDate: dt(r.crfdf_shipdate),
    status: OPT_TO_STATUS[n(r.crfdf_status, 0)] ?? "planned",
    generalNotes: s(r.crfdf_generalnotes),
  };
}
function mapItemRecord(r: Row): ShipmentItem {
  return {
    id: s(r.crfdf_shipmentitemid),
    jobNo: r.crfdf_jobno == null || r.crfdf_jobno === "" ? null : s(r.crfdf_jobno),
    customerName: s(r.crfdf_customername),
    description: s(r.crfdf_description),
    notes: s(r.crfdf_notes),
    location: s(r.crfdf_location),
    kind: r.crfdf_ispickup ? "pickup" : "delivery",
    loaded: Boolean(r.crfdf_loaded),
  };
}
function loadToRecord(load: Partial<ShipmentLoad>): Row {
  const rec: Row = {};
  if (load.name !== undefined) rec.crfdf_name = load.name;
  if (load.autoName !== undefined) rec.crfdf_autoname = load.autoName;
  if (load.shipDate !== undefined) rec.crfdf_shipdate = iso(load.shipDate);
  if (load.status !== undefined) rec.crfdf_status = STATUS_TO_OPT[load.status];
  if (load.generalNotes !== undefined) rec.crfdf_generalnotes = load.generalNotes;
  return rec;
}
function itemToRecord(item: Partial<ShipmentItem>, sort: number | undefined, loadId: string | undefined): Row {
  const rec: Row = {};
  if (item.jobNo !== undefined) rec.crfdf_jobno = item.jobNo;
  if (item.customerName !== undefined) {
    rec.crfdf_customername = item.customerName;
    rec.crfdf_name = item.customerName || "Item";
  }
  if (item.description !== undefined) rec.crfdf_description = item.description;
  if (item.notes !== undefined) rec.crfdf_notes = item.notes;
  if (item.location !== undefined) rec.crfdf_location = item.location;
  if (item.kind !== undefined) rec.crfdf_ispickup = item.kind === "pickup";
  if (item.loaded !== undefined) rec.crfdf_loaded = item.loaded;
  if (sort !== undefined) rec.crfdf_sortorder = sort;
  if (loadId) rec["crfdf_load@odata.bind"] = `/${SHIP.loads}(${loadId})`;
  return rec;
}

export async function fetchShipmentLoads(): Promise<ShipmentLoad[]> {
  const [loadRows, itemRows] = await Promise.all([
    list(SHIP.loads, { orderby: "crfdf_shipdate asc" }),
    list(SHIP.items, {}),
  ]);
  const byLoad = new Map<string, Array<{ item: ShipmentItem; sort: number }>>();
  for (const r of itemRows) {
    const loadId = s(r["_crfdf_load_value"]);
    if (!loadId) continue;
    const arr = byLoad.get(loadId) ?? [];
    arr.push({ item: mapItemRecord(r), sort: n(r.crfdf_sortorder, 0) });
    byLoad.set(loadId, arr);
  }
  return loadRows.map((r) => {
    const head = mapLoadHead(r);
    const items = (byLoad.get(head.id) ?? []).sort((a, b) => a.sort - b.sort).map((x) => x.item);
    return { ...head, items };
  });
}

export async function createLoadRecord(load: ShipmentLoad): Promise<void> {
  const { S, org } = await sdk();
  const rec = { crfdf_shipmentloadid: load.id, ...loadToRecord(load) };
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SHIP.loads, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createLoad failed");
}
export async function updateLoadRecord(id: string, patch: Partial<ShipmentLoad>): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SHIP.loads, id, loadToRecord(patch));
  if (!res.success) throw new Error(res.error?.message ?? "updateLoad failed");
}
export async function deleteLoadRecord(id: string): Promise<void> {
  const { S, org } = await sdk();
  await S.DeleteRecordWithOrganization(org, SHIP.loads, id);
}
export async function createItemRecord(loadId: string, item: ShipmentItem, sort: number): Promise<void> {
  const { S, org } = await sdk();
  const rec = { crfdf_shipmentitemid: item.id, ...itemToRecord(item, sort, loadId) };
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SHIP.items, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createItem failed");
}
export async function updateItemRecord(id: string, patch: Partial<ShipmentItem>): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SHIP.items, id, itemToRecord(patch, undefined, undefined));
  if (!res.success) throw new Error(res.error?.message ?? "updateItem failed");
}
export async function deleteItemRecord(id: string): Promise<void> {
  const { S, org } = await sdk();
  await S.DeleteRecordWithOrganization(org, SHIP.items, id);
}

// ---------------------------------------------------------------------------
// Business Central staging tables (synced from BC via Power Automate flows)
// ---------------------------------------------------------------------------
const BC = {
  jobs: "crfdf_bcjobs",
  planning: "crfdf_bcplanninglines",
  billing: "crfdf_bcbillinglines",
  customers: "crfdf_bccustomers",
} as const;

// ---------------------------------------------------------------------------
// BC planning-step write-back OUTBOX (crfdf_bcpushqueue)
// ---------------------------------------------------------------------------
// The Code App can only talk to Dataverse (its lone connector), so we don't
// call the BC API from the browser. Instead a board commit drops a "pending"
// row here; a Dataverse-triggered Power Automate flow (BCPush_PlanningSteps)
// drains it, PATCHes the sign365 projectPlanningEntries API, and writes the
// row's status back. See flows/BCPush_PlanningSteps.md.
const BCPUSH_SET = "crfdf_bcpushqueues";

function pushToRecord(p: BcPlanningPush): Row {
  return {
    crfdf_bcpushqueueid: uuid(),
    crfdf_name: pushRowName(p),
    crfdf_jobno: p.jobNo,
    crfdf_kind: p.kind,
    crfdf_planningstep: p.planningStep,
    crfdf_deptkey: p.deptKey,
    crfdf_startdatetime: p.startDateTime,
    crfdf_enddatetime: p.endDateTime,
    crfdf_assignedto: p.assignedTo,
    crfdf_assignedtoname: p.assignedToName,
    crfdf_complete: p.complete,
    crfdf_started: p.started,
    crfdf_status: "pending",
    crfdf_sourcelineid: p.sourceLineId,
  };
}

/**
 * Enqueue a BC planning-step push. FIRE-AND-FORGET by contract: enqueuing must
 * never block or fail a board commit, so all errors are swallowed + logged. A
 * null push (non-BC / custom line) is a no-op.
 */
export async function enqueueBcPush(push: BcPlanningPush | null): Promise<void> {
  if (!push) return;
  try {
    const { S, org } = await sdk();
    await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, BCPUSH_SET, pushToRecord(push));
  } catch (e) {
    console.warn("[bc-sync] enqueue failed (non-blocking)", e);
  }
}

export interface BcJobLive {
  jobNo: string;
  customerName: string;
  /** Ship-to / sales-order customer name (crfdf_appjobname), set by the
   *  BCSync_SalesLines flow from the order's sell-to customer. This is the name
   *  we want on job cards; falls back to the bill-to customer / description. */
  appJobName: string;
  description: string;
  /** Bill-to code (crfdf_billtocustomerno) — join key to crfdf_bccustomers. */
  billToNo: string;
  /** Ship-to ZIP (crfdf_shiptozip) — used to look up the install weather. */
  shipToZip: string;
  promisedDate: string;
  remainingBalance: number;
  planningLines: Array<{
    lineNo: number;
    description: string;
    estimatedHours: number;
    /** BC resource code (crfdf_no) → department labor category, AND the
     *  Production (2000-band) / Installation split. */
    resourceNo: string;
    /** BC job task no (crfdf_jobtaskno) — surfaced for reference. */
    jobTaskNo: string;
  }>;
}

const odataLit = (v: string) => v.replace(/'/g, "''");

async function planningLinesFor(jobNo: string) {
  // Planning lines match the BC job on crfdf_jobno (NOT crfdf_jobnumber, which
  // is empty on this table). Resource-type lines only — G/L / Item lines aren't
  // schedulable labor.
  //   The resource code drives the Production (2000-band) / Installation split
  //     AND the exact department labor category. BC mirrors it into TWO columns
  //     — crfdf_resourceno (the dedicated Resource No.) and crfdf_no (the line
  //     "No."); crfdf_no is empty on this mirror, so prefer crfdf_resourceno.
  //   crfdf_quantity is the estimated hours (crfdf_estimatedhours is a
  //     schedule-line column and is empty on planning lines).
  //   crfdf_jobtaskno is surfaced for reference (BC phase task band).
  const rows = await list(BC.planning, {
    filter: `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_type eq 'Resource'`,
    orderby: "crfdf_lineno asc",
  });
  return rows.map((r) => ({
    lineNo: n(r.crfdf_lineno),
    description: s(r.crfdf_description),
    estimatedHours: n(r.crfdf_quantity) || n(r.crfdf_estimatedhours),
    resourceNo: s(r.crfdf_resourceno) || s(r.crfdf_no),
    jobTaskNo: s(r.crfdf_jobtaskno),
  }));
}

// Crew-size placeholders encode men-per-trip in the code/description text:
// "WK 2 MAN - TBD" / "NEK 1 MAN - TBD" → 2 / 1. Returns the man-count, or null
// when the text isn't a crew placeholder.
const menFromText = (v: string): number | null => {
  const m = /(\d+)\s*MAN/i.exec(v ?? "");
  return m ? parseInt(m[1], 10) : null;
};

export interface BcJobCrew {
  crewTrips: number;
  crewPersons: number;
  crewTrucks: number;
}

/** Derive per-trip crew for a job from its BC planning lines, mirroring the
 *  Production trips model. Only Install-Travel lines (job task 402x) count as
 *  trips — a job like J34000 has a 4020 "Travel" line per trip plus a 4010
 *  install-labor line ("Reinstall sign") that carries the SAME "N MAN" crew
 *  code; the 4010 line is the work on that trip, not a separate trip, so it
 *  must not be counted. Men-per-trip come from the crew placeholder ("WK 2 MAN
 *  - TBD" → 2) on any of the job's lines, else the travel-line quantity, else 1;
 *  trucks default to 1 per trip (BC has no explicit truck line). Returns null
 *  when the job has no install-travel lines. */
function deriveCrewFromLines(
  lines: Array<{ description: string; estimatedHours: number; resourceNo: string; jobTaskNo: string }>,
): BcJobCrew | null {
  let trips = 0;
  let men = 0;
  let travelQtyMen = 0;
  for (const l of lines) {
    const parsed = menFromText(l.resourceNo) ?? menFromText(l.description);
    if (parsed != null) men = Math.max(men, parsed); // crew size from any "N MAN" line
    if ((l.jobTaskNo ?? "").startsWith("402")) {
      trips += 1; // trips = Install-Travel lines only
      if (l.estimatedHours >= 1) travelQtyMen = Math.max(travelQtyMen, Math.round(l.estimatedHours));
    }
  }
  return trips > 0
    ? { crewTrips: trips, crewPersons: men || travelQtyMen || 1, crewTrucks: 1 }
    : null;
}

/** A card carries manually-entered crew (persisted in crfdf_crew*) — in which
 *  case it overrides the BC-derived crew. */
const hasManualCrew = (l: ScheduleLine): boolean =>
  l.crewPersons != null || l.crewTrucks != null || l.crewTrips != null;

// Real customer name lives on crfdf_bccustomers.crfdf_customername, joined via
// the job's bill-to code. The job row's own crfdf_customername is actually the
// job description, so we don't trust it. Cached per bill-to (jobs share).
const customerNameCache = new Map<string, string>();
async function resolveCustomerName(billToNo: string): Promise<string> {
  if (!billToNo) return "";
  const hit = customerNameCache.get(billToNo);
  if (hit !== undefined) return hit;
  const rows = await list(BC.customers, {
    filter: `crfdf_customerno eq '${odataLit(billToNo)}'`,
  });
  const name = rows[0] ? s(rows[0].crfdf_customername) : "";
  customerNameCache.set(billToNo, name);
  return name;
}

// Session cache: BC job number → { ship-to/sales-order customer name, remaining
// order value }. Lets schedule lines display the current name + outstanding
// balance from BC without re-adding them. Refreshed on reload (nightly sync).
export interface BcJobMeta {
  name: string;
  remaining: number;
  shipToZip: string;
  /** BC order-release date (crfdf_releasedate ← sign365 icgSgpOrderReleasedDate,
   *  via BCSync_JobReleaseDates). ISO date ("" when unset / placeholder). Drives
   *  target dates. */
  releaseDate: string;
}
let bcJobMetaPromise: Promise<Map<string, BcJobMeta>> | null = null;
export function bcJobMetaByJobNo(): Promise<Map<string, BcJobMeta>> {
  if (!bcJobMetaPromise) {
    bcJobMetaPromise = (async () => {
      const rows = await list(BC.jobs, {
        select: "crfdf_jobnumber,crfdf_appjobname,crfdf_remainingbalance,crfdf_shiptozip,crfdf_releasedate",
      });
      const m = new Map<string, BcJobMeta>();
      for (const r of rows) {
        const jn = s(r.crfdf_jobnumber);
        if (jn)
          m.set(jn, {
            name: s(r.crfdf_appjobname),
            remaining: n(r.crfdf_remainingbalance),
            shipToZip: s(r.crfdf_shiptozip),
            releaseDate: r.crfdf_releasedate == null ? "" : String(r.crfdf_releasedate).slice(0, 10),
          });
      }
      return m;
    })().catch(() => new Map<string, BcJobMeta>());
  }
  return bcJobMetaPromise;
}

/** BC order-release date for a job (crfdf_bcjobs.crfdf_releasedate), or null. */
export async function jobReleaseDate(jobNo: string): Promise<Date | null> {
  const meta = (await bcJobMetaByJobNo()).get(jobNo);
  const v = meta?.releaseDate;
  if (!v) return null;
  const [y, mo, d] = v.split("-").map(Number);
  return y ? new Date(y, (mo || 1) - 1, d || 1) : null;
}

// jobNo → BC salesperson code (crfdf_bcjobs.crfdf_salespersoncode, populated by
// BCSync_SalesLines). Its own guarded query so a not-yet-added column can't break
// the name/value overlay above — returns an empty map until the column exists.
let salespersonPromise: Promise<Map<string, string>> | null = null;
export function salespersonByJobNo(): Promise<Map<string, string>> {
  if (!salespersonPromise) {
    salespersonPromise = (async () => {
      const rows = await list(BC.jobs, { select: "crfdf_jobnumber,crfdf_salespersoncode" });
      const m = new Map<string, string>();
      for (const r of rows) {
        const jn = s(r.crfdf_jobnumber);
        const code = s(r.crfdf_salespersoncode).trim().toUpperCase();
        if (jn && code) m.set(jn, code);
      }
      return m;
    })().catch(() => new Map<string, string>());
  }
  return salespersonPromise;
}

// jobNo → direct SharePoint folder URL (crfdf_bcjobs.crfdf_sharepointurl). Its
// own guarded query so a not-yet-added column can't break the value/name overlay.
let sharepointPromise: Promise<Map<string, string>> | null = null;
export function sharepointUrlByJobNo(): Promise<Map<string, string>> {
  if (!sharepointPromise) {
    sharepointPromise = (async () => {
      const rows = await list(BC.jobs, { select: "crfdf_jobnumber,crfdf_sharepointurl" });
      const m = new Map<string, string>();
      for (const r of rows) {
        const jn = s(r.crfdf_jobnumber);
        const url = s(r.crfdf_sharepointurl).trim();
        if (jn && url) m.set(jn, url);
      }
      return m;
    })().catch(() => new Map<string, string>());
  }
  return sharepointPromise;
}

// --- Sales/PM "Active Jobs" ---------------------------------------------------
// Every job currently scheduled anywhere (Production, Installation, Shipping),
// from a given date forward, with where it sits so Sales/PM can see their book.
export interface ActivePlacement {
  kind: "production" | "installation" | "shipping";
  label: string;
  date: Date;
}
export interface ActiveJob {
  jobNo: string;
  customerName: string;
  salespersonCode: string | null;
  earliest: Date;
  placements: ActivePlacement[];
}

export async function fetchActiveJobs(from: Date): Promise<ActiveJob[]> {
  const fromIso = from.toISOString();
  const [prodRows, deptRows, cardRows, loads, meta, salesByJob] = await Promise.all([
    list(SET.lines, { filter: `crfdf_startdatetime ge ${fromIso}`, orderby: "crfdf_startdatetime asc" }),
    list(SET.departments, { select: "crfdf_department1id,crfdf_departmentname" }),
    list(SHIP.cards, {}),
    fetchShipmentLoads(),
    bcJobMetaByJobNo(),
    salespersonByJobNo(),
  ]);

  const deptName = new Map<string, string>();
  for (const d of deptRows) deptName.set(s(d.crfdf_department1id), s(d.crfdf_departmentname, "Production"));

  type Acc = { customerName: string; placements: Map<string, ActivePlacement> };
  const jobs = new Map<string, Acc>();
  const addPlacement = (jobNo: string, customer: string, p: ActivePlacement) => {
    let acc = jobs.get(jobNo);
    if (!acc) {
      acc = { customerName: customer, placements: new Map() };
      jobs.set(jobNo, acc);
    } else if (!acc.customerName && customer) acc.customerName = customer;
    // Collapse repeats (e.g. many production lines) to one chip, earliest date.
    const key = `${p.kind}|${p.label}`;
    const existing = acc.placements.get(key);
    if (!existing || p.date < existing.date) acc.placements.set(key, p);
  };

  for (const r of prodRows) {
    const l = mapLine(r);
    if (!l.jobNo || l.isCustom) continue;
    const dn = l.departmentId ? deptName.get(l.departmentId) : undefined;
    addPlacement(l.jobNo, l.customerName, {
      kind: "production",
      label: dn ? `Production · ${dn}` : "Production",
      date: l.startDateTime,
    });
  }
  for (const r of cardRows) {
    const c = mapCardRecord(r);
    if (!c.jobNo || c.isCustom || c.shipmentLoadId || c.startDateTime < from) continue;
    addPlacement(c.jobNo, c.customerName, {
      kind: "installation",
      label: c.region ? `Installation · ${c.region}` : "Installation",
      date: c.startDateTime,
    });
  }
  for (const load of loads) {
    if (load.shipDate < from) continue;
    for (const it of load.items) {
      if (!it.jobNo) continue;
      addPlacement(it.jobNo, it.customerName, {
        kind: "shipping",
        label: `Shipping · ${load.name}`,
        date: load.shipDate,
      });
    }
  }

  const out: ActiveJob[] = [];
  for (const [jobNo, acc] of jobs) {
    const placements = [...acc.placements.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (placements.length === 0) continue;
    out.push({
      jobNo,
      customerName: meta.get(jobNo)?.name || acc.customerName || jobNo,
      salespersonCode: salesByJob.get(jobNo) ?? null,
      earliest: placements[0].date,
      placements,
    });
  }
  out.sort((a, b) => a.earliest.getTime() - b.earliest.getTime());
  return out;
}

// Session cache: install ZIP → current weather (lum_weathercaches, keyed by
// lum_location = ZIP; refreshed by the WeatherCache_Refresh flow).
export interface WeatherInfo {
  tempF: number;
  condition: string;
  iconUrl: string;
  humidity: number;
}
// DateOnly (lum_date) comes back as "2026-07-13" (or full ISO); keep the day part.
const weatherDateKey = (v: unknown): string => s(v).trim().slice(0, 10);

// Map keyed BOTH ways: per-day forecast rows under `${zip}|${yyyy-mm-dd}`, and a
// legacy per-ZIP current-conditions row (no lum_date) under `${zip}`. useWeather
// prefers the dated row for the card's day, then falls back to the ZIP row.
let weatherPromise: Promise<Map<string, WeatherInfo>> | null = null;
export function weatherByZip(): Promise<Map<string, WeatherInfo>> {
  if (!weatherPromise) {
    weatherPromise = (async () => {
      const rows = await list("lum_weathercaches", {
        select: "lum_location,lum_date,lum_tempf,lum_conditiontext,lum_iconurl,lum_humidity",
      });
      const m = new Map<string, WeatherInfo>();
      for (const r of rows) {
        const loc = s(r.lum_location).trim();
        if (!loc) continue;
        const info: WeatherInfo = {
          tempF: n(r.lum_tempf),
          condition: s(r.lum_conditiontext),
          iconUrl: s(r.lum_iconurl),
          humidity: n(r.lum_humidity),
        };
        const date = weatherDateKey(r.lum_date);
        if (date) m.set(`${loc}|${date}`, info); // per-day forecast row
        else if (!m.has(loc)) m.set(loc, info); // legacy dateless fallback
      }
      return m;
    })().catch(() => new Map<string, WeatherInfo>());
  }
  return weatherPromise;
}

function mapBcJobHead(r: Row): Omit<BcJobLive, "planningLines"> {
  const due = r.crfdf_promiseddate;
  return {
    jobNo: s(r.crfdf_jobnumber),
    appJobName: s(r.crfdf_appjobname),
    // Fallback only — replaced by the crfdf_bccustomers join below.
    customerName: s(r.crfdf_customername),
    description: s(r.crfdf_description),
    billToNo: s(r.crfdf_billtocustomerno),
    shipToZip: s(r.crfdf_shiptozip),
    promisedDate: due == null || due === "" ? "" : String(due).slice(0, 10),
    remainingBalance: n(r.crfdf_remainingbalance),
  };
}

/** Search the BC job staging table by job number or customer; include each
 *  match's planning lines. Throws if Dataverse is unreachable (callers fall
 *  back to the mock). */
export async function searchBcJobsLive(query: string, limit = 8): Promise<BcJobLive[]> {
  const q = odataLit(query.trim());
  // Search the job number AND both name sources: crfdf_appjobname (the ship-to /
  // sales-order name actually shown in results, e.g. "Peachy Cheeks") and the raw
  // crfdf_customername. Without appjobname, typing the displayed name found nothing.
  const rows = await list(BC.jobs, {
    filter:
      `contains(crfdf_jobnumber,'${q}') or ` +
      `contains(crfdf_appjobname,'${q}') or ` +
      `contains(crfdf_customername,'${q}')`,
    orderby: "crfdf_jobnumber asc",
  });
  const heads = rows.slice(0, limit).map(mapBcJobHead);
  return Promise.all(
    heads.map(async (h) => ({
      ...h,
      // Ship-to / sales-order customer name wins; then the bill-to join; then
      // the raw crfdf_customername / description fallback from the head.
      customerName: h.appJobName || (await resolveCustomerName(h.billToNo)) || h.customerName,
      planningLines: await planningLinesFor(h.jobNo),
    })),
  );
}

export async function getBcJobLive(jobNo: string): Promise<BcJobLive | null> {
  const rows = await list(BC.jobs, { filter: `crfdf_jobnumber eq '${odataLit(jobNo)}'` });
  if (rows.length === 0) return null;
  const head = mapBcJobHead(rows[0]!);
  return {
    ...head,
    customerName: head.appJobName || (await resolveCustomerName(head.billToNo)) || head.customerName,
    planningLines: await planningLinesFor(head.jobNo),
  };
}

/** All BC billing lines — powers the schedule value / estimated-invoicing
 *  rollups. */
export async function fetchBcBillingLive(): Promise<
  Array<{ jobNo: string; description: string; amount: number; invoicedAmount: number; remainingAmount: number; date: string }>
> {
  const rows = await list(BC.billing, {});
  return rows.map((r) => ({
    jobNo: s(r.crfdf_jobnumber),
    description: s(r.crfdf_description),
    amount: n(r.crfdf_amount),
    invoicedAmount: n(r.crfdf_invoicedamount),
    remainingAmount: n(r.crfdf_remainingamount),
    date: r.crfdf_billdate == null ? "" : String(r.crfdf_billdate).slice(0, 10),
  }));
}

// ---------------------------------------------------------------------------
// Job Queue (crfdf_jobqueuegroup / crfdf_jobqueueitem)
// ---------------------------------------------------------------------------
// A per-board (crfdf_kind) set of named, ordered groups, each holding parked
// jobs ready to drag onto the schedule. Items reference their group by a plain
// GUID string column (crfdf_groupid) — no Dataverse relationship. Job + task
// text share the crfdf_description column via the same sentinel as schedule
// lines / install cards (see encodeDesc / decodeDesc).
const QUEUE = {
  groups: "crfdf_jobqueuegroups",
  items: "crfdf_jobqueueitems",
} as const;

function mapQueueGroup(r: Row): Omit<QueueGroup, "items"> {
  return {
    id: s(r.crfdf_jobqueuegroupid),
    kind: (s(r.crfdf_kind) || "production") as QueueKind,
    name: s(r.crfdf_name, "Group"),
    color: s(r.crfdf_color) || "#141464",
    textColor: s(r.crfdf_textcolor) || "#ffffff",
    collapsed: n(r.crfdf_collapsed) === 1,
    sortOrder: n(r.crfdf_sortorder),
  };
}

function mapQueueItem(r: Row): QueueItem {
  const desc = decodeDesc(s(r.crfdf_description));
  return {
    id: s(r.crfdf_jobqueueitemid),
    groupId: s(r.crfdf_groupid),
    jobNo: s(r.crfdf_jobno),
    customerName: s(r.crfdf_customername),
    jobDescription: desc.jobDescription,
    planningLineDescription: desc.planningLineDescription,
    estimatedHours: n(r.crfdf_estimatedhours, 8),
    departmentId: s(r.crfdf_departmentid),
    crewPersons: nOrNull(r.crfdf_crewpersons),
    crewTrucks: nOrNull(r.crfdf_crewtrucks),
    crewTrips: nOrNull(r.crfdf_crewtrips),
    installZip: r.crfdf_installzip == null ? null : s(r.crfdf_installzip),
    invoiceAmount: nOrNull(r.crfdf_invoiceamount),
    isCustom: n(r.crfdf_iscustom) === 1,
    customColor: r.crfdf_customcolor == null ? null : s(r.crfdf_customcolor),
    customTextColor: r.crfdf_customtextcolor == null ? null : s(r.crfdf_customtextcolor),
    sortOrder: n(r.crfdf_sortorder),
  };
}

function queueGroupToRecord(g: Partial<QueueGroup>): Row {
  const rec: Row = {};
  if (g.name !== undefined) rec.crfdf_name = g.name;
  if (g.kind !== undefined) rec.crfdf_kind = g.kind;
  if (g.color !== undefined) rec.crfdf_color = g.color;
  if (g.textColor !== undefined) rec.crfdf_textcolor = g.textColor;
  if (g.collapsed !== undefined) rec.crfdf_collapsed = g.collapsed ? 1 : 0;
  if (g.sortOrder !== undefined) rec.crfdf_sortorder = g.sortOrder;
  return rec;
}

function queueItemToRecord(it: Partial<QueueItem>): Row {
  const rec: Row = {};
  if (it.customerName !== undefined || it.jobNo !== undefined)
    rec.crfdf_name = it.customerName || it.jobNo || "Job";
  if (it.groupId !== undefined) rec.crfdf_groupid = it.groupId;
  if (it.jobNo !== undefined) rec.crfdf_jobno = it.jobNo;
  if (it.customerName !== undefined) rec.crfdf_customername = it.customerName;
  if (it.planningLineDescription !== undefined || it.jobDescription !== undefined)
    rec.crfdf_description = encodeDesc({
      jobDescription: it.jobDescription,
      planningLineDescription: it.planningLineDescription,
    });
  if (it.estimatedHours !== undefined) rec.crfdf_estimatedhours = it.estimatedHours;
  if (it.departmentId !== undefined) rec.crfdf_departmentid = it.departmentId;
  if (it.crewPersons !== undefined) rec.crfdf_crewpersons = it.crewPersons;
  if (it.crewTrucks !== undefined) rec.crfdf_crewtrucks = it.crewTrucks;
  if (it.crewTrips !== undefined) rec.crfdf_crewtrips = it.crewTrips;
  if (it.installZip !== undefined) rec.crfdf_installzip = it.installZip;
  if (it.invoiceAmount !== undefined) rec.crfdf_invoiceamount = it.invoiceAmount;
  if (it.isCustom !== undefined) rec.crfdf_iscustom = it.isCustom ? 1 : 0;
  if (it.customColor !== undefined) rec.crfdf_customcolor = it.customColor;
  if (it.customTextColor !== undefined) rec.crfdf_customtextcolor = it.customTextColor;
  if (it.sortOrder !== undefined) rec.crfdf_sortorder = it.sortOrder;
  return rec;
}

/** All groups (with their items) for one board, ordered by sortOrder. */
export async function fetchQueueGroups(kind: QueueKind): Promise<QueueGroup[]> {
  const [groupRows, itemRows] = await Promise.all([
    list(QUEUE.groups, { filter: `crfdf_kind eq '${odataLit(kind)}'`, orderby: "crfdf_sortorder asc" }),
    list(QUEUE.items, { orderby: "crfdf_sortorder asc" }),
  ]);
  const byGroup = new Map<string, QueueItem[]>();
  for (const r of itemRows) {
    const it = mapQueueItem(r);
    if (!it.groupId) continue;
    const arr = byGroup.get(it.groupId) ?? [];
    arr.push(it);
    byGroup.set(it.groupId, arr);
  }
  return groupRows.map(mapQueueGroup).map((g) => ({
    ...g,
    items: (byGroup.get(g.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export async function createQueueGroup(g: QueueGroup): Promise<void> {
  const { S, org } = await sdk();
  const rec = { crfdf_jobqueuegroupid: g.id, ...queueGroupToRecord(g) };
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, QUEUE.groups, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createQueueGroup failed");
}

export async function updateQueueGroup(id: string, changes: Partial<QueueGroup>): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, QUEUE.groups, id, queueGroupToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateQueueGroup(${id}) failed`);
}

/** Delete a group and all of its parked items. */
export async function deleteQueueGroup(id: string, itemIds: string[]): Promise<void> {
  const { S, org } = await sdk();
  await Promise.all(itemIds.map((iid) => S.DeleteRecordWithOrganization(org, QUEUE.items, iid)));
  const res = await S.DeleteRecordWithOrganization(org, QUEUE.groups, id);
  if (!res.success) throw new Error(res.error?.message ?? `deleteQueueGroup(${id}) failed`);
}

export async function createQueueItem(it: QueueItem): Promise<void> {
  const { S, org } = await sdk();
  const rec = { crfdf_jobqueueitemid: it.id, ...queueItemToRecord(it) };
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, QUEUE.items, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createQueueItem failed");
}

export async function updateQueueItem(id: string, changes: Partial<QueueItem>): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, QUEUE.items, id, queueItemToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateQueueItem(${id}) failed`);
}

export async function deleteQueueItem(id: string): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.DeleteRecordWithOrganization(org, QUEUE.items, id);
  if (!res.success) throw new Error(res.error?.message ?? `deleteQueueItem(${id}) failed`);
}

// ---------------------------------------------------------------------------
// Custom card presets (crfdf_customcardpreset)
// ---------------------------------------------------------------------------
// Reusable "block out time" cards a user saves on Add Job → Custom Card, scoped
// per board family by crfdf_kind ("production" / "installation"). The card label
// is the primary name column.
const CARD_PRESET_SET = "crfdf_customcardpresets";

function mapCardPreset(r: Row): SavedCardPreset {
  return {
    id: s(r.crfdf_customcardpresetid),
    kind: (s(r.crfdf_kind) || "production") as PresetKind,
    label: s(r.crfdf_name, "Card"),
    bgColor: s(r.crfdf_bgcolor) || "#cccccc",
    textColor: s(r.crfdf_textcolor) || "#1a1d23",
    defaultHours: n(r.crfdf_defaulthours, 8),
    lockByDefault: n(r.crfdf_lockbydefault) === 1,
    applyAllByDefault: n(r.crfdf_applyallbydefault) === 1,
    sortOrder: n(r.crfdf_sortorder),
  };
}

function cardPresetToRecord(p: Partial<SavedCardPreset>): Row {
  const rec: Row = {};
  if (p.label !== undefined) rec.crfdf_name = p.label || "Card";
  if (p.kind !== undefined) rec.crfdf_kind = p.kind;
  if (p.bgColor !== undefined) rec.crfdf_bgcolor = p.bgColor;
  if (p.textColor !== undefined) rec.crfdf_textcolor = p.textColor;
  if (p.defaultHours !== undefined) rec.crfdf_defaulthours = p.defaultHours;
  if (p.lockByDefault !== undefined) rec.crfdf_lockbydefault = p.lockByDefault ? 1 : 0;
  if (p.applyAllByDefault !== undefined) rec.crfdf_applyallbydefault = p.applyAllByDefault ? 1 : 0;
  if (p.sortOrder !== undefined) rec.crfdf_sortorder = p.sortOrder;
  return rec;
}

export async function fetchCardPresets(kind: PresetKind): Promise<SavedCardPreset[]> {
  const rows = await list(CARD_PRESET_SET, {
    filter: `crfdf_kind eq '${odataLit(kind)}'`,
    orderby: "crfdf_sortorder asc",
  });
  return rows.map(mapCardPreset);
}

export async function createCardPreset(p: SavedCardPreset): Promise<void> {
  const { S, org } = await sdk();
  const rec = { crfdf_customcardpresetid: p.id, ...cardPresetToRecord(p) };
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, CARD_PRESET_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createCardPreset failed");
}

export async function updateCardPreset(id: string, changes: Partial<SavedCardPreset>): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, CARD_PRESET_SET, id, cardPresetToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateCardPreset(${id}) failed`);
}

export async function deleteCardPreset(id: string): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.DeleteRecordWithOrganization(org, CARD_PRESET_SET, id);
  if (!res.success) throw new Error(res.error?.message ?? `deleteCardPreset(${id}) failed`);
}

// ---------------------------------------------------------------------------
// App users (crfdf_appuser) — the editable login-role directory
// ---------------------------------------------------------------------------
// One row per login: email + user type. The app merges this over the hardcoded
// USER_DIRECTORY (table wins) so roles can change without a code deploy.
const APPUSER_SET = "crfdf_appusers";

export interface AppUserRow {
  id: string;
  email: string;
  userType: string;
  displayName: string;
}

function mapAppUser(r: Row): AppUserRow {
  return {
    id: s(r.crfdf_appuserid),
    email: s(r.crfdf_email).trim().toLowerCase(),
    // Normalize casing/whitespace so "Admin" / "Install-WK" match the slugs.
    userType: s(r.crfdf_usertype).trim().toLowerCase() || "admin",
    displayName: s(r.crfdf_displayname),
  };
}

function appUserToRecord(u: Partial<AppUserRow>): Row {
  const rec: Row = {};
  if (u.email !== undefined) {
    const email = u.email.trim().toLowerCase();
    rec.crfdf_email = email;
    rec.crfdf_name = email; // primary name = email, so rows are identifiable
  }
  if (u.userType !== undefined) rec.crfdf_usertype = u.userType;
  if (u.displayName !== undefined) rec.crfdf_displayname = u.displayName;
  return rec;
}

export async function fetchAppUsers(): Promise<AppUserRow[]> {
  const rows = await list(APPUSER_SET, { orderby: "crfdf_email asc" });
  return rows.map(mapAppUser).filter((u) => u.email);
}

export async function createAppUser(u: AppUserRow): Promise<void> {
  const { S, org } = await sdk();
  const rec = { crfdf_appuserid: u.id, ...appUserToRecord(u) };
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, APPUSER_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createAppUser failed");
}

export async function updateAppUser(id: string, changes: Partial<AppUserRow>): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, APPUSER_SET, id, appUserToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateAppUser(${id}) failed`);
}

export async function deleteAppUser(id: string): Promise<void> {
  const { S, org } = await sdk();
  const res = await S.DeleteRecordWithOrganization(org, APPUSER_SET, id);
  if (!res.success) throw new Error(res.error?.message ?? `deleteAppUser(${id}) failed`);
}

// ---------------------------------------------------------------------------
// Roster overrides (crfdf_rosteroverride) — "just this week" name moves
// ---------------------------------------------------------------------------
// One row per (employee, week, board): where that person sits for that week
// only. The board overlays these on the permanent roster on load.
const RO_SET = "crfdf_rosteroverrides";

function mapRosterOverride(r: Row): RosterOverride {
  return {
    id: s(r.crfdf_rosteroverrideid),
    employeeId: s(r.crfdf_employeeid),
    weekStart: s(r.crfdf_weekstart).slice(0, 10),
    boardKind: s(r.crfdf_boardkind),
    departmentId: s(r.crfdf_departmentid),
    position: s(r.crfdf_position),
  };
}

function rosterOverrideToRecord(o: Partial<RosterOverride>): Row {
  const rec: Row = {};
  if (o.employeeId !== undefined) rec.crfdf_employeeid = o.employeeId;
  if (o.weekStart !== undefined) rec.crfdf_weekstart = o.weekStart;
  if (o.boardKind !== undefined) rec.crfdf_boardkind = o.boardKind;
  if (o.departmentId !== undefined) rec.crfdf_departmentid = o.departmentId;
  if (o.position !== undefined) rec.crfdf_position = o.position;
  rec.crfdf_name = `${o.weekStart ?? ""} ${o.boardKind ?? ""} ${o.employeeId ?? ""}`.trim() || "Override";
  return rec;
}

const roMatch = (o: { employeeId: string; boardKind: string; weekStart: string }) =>
  `crfdf_employeeid eq '${odataLit(o.employeeId)}' and crfdf_boardkind eq '${odataLit(o.boardKind)}' and crfdf_weekstart eq '${odataLit(o.weekStart)}'`;

export async function fetchRosterOverrides(boardKind: string, weekStart: string): Promise<RosterOverride[]> {
  const rows = await list(RO_SET, {
    filter: `crfdf_boardkind eq '${odataLit(boardKind)}' and crfdf_weekstart eq '${odataLit(weekStart)}'`,
  });
  return rows.map(mapRosterOverride).filter((o) => o.employeeId);
}

export async function upsertRosterOverride(o: RosterOverride): Promise<void> {
  const { S, org } = await sdk();
  // One row per (employee, week, board): update in place if present.
  const existing = await list(RO_SET, { filter: roMatch(o) }).catch(() => [] as Row[]);
  if (existing.length > 0) {
    const id = s(existing[0]!.crfdf_rosteroverrideid);
    const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, RO_SET, id, rosterOverrideToRecord(o));
    if (!res.success) throw new Error(res.error?.message ?? "upsertRosterOverride(update) failed");
    return;
  }
  const rec = { crfdf_rosteroverrideid: o.id, ...rosterOverrideToRecord(o) };
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, RO_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "upsertRosterOverride(create) failed");
}

export async function deleteRosterOverrideFor(
  boardKind: string,
  weekStart: string,
  employeeId: string,
): Promise<void> {
  const { S, org } = await sdk();
  const existing = await list(RO_SET, { filter: roMatch({ employeeId, boardKind, weekStart }) }).catch(
    () => [] as Row[],
  );
  await Promise.all(
    existing.map((r) => S.DeleteRecordWithOrganization(org, RO_SET, s(r.crfdf_rosteroverrideid))),
  );
}

// ---------------------------------------------------------------------------
// Job schedule (crfdf_jobschedule) — per-job release/target/red dates
// ---------------------------------------------------------------------------
const JOBSCHED_SET = "crfdf_jobschedules";

// DateOnly columns: parse/format as a LOCAL calendar date (no tz shift) so a
// date entered as Jul 19 never displays as Jul 18 in a negative-offset zone.
const parseDateOnly = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  const [y, mo, d] = String(v).slice(0, 10).split("-").map(Number);
  return y ? new Date(y, (mo || 1) - 1, d || 1) : null;
};
const fmtDateOnly = (d: Date | null): string | null => {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

function mapJobSchedule(r: Row): JobSchedule {
  return {
    jobNo: s(r.crfdf_jobno),
    releasedDate: parseDateOnly(r.crfdf_releaseddate),
    productionCompleteDate: parseDateOnly(r.crfdf_productioncompletedate),
    scheduledInstallDate: parseDateOnly(r.crfdf_scheduledinstalldate),
    redDate: parseDateOnly(r.crfdf_reddate),
  };
}

function jobScheduleToRecord(sch: Partial<JobSchedule>): Row {
  const rec: Row = {};
  if (sch.jobNo !== undefined) {
    rec.crfdf_jobno = sch.jobNo;
    rec.crfdf_name = sch.jobNo || "Job";
  }
  if (sch.releasedDate !== undefined) rec.crfdf_releaseddate = fmtDateOnly(sch.releasedDate);
  // Only include the (newer) production-complete override column while it's known
  // to exist — otherwise a write that references a missing column fails wholesale,
  // taking the scheduled-install / red-date edits down with it.
  if (jobSchedProdCompleteCol && sch.productionCompleteDate !== undefined)
    rec.crfdf_productioncompletedate = fmtDateOnly(sch.productionCompleteDate);
  if (sch.scheduledInstallDate !== undefined)
    rec.crfdf_scheduledinstalldate = fmtDateOnly(sch.scheduledInstallDate);
  if (sch.redDate !== undefined) rec.crfdf_reddate = fmtDateOnly(sch.redDate);
  return rec;
}

export async function fetchJobSchedules(): Promise<JobSchedule[]> {
  const rows = await list(JOBSCHED_SET, {});
  return rows.map(mapJobSchedule).filter((sch) => sch.jobNo);
}

// The production-complete override column (crfdf_productioncompletedate) is
// newer than the rest; until it's created it must not poison other writes.
let jobSchedProdCompleteCol = true;
const missingProdCompleteCol = (msg: string) =>
  jobSchedProdCompleteCol && /crfdf_productioncompletedate/i.test(msg);

/** One row per job (keyed by crfdf_jobno): update in place, else create. */
export async function upsertJobSchedule(sch: JobSchedule): Promise<void> {
  const existing = await list(JOBSCHED_SET, {
    filter: `crfdf_jobno eq '${odataLit(sch.jobNo)}'`,
  }).catch(() => [] as Row[]);
  const id = existing.length > 0 ? s(existing[0]!.crfdf_jobscheduleid) : null;
  const run = () =>
    id
      ? dvUpdate(JOBSCHED_SET, id, jobScheduleToRecord(sch))
      : dvCreate(JOBSCHED_SET, { crfdf_jobscheduleid: uuid(), ...jobScheduleToRecord(sch) });
  let res = await run();
  if (!res.success && missingProdCompleteCol(res.error?.message ?? "")) {
    // Column not created yet — drop it and retry so the other dates still save.
    jobSchedProdCompleteCol = false;
    res = await run();
  }
  if (!res.success) throw new Error(res.error?.message ?? "upsertJobSchedule failed");
}

// ---------------------------------------------------------------------------
// Job department completions (crfdf_jobdeptcompletion) — production stepper
// ---------------------------------------------------------------------------
const JOBDEPT_SET = "crfdf_jobdeptcompletions";

export interface JobDeptCompletion {
  jobNo: string;
  deptKey: string;
  completedBy: string;
  completedDate: Date | null;
}

function mapJobDeptCompletion(r: Row): JobDeptCompletion {
  return {
    jobNo: s(r.crfdf_jobno),
    deptKey: s(r.crfdf_deptid),
    completedBy: s(r.crfdf_completedby),
    completedDate: parseDateOnly(r.crfdf_completeddate),
  };
}

export async function fetchJobDeptCompletions(): Promise<JobDeptCompletion[]> {
  const rows = await list(JOBDEPT_SET, {});
  return rows.map(mapJobDeptCompletion).filter((c) => c.jobNo && c.deptKey);
}

/** Mark a job's department complete (upsert by job + dept), stamping who + when. */
export async function addJobDeptCompletion(jobNo: string, deptKey: string, completedBy: string): Promise<void> {
  const { S, org } = await sdk();
  const match = `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_deptid eq '${odataLit(deptKey)}'`;
  const existing = await list(JOBDEPT_SET, { filter: match }).catch(() => [] as Row[]);
  const rec: Row = {
    crfdf_jobno: jobNo,
    crfdf_deptid: deptKey,
    crfdf_completedby: completedBy,
    crfdf_completeddate: fmtDateOnly(new Date()),
    crfdf_name: `${jobNo} ${deptKey}`.trim(),
  };
  if (existing.length > 0) {
    const id = s(existing[0]!.crfdf_jobdeptcompletionid);
    const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, JOBDEPT_SET, id, rec);
    if (!res.success) throw new Error(res.error?.message ?? "addJobDeptCompletion(update) failed");
    void enqueueBcPush(buildCompletionPush({ jobNo, deptKey, complete: true, completedBy }));
    return;
  }
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, JOBDEPT_SET, { crfdf_jobdeptcompletionid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "addJobDeptCompletion(create) failed");
  void enqueueBcPush(buildCompletionPush({ jobNo, deptKey, complete: true, completedBy }));
}

/** Un-complete a job's department (delete the completion row(s)). */
export async function removeJobDeptCompletion(jobNo: string, deptKey: string): Promise<void> {
  const { S, org } = await sdk();
  const match = `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_deptid eq '${odataLit(deptKey)}'`;
  const existing = await list(JOBDEPT_SET, { filter: match }).catch(() => [] as Row[]);
  await Promise.all(
    existing.map((r) => S.DeleteRecordWithOrganization(org, JOBDEPT_SET, s(r.crfdf_jobdeptcompletionid))),
  );
  void enqueueBcPush(buildCompletionPush({ jobNo, deptKey, complete: false }));
}

// ---------------------------------------------------------------------------
// Job department overrides (crfdf_jobdeptoverride) — editable production stepper
// ---------------------------------------------------------------------------
// Layer editor edits on top of the BC-derived stepper: force a department in
// (added) or out (removed) via `included`, and mark extra active steps via
// `active`. A row exists only when there's an override for that (job, dept).
const JOBOVR_SET = "crfdf_jobdeptoverrides";

export interface JobDeptOverride {
  jobNo: string;
  deptKey: string;
  included: boolean;
  active: boolean;
}

function mapJobDeptOverride(r: Row): JobDeptOverride {
  return {
    jobNo: s(r.crfdf_jobno),
    deptKey: s(r.crfdf_deptid),
    included: r.crfdf_included == null ? true : Boolean(r.crfdf_included),
    active: Boolean(r.crfdf_active),
  };
}

export async function fetchJobDeptOverrides(): Promise<JobDeptOverride[]> {
  const rows = await list(JOBOVR_SET, {});
  return rows.map(mapJobDeptOverride).filter((o) => o.jobNo && o.deptKey);
}

/** Upsert the override row for a (job, dept): `included` false = removed from the
 *  stepper, true = forced in (added); `active` = an extra editor-marked active. */
export async function setJobDeptOverride(
  jobNo: string,
  deptKey: string,
  included: boolean,
  active: boolean,
): Promise<void> {
  const { S, org } = await sdk();
  const match = `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_deptid eq '${odataLit(deptKey)}'`;
  const existing = await list(JOBOVR_SET, { filter: match }).catch(() => [] as Row[]);
  const rec: Row = {
    crfdf_jobno: jobNo,
    crfdf_deptid: deptKey,
    crfdf_included: included,
    crfdf_active: active,
    crfdf_name: `${jobNo} ${deptKey}`.trim(),
  };
  if (existing.length > 0) {
    const id = s(existing[0]!.crfdf_jobdeptoverrideid);
    const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, JOBOVR_SET, id, rec);
    if (!res.success) throw new Error(res.error?.message ?? "setJobDeptOverride(update) failed");
    return;
  }
  const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, JOBOVR_SET, { crfdf_jobdeptoverrideid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "setJobDeptOverride(create) failed");
}

/** Delete the override row(s) for a (job, dept) — back to the BC default. */
export async function clearJobDeptOverride(jobNo: string, deptKey: string): Promise<void> {
  const { S, org } = await sdk();
  const match = `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_deptid eq '${odataLit(deptKey)}'`;
  const existing = await list(JOBOVR_SET, { filter: match }).catch(() => [] as Row[]);
  await Promise.all(
    existing.map((r) => S.DeleteRecordWithOrganization(org, JOBOVR_SET, s(r.crfdf_jobdeptoverrideid))),
  );
}

/** Distinct PRODUCTION department names a job needs, from its BC planning lines.
 *  Used to detect vinyl/graphics-only jobs (shorter production target) and to
 *  build the production stepper. */
export async function jobProductionDepartments(jobNo: string): Promise<string[]> {
  const lines = await planningLinesFor(jobNo).catch(() => []);
  const names = new Set<string>();
  for (const l of lines) {
    if (!isProductionResource(l.resourceNo)) continue;
    const name = departmentNameForLine(l.resourceNo, l.description);
    if (name) names.add(name);
  }
  return [...names];
}

/** Production departments a job needs + whether it has installation labor —
 *  drives the production stepper (a final "Install" step when hasInstall). */
export async function jobStepInfo(jobNo: string): Promise<{ production: string[]; hasInstall: boolean }> {
  const lines = await planningLinesFor(jobNo).catch(() => []);
  const production = new Set<string>();
  let hasInstall = false;
  for (const l of lines) {
    if (isProductionResource(l.resourceNo)) {
      const name = departmentNameForLine(l.resourceNo, l.description);
      if (name) production.add(name);
    } else if (isInstallResource(l.resourceNo)) {
      hasInstall = true;
    }
  }
  return { production: [...production], hasInstall };
}

/**
 * Dev probe — verify the live reads end-to-end. Invoke `__probeLive()` in the
 * browser console under `pac code run`.
 */
export async function probeLive(): Promise<void> {
  try {
    const [depts, emps] = await Promise.all([
      liveProductionDataSource.loadDepartments(),
      liveProductionDataSource.loadEmployees(),
    ]);
    const from = new Date();
    from.setMonth(from.getMonth() - 6);
    const to = new Date();
    to.setMonth(to.getMonth() + 6);
    const lines = await liveProductionDataSource.loadScheduleLines(from, to);
    // eslint-disable-next-line no-console
    console.log(`[live] departments=${depts.length} employees=${emps.length} scheduleLines=${lines.length}`, { depts, emps, lines });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[live] probe failed:", err);
  }
}
