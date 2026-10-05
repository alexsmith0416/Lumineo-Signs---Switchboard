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
import {
  WRITE_ATTEMPTS,
  isRetryableWriteError,
  writeErrorMessage,
  writeRetryDelay,
} from "./dv-write";
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
import type { BillingPeriodRow } from "./billing-periods";
import { sharePointCustomer, type BcJobSummary, type JobTrack } from "./job-tracking";
import type { LeadTimeRule } from "./lead-times";
import type { CustomFieldDef, CustomValues } from "./custom-fields";
import type { LastPush } from "./bc-full-sync";
import type { StepPlanningLine } from "./step-queue";
import { sortJobPOs, type JobPO } from "./job-pos";
import type { JobDescriptions } from "./job-descriptions";
import {
  departmentNameForLine,
  isCratingLine,
  isInstallResource,
  isProductionResource,
  stepInfoFromLines,
} from "./planning-line-mapping";
import {
  bcStepForDepartmentName,
  buildStepSchedulePush,
  pushRowName,
  resourceNoByName,
  shouldSyncLine,
  stepWindow,
  type BcPerson,
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

interface SdkResult {
  success: boolean;
  error?: { message?: string };
  data?: unknown;
}

/**
 * Run a Dataverse write, retrying anything that isn't positively permanent.
 *
 * Handles BOTH failure shapes, which is the whole point: the SDK returns
 * `{success:false}` for connector-level errors but the host bridge REJECTS when
 * it isn't ready (the first write after load). The old version only looked at
 * the returned shape, so a rejection escaped unretried and the caller's board
 * reload erased the user's edit. See services/dv-write.ts for the policy.
 */
async function writeWithRetry(
  op: () => Promise<SdkResult>,
  attempts = WRITE_ATTEMPTS,
): Promise<SdkResult> {
  let lastMessage = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: SdkResult;
    try {
      res = await op();
    } catch (e) {
      // A thrown/rejected call — treat it exactly like a failed result.
      res = { success: false, error: { message: writeErrorMessage(e) } };
    }
    if (res.success) {
      if (attempt > 1) console.info(`[dv] write succeeded on attempt ${attempt}`);
      return res;
    }

    lastMessage = res.error?.message ?? "";
    if (!isRetryableWriteError(lastMessage)) return res; // the request itself is wrong
    if (attempt === attempts) break;

    if (isOrgUrlError(lastMessage)) _sdkPromise = null; // force an org re-resolve
    console.warn(`[dv] write attempt ${attempt} failed, retrying — ${lastMessage || "(no message)"}`);
    await new Promise((r) => setTimeout(r, writeRetryDelay(attempt)));
  }
  return { success: false, error: { message: lastMessage } };
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

// crfdf_splitgroup (links the parts of a task scheduled in sections) is newer
// still. Same treatment: drop it and retry rather than failing the whole write.
// Without it a split's parts keep their correct hours but lose their explicit
// link on reload — split-hours.ts falls back to same job+task+employee.
let splitGroupCol = true;
const missingSplitCol = (msg: string) => splitGroupCol && /crfdf_splitgroup/i.test(msg);

/** Turn off whichever newer column the server just rejected. Returns true when
 *  something was turned off, i.e. the caller should retry the write without it. */
function dropMissingCols(msg: string): boolean {
  let retry = false;
  if (missingSpanCol(msg)) {
    scheduleSpanCol = false;
    retry = true;
  }
  if (missingSplitCol(msg)) {
    splitGroupCol = false;
    retry = true;
  }
  return retry;
}

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

/**
 * Like `list`, but follows Dataverse paging past the 5,000-row page cap
 * (`@odata.nextLink` → `$skiptoken`) so a big table isn't silently truncated.
 * Use it for bulk reads that can grow (e.g. every BC planning line).
 */
async function listAll(
  entitySet: string,
  opts: { select?: string; filter?: string; orderby?: string } = {},
): Promise<Row[]> {
  const { S, org } = await sdk();
  const out: Row[] = [];
  let skiptoken: string | undefined;
  for (let page = 0; page < 50; page++) {
    const res = await S.ListRecordsWithOrganization(
      org, entitySet, PREFER_READ, ACCEPT, false, false,
      opts.select, opts.filter, opts.orderby, undefined, undefined, undefined, skiptoken,
    );
    if (!res.success) throw new Error(res.error?.message ?? `ListRecords(${entitySet}) failed`);
    const data = res.data as { value?: Row[]; "@odata.nextLink"?: string } | undefined;
    out.push(...(data?.value ?? []).map((it) => ((it as { dynamicProperties?: Row }).dynamicProperties ?? it) as Row));
    const next = data?.["@odata.nextLink"];
    const token = next ? new URL(next).searchParams.get("$skiptoken") : null;
    if (!token) break;
    skiptoken = token;
  }
  return out;
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
    splitGroupId: r.crfdf_splitgroup == null ? null : s(r.crfdf_splitgroup) || null,
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
  if (splitGroupCol && line.splitGroupId !== undefined) rec.crfdf_splitgroup = line.splitGroupId;
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
    const rows = await timed("production cards", list(SET.lines, { filter, orderby: "crfdf_startdatetime asc" }));
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
    if (!res.success && dropMissingCols(res.error?.message ?? "")) {
      res = await dvUpdate(SET.lines, id, toRecord(changes)); // retry without it
    }
    if (!res.success) throw new Error(res.error?.message ?? `UpdateRecord(${id}) failed`);
    const body = res.data as Row | undefined;
    const line = body && body.crfdf_productionschedulelineid ? mapLine(body) : ({ id, ...changes } as ScheduleLine);
    // Mirror a scheduling change (start/end/assignee) back to the BC planning
    // step. Only when one of those actually changed — not on lock/hours-only
    // edits. Fire-and-forget.
    if (changes.startDateTime !== undefined || changes.endDateTime !== undefined || changes.employeeId !== undefined) {
      void pushProductionStep(line);
    }
    return line;
  },

  async createScheduleLine(line: ScheduleLine): Promise<ScheduleLine> {
    // No crfdf_name — the primary-name column isn't crfdf_name on this table.
    let res = await dvCreate(SET.lines, toRecord(line));
    // A split part carries crfdf_splitgroup on CREATE, so the create path needs
    // the same drop-and-retry the update path has, or splitting would fail
    // outright on an org where the column hasn't been added yet.
    if (!res.success && dropMissingCols(res.error?.message ?? "")) {
      res = await dvCreate(SET.lines, toRecord(line));
    }
    if (!res.success) throw new Error(res.error?.message ?? `CreateRecord failed`);
    void pushProductionStep(line);
    // CreateRecord returns void; the new id is in the response location header
    // which the generated wrapper doesn't surface — return the input line. A
    // reload (loadWeek) picks up the server id. TODO: capture the created id.
    return line;
  },

  async deleteScheduleLine(id: string): Promise<void> {
    // Read the card first: once it's gone we can't tell which BC step to redo.
    const before = await lineById(SET.lines, "crfdf_productionschedulelineid", id, mapLine);
    const res = await dvDelete(SET.lines, id);
    if (!res.success) throw new Error(res.error?.message ?? `DeleteRecord(${id}) failed`);
    if (before) void pushProductionStep(before);
  },

  // --- Roster admin (right-click) on crfdf_employee1 ----------------------
  // Production employees carry a name and a department lookup (crfdf_department
  // → crfdf_department1, same target as the schedule-line lookup, so the same
  // nav property + entity set bind works here).
  async createResource(input: ResourceAdminInput): Promise<void> {
    const res = await dvCreate(SET.employees, employeeRecord(input));
    if (!res.success) throw new Error(res.error?.message ?? `CreateEmployee failed`);
  },
  async updateResource(id: string, input: ResourceAdminInput): Promise<void> {
    const res = await dvUpdate(SET.employees, id, employeeRecord(input));
    if (!res.success) throw new Error(res.error?.message ?? `UpdateEmployee(${id}) failed`);
  },
  async deleteResource(id: string): Promise<void> {
    const res = await dvDelete(SET.employees, id);
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
  const res = await dvCreate(INSTALL_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createAssistRow failed");
}

/** Edit an existing assist's days/halves (e.g. drop one day) without recreating
 *  it. Callers delete the row instead when no days remain. */
export async function updateAssistRow(
  id: string,
  input: { days: number[]; halves?: Record<number, "am" | "pm"> },
): Promise<void> {
  const halfEntries = Object.entries(input.halves ?? {});
  const withHalves: Row = {
    crfdf_assistdays: input.days.join(","),
    // Explicitly clear the half column when no half days remain.
    crfdf_assisthalves: halfEntries.map(([d, h]) => `${d}:${h}`).join(","),
  };
  let res = await dvUpdate(INSTALL_SET, id, withHalves);
  if (!res.success) {
    // Older orgs may not have crfdf_assisthalves provisioned — retry days only.
    res = await dvUpdate(INSTALL_SET, id, { crfdf_assistdays: input.days.join(",") });
  }
  if (!res.success) throw new Error(res.error?.message ?? `updateAssistRow(${id}) failed`);
}

export async function removeAssistRow(id: string): Promise<void> {
  const res = await dvDelete(INSTALL_SET, id);
  if (!res.success) throw new Error(res.error?.message ?? "removeAssistRow failed");
}

function createLiveInstallDataSource(
  isNek: boolean,
  locations: number[],
): ScheduleDataSource {
  const region: InstallRegionKey = isNek ? "nek" : "wk";
  // Every card in this region, with BC's name / remaining value / salesperson /
  // SharePoint link and BC-derived crew filled in. The BC lookups are cached
  // bulk reads, and none of them can stop the board loading — a card just
  // shows without that detail.
  const REGION_READ_TTL_MS = 5_000;
  let regionRead: { at: number; p: Promise<ScheduleLine[]> } | null = null;
  const orEmpty = <K, V>(p: Promise<Map<K, V>>, what: string): Promise<Map<K, V>> =>
    p.catch((e) => {
      console.warn(`[install] couldn't read ${what}`, e);
      return new Map<K, V>();
    });
  const readRegionCards = async (): Promise<ScheduleLine[]> => {
    const rows = await timed(`${region} install cards`, list(SHIP.cards, { filter: `crfdf_region eq ${isNek}` }));
    const mapped = rows.map(mapCardRecord);
    const crewJobs = mapped.filter((l) => l.jobNo && !hasManualCrew(l)).map((l) => l.jobNo);
    const [meta, salesByJob, spByJob, planning] = await Promise.all([
      orEmpty(timed("BC job values", bcJobMetaByJobNo()), "BC jobs"),
      orEmpty(timed("BC salespeople", salespersonByJobNo()), "salespeople"),
      orEmpty(timed("SharePoint links", sharepointUrlByJobNo()), "SharePoint links"),
      orEmpty(timed(`${region} crew planning lines`, planningLinesForJobs(crewJobs)), "planning lines"),
    ]);
    // Auto-fill crew (trips/men/trucks) from BC planning lines for any card
    // that has no manually-entered crew (crfdf_crew* still wins).
    const crewByJob = new Map<string, BcJobCrew>();
    for (const jn of new Set(crewJobs)) {
      const lines = planning.get(jn);
      const c = lines ? deriveCrewFromLines(lines.map((l) => ({ ...l, estimatedHours: l.hours }))) : null;
      if (c) crewByJob.set(jn, c);
    }
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
    return all;
  };
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
      // The board, its Billing stat and the Monthly Plan all read the whole
      // region — share one read for a few seconds instead of repeating it.
      if (!regionRead || Date.now() - regionRead.at > REGION_READ_TTL_MS) {
        const p = readRegionCards();
        regionRead = { at: Date.now(), p };
        p.catch(() => {
          if (regionRead?.p === p) regionRead = null;
        });
      }
      const all = await regionRead.p;
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
      regionRead = null; // the next load must see this change
      let res = await dvUpdate(SHIP.cards, id, cardToRecord(changes, isNek, false));
      if (!res.success && (installExtraColsAvailable || dropMissingCols(res.error?.message ?? ""))) {
        // Newer columns may be missing — drop them and retry so the edit sticks.
        installExtraColsAvailable = false;
        res = await dvUpdate(SHIP.cards, id, cardToRecord(changes, isNek, false));
      }
      if (!res.success) throw new Error(res.error?.message ?? `UpdateInstallCard(${id}) failed`);
      const body = res.data as Row | undefined;
      const line = body?.crfdf_installcardid ? mapCardRecord(body) : ({ id, ...changes } as ScheduleLine);
      cacheUpdateCard(region, id, line);
      // Mirror an install-step scheduling change back to BC (same outbox as
      // production). Only on a start/end/assignee change; fire-and-forget.
      if (changes.startDateTime !== undefined || changes.endDateTime !== undefined || changes.employeeId !== undefined) {
        void pushInstallStep(line);
      }
      return line;
    },
    async createScheduleLine(line: ScheduleLine): Promise<ScheduleLine> {
      regionRead = null; // the next load must see this change
      const id = uuid();
      const rec = () => ({ crfdf_installcardid: id, ...cardToRecord(line, isNek, true) });
      let res = await dvCreate(SHIP.cards, rec());
      if (!res.success && (installExtraColsAvailable || dropMissingCols(res.error?.message ?? ""))) {
        // Newer columns may be missing — drop them and retry so the card saves.
        // The record is REBUILT here: the original payload still carried the
        // columns we just turned off, so resending it would fail identically.
        installExtraColsAvailable = false;
        res = await dvCreate(SHIP.cards, rec());
      }
      if (!res.success) throw new Error(res.error?.message ?? "CreateInstallCard failed");
      const created = { ...line, id };
      cacheAddCard(region, created);
      void pushInstallStep(created);
      return created;
    },
    async deleteScheduleLine(id: string): Promise<void> {
      regionRead = null; // the next load must see this change
      const before = await lineById(SHIP.cards, "crfdf_installcardid", id, mapCardRecord);
      const res = await dvDelete(SHIP.cards, id);
      if (!res.success) throw new Error(res.error?.message ?? `DeleteInstallCard(${id}) failed`);
      cacheRemoveCard(region, id);
      if (before) void pushInstallStep(before);
    },

    // Roster admin (right-click): create / edit / delete a crew row on
    // crfdf_InstallationEmployees. Region/location are scalar columns (Two
    // Option / Picklist), so no @odata.bind — just plain values.
    async createResource(input: ResourceAdminInput): Promise<void> {
      const res = await dvCreate(INSTALL_SET, installRecord(input));
      if (!res.success) throw new Error(res.error?.message ?? `CreateCrew failed`);
    },
    async updateResource(id: string, input: ResourceAdminInput): Promise<void> {
      const res = await dvUpdate(INSTALL_SET, id, installRecord(input));
      if (!res.success) throw new Error(res.error?.message ?? `UpdateCrew(${id}) failed`);
    },
    async deleteResource(id: string): Promise<void> {
      const res = await dvDelete(INSTALL_SET, id);
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
    splitGroupId: r.crfdf_splitgroup == null ? null : s(r.crfdf_splitgroup) || null,
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
  if (splitGroupCol && line.splitGroupId !== undefined) rec.crfdf_splitgroup = line.splitGroupId;
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

// All shipment writes below go through the retrying dv* helpers: a load is
// edited field-by-field as the user types, and a reorder rewrites several rows
// at once — a transient blip mid-reorder would otherwise leave the saved order
// half-applied and scramble the list on the next reload.
export async function createLoadRecord(load: ShipmentLoad): Promise<void> {
  const rec = { crfdf_shipmentloadid: load.id, ...loadToRecord(load) };
  const res = await dvCreate(SHIP.loads, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createLoad failed");
}
export async function updateLoadRecord(id: string, patch: Partial<ShipmentLoad>): Promise<void> {
  const res = await dvUpdate(SHIP.loads, id, loadToRecord(patch));
  if (!res.success) throw new Error(res.error?.message ?? "updateLoad failed");
}
export async function deleteLoadRecord(id: string): Promise<void> {
  await dvDelete(SHIP.loads, id);
}
export async function createItemRecord(loadId: string, item: ShipmentItem, sort: number): Promise<void> {
  const rec = { crfdf_shipmentitemid: item.id, ...itemToRecord(item, sort, loadId) };
  const res = await dvCreate(SHIP.items, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createItem failed");
}
export async function updateItemRecord(id: string, patch: Partial<ShipmentItem>): Promise<void> {
  const res = await dvUpdate(SHIP.items, id, itemToRecord(patch, undefined, undefined));
  if (!res.success) throw new Error(res.error?.message ?? "updateItem failed");
}
/** Persist a load's item order. Writes only the rows whose position changed. */
export async function updateItemSortRecords(entries: Array<{ id: string; sort: number }>): Promise<void> {
  const results = await Promise.all(
    entries.map(async (e) => dvUpdate(SHIP.items, e.id, { crfdf_sortorder: e.sort })),
  );
  const failed = results.find((r) => !r.success);
  if (failed) throw new Error(failed.error?.message ?? "reorderItems failed");
}
export async function deleteItemRecord(id: string): Promise<void> {
  await dvDelete(SHIP.items, id);
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
// row here; a Dataverse-triggered Power Automate flow drains it, writes BC,
// and writes the row's status back.
//
// `crfdf_kind` routes the row to a flow, and is a plain string column, so
// adding a kind needs NO Dataverse script:
//   "schedule" / "state" → one BC planning STEP per (job, catalogue step),
//      drained by BCPush_PlanningSteps into our own web service
//      LumineoProjectPlanning (bc/lumineo-planning-ext). crfdf_planningstep is
//      the BC step name ("Fabrication"); a schedule row carries the whole step
//      window in crfdf_startdatetime/enddatetime, a state row the step's
//      crfdf_started/crfdf_complete mirrored from the production stepper
//      (store/bc-stepper-push.ts). Rows queued before Sep 28, 2026 used the old
//      per-card shape (planning-LINE text) and must be retired, not drained.
//   "job" → PATCH jobs('<jobNo>'), which IS writable as of Sep 11, 2026.
//      Drained by BCPush_JobCompletion. Reuses existing columns:
//      crfdf_complete = the flag, crfdf_enddatetime = the completion date.
// See flows/BCPush_PlanningSteps.md + flows/BCPush_JobCompletion.md.
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
 * Enqueue a BC push (planning step or job — see `crfdf_kind` above).
 * FIRE-AND-FORGET by contract: enqueuing must never block or fail a board
 * commit, so all errors are swallowed + logged. A null push (non-BC / custom
 * line, or a job push with no job no) is a no-op.
 */
export async function enqueueBcPush(push: BcPlanningPush | null): Promise<void> {
  if (!push) return;
  try {
    await dvCreate(BCPUSH_SET, pushToRecord(push));
  } catch (e) {
    console.warn("[bc-sync] enqueue failed (non-blocking)", e);
  }
}

// Department id → name, for mapping a production card to its BC step. Cached
// for the session (departments change about never); a failed read is retried.
let departmentNamesP: Promise<Map<string, string>> | null = null;
function departmentNames(): Promise<Map<string, string>> {
  departmentNamesP ??= list(SET.departments, { select: "crfdf_department1id,crfdf_departmentname" })
    .then((rows) => new Map(rows.map((d) => [s(d.crfdf_department1id), s(d.crfdf_departmentname)] as const)))
    .catch((e) => {
      departmentNamesP = null;
      throw e;
    });
  return departmentNamesP;
}

/** One row by id, mapped — null when it can't be read. Used before a delete. */
async function lineById(
  set: string,
  idCol: string,
  id: string,
  map: (r: Row) => ScheduleLine,
): Promise<ScheduleLine | null> {
  try {
    const rows = await list(set, { filter: `${idCol} eq ${id}` });
    return rows[0] ? map(rows[0]) : null;
  } catch {
    return null;
  }
}

const bcResourceNo = (employeeId: string): string =>
  isLaneEmployeeId(employeeId) ? "" : employeeResourceNo.get(employeeId) ?? "";

/**
 * Recompute a (job, BC step) window from EVERY card of the job that maps to
 * the step — not just the loaded week — and enqueue it. Fire-and-forget like
 * `enqueueBcPush`: never blocks or fails a board commit. When no card remains
 * nothing is pushed, so BC keeps its last dates rather than being cleared.
 */
async function enqueueStepSchedule(
  jobNo: string,
  step: string,
  cards: () => Promise<ScheduleLine[]>,
  sourceLineId: string,
  /** Resolves the card employeeId → BC Resource No. lookup for this board. */
  resourceLookup: () => Promise<(employeeId: string) => string> = async () => bcResourceNo,
): Promise<void> {
  try {
    const [lines, resourceNoFor] = await Promise.all([cards(), resourceLookup()]);
    const window = stepWindow(lines, resourceNoFor);
    await enqueueBcPush(buildStepSchedulePush({ jobNo, step, window, sourceLineId }));
  } catch (e) {
    console.warn("[bc-sync] step recompute failed (non-blocking)", e);
  }
}

async function pushProductionStep(line: ScheduleLine): Promise<void> {
  if (!shouldSyncLine(line)) return;
  try {
    const names = await departmentNames();
    const step = bcStepForDepartmentName(names.get(line.departmentId));
    if (!step) return;
    await enqueueStepSchedule(
      line.jobNo,
      step,
      async () =>
        (await list(SET.lines, { filter: `crfdf_jobno eq '${odataLit(line.jobNo)}'` }))
          .map(mapLine)
          .filter((l) => bcStepForDepartmentName(names.get(l.departmentId)) === step),
      line.id,
    );
  } catch (e) {
    console.warn("[bc-sync] step recompute failed (non-blocking)", e);
  }
}

// App-user directory as BC people, for naming install crew. Cached for the
// session like the department names; a failed read is retried next time.
let bcPeopleP: Promise<BcPerson[]> | null = null;
function bcPeople(): Promise<BcPerson[]> {
  bcPeopleP ??= list(APPUSER_SET, { select: "crfdf_displayname,crfdf_usertype,crfdf_no" })
    .then((rows) =>
      rows.map((r) => ({
        displayName: s(r.crfdf_displayname),
        userType: s(r.crfdf_usertype).trim().toLowerCase(),
        bcNo: s(r.crfdf_no).trim(),
      })),
    )
    .catch((e) => {
      bcPeopleP = null;
      throw e;
    });
  return bcPeopleP;
}

/** Install crew have no BC Resource No. column; their roster names are short
 *  ("Doug", "Justin F"), so resolve them against the app-user directory by
 *  name — see `resourceNoByName`. Unresolvable → "" (BC assignee untouched). */
async function installResourceLookup(): Promise<(employeeId: string) => string> {
  const [crew, people] = await Promise.all([
    list(INSTALL_SET, { select: "crfdf_installationemployeesid,crfdf_employeename" }),
    bcPeople(),
  ]);
  const nameById = new Map(crew.map((r) => [s(r.crfdf_installationemployeesid), s(r.crfdf_employeename)] as const));
  return (employeeId) => resourceNoByName(nameById.get(employeeId) ?? "", people);
}

function pushInstallStep(line: ScheduleLine): Promise<void> {
  if (!shouldSyncLine(line)) return Promise.resolve();
  return enqueueStepSchedule(
    line.jobNo,
    "Install",
    async () =>
      (await list(SHIP.cards, { filter: `crfdf_jobno eq '${odataLit(line.jobNo)}'` }))
        .map(mapCardRecord)
        // A shipment-load card is a delivery run, not install labor.
        .filter((c) => !c.shipmentLoadId),
    line.id,
    installResourceLookup,
  );
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

/**
 * Where ONE job sits on the boards right now — every production card, install
 * card and shipment load for it, earliest first (all dates, not just upcoming).
 * The Jobs view's job panel shows these so the list and the boards agree.
 */
export async function jobPlacements(jobNo: string): Promise<ActivePlacement[]> {
  const filter = `crfdf_jobno eq '${odataLit(jobNo)}'`;
  const [prodRows, cardRows, names, loads] = await Promise.all([
    list(SET.lines, { filter }),
    list(SHIP.cards, { filter }),
    departmentNames(),
    fetchShipmentLoads(),
  ]);
  const out: ActivePlacement[] = [];
  for (const r of prodRows) {
    const l = mapLine(r);
    if (l.isCustom) continue;
    const dn = names.get(l.departmentId);
    out.push({ kind: "production", label: dn ? `Production · ${dn}` : "Production", date: l.startDateTime });
  }
  for (const r of cardRows) {
    const c = mapCardRecord(r);
    if (c.isCustom || c.shipmentLoadId) continue;
    out.push({ kind: "installation", label: c.region ? `Installation · ${c.region}` : "Installation", date: c.startDateTime });
  }
  for (const load of loads) {
    if (load.items.some((it) => it.jobNo === jobNo)) {
      out.push({ kind: "shipping", label: `Shipping · ${load.name}`, date: load.shipDate });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
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

// Session cache: install ZIP + day → forecast (lum_weathercaches, one row per
// lum_location = ZIP per lum_date; written by the WeatherCache_Refresh flow).
export interface WeatherInfo {
  tempF: number;
  condition: string;
  iconUrl: string;
  humidity: number;
}
// DateOnly (lum_date) comes back as "2026-07-13" (or full ISO); keep the day part.
const weatherDateKey = (v: unknown): string => s(v).trim().slice(0, 10);

/** How far back to read forecast rows. The flow never deletes old rows, so the
 *  table grows ~one row per ZIP per day; an unfiltered read passed Dataverse's
 *  5000-row page and silently dropped the CURRENT forecasts (Sep 2026). */
export const WEATHER_LOOKBACK_DAYS = 14;

/** Server-side filter for the weather read: dated rows from `today` minus the
 *  lookback onward. Legacy dateless rows are excluded — the flow stopped writing
 *  them in Jul 2026, so they only ever showed months-old conditions. */
export function weatherFilter(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - WEATHER_LOOKBACK_DAYS);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `lum_date ge ${key}`;
}

/** Map of per-day forecasts keyed `${zip}|${yyyy-mm-dd}`. */
export function buildWeatherMap(rows: Row[]): Map<string, WeatherInfo> {
  const m = new Map<string, WeatherInfo>();
  for (const r of rows) {
    const loc = s(r.lum_location).trim();
    const date = weatherDateKey(r.lum_date);
    if (!loc || !date) continue;
    m.set(`${loc}|${date}`, {
      tempF: n(r.lum_tempf),
      condition: s(r.lum_conditiontext),
      iconUrl: s(r.lum_iconurl),
      humidity: n(r.lum_humidity),
    });
  }
  return m;
}

let weatherPromise: Promise<Map<string, WeatherInfo>> | null = null;
export function weatherByZip(): Promise<Map<string, WeatherInfo>> {
  if (!weatherPromise) {
    weatherPromise = list("lum_weathercaches", {
      select: "lum_location,lum_date,lum_tempf,lum_conditiontext,lum_iconurl,lum_humidity",
      filter: weatherFilter(new Date()),
      // Newest first, so if the page cap is ever hit it's the oldest days that drop.
      orderby: "lum_date desc",
    })
      .then(buildWeatherMap)
      .catch(() => new Map<string, WeatherInfo>());
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
  const rec = { crfdf_jobqueuegroupid: g.id, ...queueGroupToRecord(g) };
  const res = await dvCreate(QUEUE.groups, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createQueueGroup failed");
}

export async function updateQueueGroup(id: string, changes: Partial<QueueGroup>): Promise<void> {
  const res = await dvUpdate(QUEUE.groups, id, queueGroupToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateQueueGroup(${id}) failed`);
}

/** Delete a group and all of its parked items. */
export async function deleteQueueGroup(id: string, itemIds: string[]): Promise<void> {
  await Promise.all(itemIds.map((iid) => dvDelete(QUEUE.items, iid)));
  const res = await dvDelete(QUEUE.groups, id);
  if (!res.success) throw new Error(res.error?.message ?? `deleteQueueGroup(${id}) failed`);
}

export async function createQueueItem(it: QueueItem): Promise<void> {
  const rec = { crfdf_jobqueueitemid: it.id, ...queueItemToRecord(it) };
  const res = await dvCreate(QUEUE.items, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createQueueItem failed");
}

export async function updateQueueItem(id: string, changes: Partial<QueueItem>): Promise<void> {
  const res = await dvUpdate(QUEUE.items, id, queueItemToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateQueueItem(${id}) failed`);
}

export async function deleteQueueItem(id: string): Promise<void> {
  const res = await dvDelete(QUEUE.items, id);
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
  const rec = { crfdf_customcardpresetid: p.id, ...cardPresetToRecord(p) };
  const res = await dvCreate(CARD_PRESET_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createCardPreset failed");
}

export async function updateCardPreset(id: string, changes: Partial<SavedCardPreset>): Promise<void> {
  const res = await dvUpdate(CARD_PRESET_SET, id, cardPresetToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateCardPreset(${id}) failed`);
}

export async function deleteCardPreset(id: string): Promise<void> {
  const res = await dvDelete(CARD_PRESET_SET, id);
  if (!res.success) throw new Error(res.error?.message ?? `deleteCardPreset(${id}) failed`);
}

// ---------------------------------------------------------------------------
// Job tracking (crfdf_jobtrack) — the Airtable "Expeditor" fields BC doesn't
// hold, one row per job. Created by scripts/create-jobtrack-table.ps1, seeded by
// the Airtable import. Model + join: services/job-tracking.ts.
// ---------------------------------------------------------------------------
const JOBTRACK_SET = "crfdf_jobtracks";

export async function fetchJobTracks(): Promise<JobTrack[]> {
  const rows = await list(JOBTRACK_SET, {});
  return rows
    .map((r) => ({
      id: s(r.crfdf_jobtrackid),
      jobNo: s(r.crfdf_jobno).trim(),
      jobName: s(r.crfdf_jobname),
      statusOverride: s(r.crfdf_statusoverride),
      priority: s(r.crfdf_priority),
      holdReason: s(r.crfdf_holdreason),
      dateToHold: s(r.crfdf_datetohold),
      dateOffHold: s(r.crfdf_dateoffhold),
      priorHoldDays: n(r.crfdf_priorholddays),
      orderDate: s(r.crfdf_orderdate),
      mfgFinalDate: s(r.crfdf_mfgfinaldate),
      expeditorDate: s(r.crfdf_expeditordate),
      dateInstalled: s(r.crfdf_dateinstalled),
      dateToAdmin: s(r.crfdf_datetoadmin),
      dateInvoiced: s(r.crfdf_dateinvoiced),
      vendor: s(r.crfdf_vendor),
      poNumber: s(r.crfdf_ponumber),
      vendorStatus: s(r.crfdf_vendorstatus),
      storageLocation: s(r.crfdf_storagelocation),
      vendorShipDate: s(r.crfdf_vendorshipdate),
      vendorShipDate2: s(r.crfdf_vendorshipdate2),
      outsourcedArrival: s(r.crfdf_outsourcedarrival),
      graphics: s(r.crfdf_graphics),
      routingType: s(r.crfdf_routingtype),
      powerlines: s(r.crfdf_powerlines),
      sales: s(r.crfdf_sales),
      salesOverride: s(r.crfdf_salesoverride),
      location: s(r.crfdf_location),
      region: s(r.crfdf_region),
      mfgRegion: s(r.crfdf_mfgregion),
      installRegion: s(r.crfdf_installregion),
      ulSign: Boolean(r.crfdf_ulsign),
      notes: s(r.crfdf_notes),
      legacyStatus: s(r.crfdf_legacystatus),
      legacyProcess: s(r.crfdf_legacyprocess),
      customValues: parseJsonObject(r.crfdf_customvalues),
    }))
    .filter((t) => t.jobNo);
}

/** A JSON object column, or {} when blank / not JSON / not an object. */
function parseJsonObject(v: unknown): Record<string, unknown> {
  if (typeof v !== "string" || !v.trim()) return {};
  try {
    const o = JSON.parse(v) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// crfdf_salesorderamount is added by scripts/add-jobs-name-value-columns.ps1;
// until it exists the Jobs list reads without it (Value falls back).
let orderAmountCol = true;

/** Every open BC job, summarised for the Jobs view. */
export async function fetchBcJobSummaries(): Promise<BcJobSummary[]> {
  const base =
    "crfdf_jobnumber,crfdf_appjobname,crfdf_customername,crfdf_description,crfdf_remainingbalance," +
    "crfdf_shiptoaddress,crfdf_shiptocity,crfdf_shiptostate,crfdf_shiptozip,crfdf_salespersoncode,crfdf_sharepointurl,crfdf_releasedate";
  let rows: Row[];
  try {
    rows = await list(BC.jobs, { select: orderAmountCol ? `${base},crfdf_salesorderamount` : base });
  } catch (e) {
    if (!orderAmountCol || !/salesorderamount/i.test(e instanceof Error ? e.message : String(e))) throw e;
    orderAmountCol = false;
    rows = await list(BC.jobs, { select: base });
  }
  return rows
    .map((r) => ({
      jobNo: s(r.crfdf_jobnumber).trim(),
      name: s(r.crfdf_appjobname) || s(r.crfdf_customername),
      description: s(r.crfdf_description),
      remaining: n(r.crfdf_remainingbalance),
      city: s(r.crfdf_shiptocity),
      state: s(r.crfdf_shiptostate),
      address: s(r.crfdf_shiptoaddress),
      zip: s(r.crfdf_shiptozip),
      salesperson: s(r.crfdf_salespersoncode).trim().toUpperCase(),
      folderName: sharePointCustomer(s(r.crfdf_sharepointurl)),
      sharepointUrl: s(r.crfdf_sharepointurl).trim(),
      orderAmount: r.crfdf_salesorderamount == null ? null : n(r.crfdf_salesorderamount),
      releaseDate: r.crfdf_releasedate == null ? "" : String(r.crfdf_releasedate).slice(0, 10),
    }))
    .filter((j) => j.jobNo);
}

/** Tracking fields the app edits, by JobTrack key → crfdf_jobtrack column. */
const JOBTRACK_COLS = {
  jobName: "crfdf_jobname",
  statusOverride: "crfdf_statusoverride",
  holdReason: "crfdf_holdreason",
  dateToHold: "crfdf_datetohold",
  dateOffHold: "crfdf_dateoffhold",
  priorHoldDays: "crfdf_priorholddays",
  priority: "crfdf_priority",
  expeditorDate: "crfdf_expeditordate",
  dateInstalled: "crfdf_dateinstalled",
  dateToAdmin: "crfdf_datetoadmin",
  dateInvoiced: "crfdf_dateinvoiced",
  vendor: "crfdf_vendor",
  poNumber: "crfdf_ponumber",
  vendorStatus: "crfdf_vendorstatus",
  storageLocation: "crfdf_storagelocation",
  vendorShipDate: "crfdf_vendorshipdate",
  vendorShipDate2: "crfdf_vendorshipdate2",
  outsourcedArrival: "crfdf_outsourcedarrival",
  graphics: "crfdf_graphics",
  routingType: "crfdf_routingtype",
  powerlines: "crfdf_powerlines",
  mfgRegion: "crfdf_mfgregion",
  installRegion: "crfdf_installregion",
  ulSign: "crfdf_ulsign",
  notes: "crfdf_notes",
  salesOverride: "crfdf_salesoverride",
} as const;
export type JobTrackPatch = Partial<Pick<JobTrack, keyof typeof JOBTRACK_COLS>>;

// crfdf_priorholddays is added by scripts/add-jobtrack-hold-columns.ps1; until
// it exists a save drops it and retries (a second hold's DOH then undercounts).
let priorHoldCol = true;

/** Save tracking fields for a job — updates its crfdf_jobtrack row, or creates
 *  one (a job BC opened that nobody has tracked yet). Returns the row id. */
export async function saveJobTrack(jobNo: string, id: string | undefined, patch: JobTrackPatch): Promise<string> {
  const rec: Row = {};
  for (const [k, col] of Object.entries(JOBTRACK_COLS)) {
    const v = patch[k as keyof JobTrackPatch];
    if (v !== undefined) rec[col] = v;
  }
  if (!priorHoldCol) delete rec.crfdf_priorholddays;
  let rowId = id;
  if (!rowId) {
    const existing = await list(JOBTRACK_SET, { select: "crfdf_jobtrackid", filter: `crfdf_jobno eq '${odataLit(jobNo)}'` });
    rowId = existing[0] ? s(existing[0].crfdf_jobtrackid) : undefined;
  }
  const newId = rowId ?? uuid();
  const write = () =>
    rowId
      ? dvUpdate(JOBTRACK_SET, rowId, rec)
      : dvCreate(JOBTRACK_SET, { crfdf_jobtrackid: newId, crfdf_jobno: jobNo, crfdf_name: jobNo, ...rec });
  let res = await write();
  if (!res.success && "crfdf_priorholddays" in rec && /priorholddays/i.test(res.error?.message ?? "")) {
    priorHoldCol = false;
    delete rec.crfdf_priorholddays;
    res = await write();
  }
  if (!res.success) throw new Error(res.error?.message ?? "saveJobTrack failed");
  return newId;
}

// ---------------------------------------------------------------------------
// Billing periods (crfdf_billingperiod) — one row per month: the billing
// cut-off date ("YYYY-MM-DD" text, so no time zone can shift it) and the
// month's goal. Created by scripts/create-billingperiod-table.ps1. Rules live
// in services/billing-periods.ts.
// ---------------------------------------------------------------------------
const BILLING_SET = "crfdf_billingperiods";

export async function fetchBillingPeriods(): Promise<BillingPeriodRow[]> {
  const rows = await list(BILLING_SET, { select: "crfdf_month,crfdf_cutoffdate,crfdf_goal" });
  return rows
    .map((r) => ({
      month: s(r.crfdf_month).trim(),
      cutoff: s(r.crfdf_cutoffdate).trim() || null,
      goal: r.crfdf_goal == null ? null : n(r.crfdf_goal),
    }))
    .filter((r) => /^\d{4}-\d{2}$/.test(r.month));
}

// ---------------------------------------------------------------------------
// Lead-time rules (crfdf_leadtimerule) — the Jobs list's Mfg / Install target
// lead times by step combination. Created by scripts/create-leadtimerule-table.ps1.
// Rules live in services/lead-times.ts.
// ---------------------------------------------------------------------------
const LEADTIME_SET = "crfdf_leadtimerules";

/** Every rule in list order. Throws when the table doesn't exist yet. */
export async function fetchLeadTimeRules(): Promise<LeadTimeRule[]> {
  const rows = await list(LEADTIME_SET, {
    select: "crfdf_leadtimeruleid,crfdf_name,crfdf_steps,crfdf_match,crfdf_productionweeks,crfdf_installweeks,crfdf_sortorder",
  });
  return rows
    .map((r) => ({
      id: s(r.crfdf_leadtimeruleid),
      name: s(r.crfdf_name),
      steps: s(r.crfdf_steps).split(",").map((k) => k.trim()).filter(Boolean),
      match: (s(r.crfdf_match) === "includes" ? "includes" : "only") as LeadTimeRule["match"],
      productionWeeks: n(r.crfdf_productionweeks, 7),
      installWeeks: n(r.crfdf_installweeks, 10),
      order: n(r.crfdf_sortorder),
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...rule }) => rule);
}

/** Replace the saved rules with `rules` (in this order). Returns them with ids. */
export async function saveLeadTimeRules(rules: readonly LeadTimeRule[]): Promise<LeadTimeRule[]> {
  const existing = await list(LEADTIME_SET, { select: "crfdf_leadtimeruleid" });
  const keep = new Set(rules.map((r) => r.id).filter(Boolean));
  const saved: LeadTimeRule[] = [];
  for (const [i, rule] of rules.entries()) {
    const rec: Row = {
      crfdf_name: rule.name || "Rule",
      crfdf_steps: rule.steps.join(","),
      crfdf_match: rule.match,
      crfdf_productionweeks: rule.productionWeeks,
      crfdf_installweeks: rule.installWeeks,
      crfdf_sortorder: i,
    };
    const id = rule.id || uuid();
    const res = rule.id
      ? await dvUpdate(LEADTIME_SET, id, rec)
      : await dvCreate(LEADTIME_SET, { crfdf_leadtimeruleid: id, ...rec });
    if (!res.success) throw new Error(res.error?.message ?? "saveLeadTimeRules failed");
    saved.push({ ...rule, id });
  }
  for (const r of existing) {
    const id = s(r.crfdf_leadtimeruleid);
    if (id && !keep.has(id)) {
      const res = await dvDelete(LEADTIME_SET, id);
      if (!res.success) throw new Error(res.error?.message ?? "saveLeadTimeRules (delete) failed");
    }
  }
  return saved;
}

// ---------------------------------------------------------------------------
// Custom fields — definitions in crfdf_jobfield (one row per field, its options
// / colours / formula in crfdf_config JSON), values in crfdf_jobtrack.
// crfdf_customvalues (JSON keyed by field). Created by
// scripts/create-customfield-schema.ps1. Rules live in services/custom-fields.ts.
// ---------------------------------------------------------------------------
const JOBFIELD_SET = "crfdf_jobfields";

/** Every custom field, in column order. Throws when the table doesn't exist yet. */
export async function fetchCustomFieldDefs(): Promise<CustomFieldDef[]> {
  const rows = await list(JOBFIELD_SET, {
    select: "crfdf_jobfieldid,crfdf_name,crfdf_fieldkey,crfdf_type,crfdf_width,crfdf_config,crfdf_sortorder",
  });
  return rows
    .map((r) => {
      const cfg = parseJsonObject(r.crfdf_config);
      return {
        order: n(r.crfdf_sortorder),
        def: {
          key: s(r.crfdf_fieldkey),
          label: s(r.crfdf_name),
          type: s(r.crfdf_type, "text") as CustomFieldDef["type"],
          width: n(r.crfdf_width, 150),
          ...(Array.isArray(cfg.opts) ? { opts: cfg.opts as string[] } : {}),
          ...(cfg.optColors && typeof cfg.optColors === "object" ? { optColors: cfg.optColors as Record<string, string> } : {}),
          ...(cfg.formula && typeof cfg.formula === "object" ? { formula: cfg.formula as CustomFieldDef["formula"] } : {}),
        } satisfies CustomFieldDef,
      };
    })
    .filter((x) => x.def.key)
    .sort((a, b) => a.order - b.order)
    .map((x) => x.def);
}

/** Create or update one field definition (keyed by crfdf_fieldkey). */
export async function saveCustomFieldDef(def: CustomFieldDef, order: number): Promise<void> {
  const rec: Row = {
    crfdf_name: def.label || "Field",
    crfdf_fieldkey: def.key,
    crfdf_type: def.type,
    crfdf_width: Math.round(def.width),
    crfdf_config: JSON.stringify({ opts: def.opts, optColors: def.optColors, formula: def.formula }),
    crfdf_sortorder: order,
  };
  const existing = await list(JOBFIELD_SET, { select: "crfdf_jobfieldid", filter: `crfdf_fieldkey eq '${odataLit(def.key)}'` });
  const res = existing[0]
    ? await dvUpdate(JOBFIELD_SET, s(existing[0].crfdf_jobfieldid), rec)
    : await dvCreate(JOBFIELD_SET, { crfdf_jobfieldid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "saveCustomFieldDef failed");
}

/** Delete a field definition. Its values stay in the jobs' JSON, unused. */
export async function deleteCustomFieldDef(key: string): Promise<void> {
  const existing = await list(JOBFIELD_SET, { select: "crfdf_jobfieldid", filter: `crfdf_fieldkey eq '${odataLit(key)}'` });
  for (const r of existing) {
    const res = await dvDelete(JOBFIELD_SET, s(r.crfdf_jobfieldid));
    if (!res.success) throw new Error(res.error?.message ?? "deleteCustomFieldDef failed");
  }
}

/**
 * Set one custom value on a job. Re-reads the job's values first and merges
 * just this field, so two people editing different fields of the same job
 * don't overwrite each other. Creates the tracking row for an untracked job.
 * Returns the row id.
 */
export async function saveJobCustomValue(jobNo: string, key: string, value: unknown): Promise<string> {
  const existing = await list(JOBTRACK_SET, {
    select: "crfdf_jobtrackid,crfdf_customvalues",
    filter: `crfdf_jobno eq '${odataLit(jobNo)}'`,
  });
  const row = existing[0];
  const vals: CustomValues = row ? parseJsonObject(row.crfdf_customvalues) : {};
  if (value == null || (Array.isArray(value) && value.length === 0)) delete vals[key];
  else vals[key] = value;
  const json = JSON.stringify(vals);
  if (row) {
    const id = s(row.crfdf_jobtrackid);
    const res = await dvUpdate(JOBTRACK_SET, id, { crfdf_customvalues: json });
    if (!res.success) throw new Error(res.error?.message ?? "saveJobCustomValue failed");
    return id;
  }
  const id = uuid();
  const res = await dvCreate(JOBTRACK_SET, { crfdf_jobtrackid: id, crfdf_jobno: jobNo, crfdf_name: jobNo, crfdf_customvalues: json });
  if (!res.success) throw new Error(res.error?.message ?? "saveJobCustomValue failed");
  return id;
}

// ---------------------------------------------------------------------------
// Shared Jobs views (crfdf_jobsview) — one row per key: "layout" (sections,
// views, columns) and "prefs:<view id>" (sorts / filters / groups / collapsed),
// the value as JSON in crfdf_config. Created by scripts/create-jobsview-table.ps1.
// ---------------------------------------------------------------------------
const JOBSVIEW_SET = "crfdf_jobsviews";

/** Every saved key → value. Throws when the table doesn't exist yet. */
export async function fetchJobsViewConfig(): Promise<Map<string, unknown>> {
  const rows = await list(JOBSVIEW_SET, { select: "crfdf_name,crfdf_config" });
  const out = new Map<string, unknown>();
  for (const r of rows) {
    const key = s(r.crfdf_name);
    if (!key) continue;
    try {
      out.set(key, JSON.parse(s(r.crfdf_config)) as unknown);
    } catch {
      /* skip a damaged row */
    }
  }
  return out;
}

/** Save one key (create or update its row). */
export async function saveJobsViewConfig(key: string, value: unknown): Promise<void> {
  const rec: Row = { crfdf_name: key, crfdf_config: JSON.stringify(value) };
  const existing = await list(JOBSVIEW_SET, { select: "crfdf_jobsviewid", filter: `crfdf_name eq '${odataLit(key)}'` });
  const res = existing[0]
    ? await dvUpdate(JOBSVIEW_SET, s(existing[0].crfdf_jobsviewid), rec)
    : await dvCreate(JOBSVIEW_SET, { crfdf_jobsviewid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "saveJobsViewConfig failed");
}

// ---------------------------------------------------------------------------
// Job sketches (crfdf_jobsketch) — filled by the BCSync_JobSketches flow.
// Created by scripts/create-jobsketch-table.ps1.
// ---------------------------------------------------------------------------
const SKETCH_SET = "crfdf_jobsketchs";

export interface JobSketchRow {
  fileUrl: string;
  fileName: string;
  /** The file someone chose in the app (server-relative path); "" = the flow's automatic pick. */
  pinned: string;
}

// crfdf_pinned is newer than the table (scripts/create-jobsketch-table.ps1 re-run).
let sketchPinnedCol = true;

/** Every job's sketch file (link + name + pin) — no thumbnails. Throws when the table doesn't exist yet. */
export async function fetchJobSketches(): Promise<Map<string, JobSketchRow>> {
  const base = "crfdf_jobno,crfdf_fileurl,crfdf_filename";
  let rows: Row[];
  try {
    rows = await listAll(SKETCH_SET, { select: sketchPinnedCol ? `${base},crfdf_pinned` : base });
  } catch (e) {
    if (!sketchPinnedCol || !/pinned/i.test(e instanceof Error ? e.message : String(e))) throw e;
    sketchPinnedCol = false;
    rows = await listAll(SKETCH_SET, { select: base });
  }
  const out = new Map<string, JobSketchRow>();
  for (const r of rows) {
    const jobNo = s(r.crfdf_jobno).trim();
    const fileUrl = s(r.crfdf_fileurl).trim();
    if (jobNo && fileUrl) out.set(jobNo, { fileUrl, fileName: s(r.crfdf_filename), pinned: s(r.crfdf_pinned) });
  }
  return out;
}

/**
 * Pin a job's sketch to a file chosen (or uploaded) in the app. The nightly
 * flow keeps a pinned file instead of making its own pick. `thumbnail` is a
 * data: URL ("" = none yet; the flow makes one for the pinned file tonight).
 */
export async function saveJobSketch(
  jobNo: string,
  sketch: { fileUrl: string; fileName: string; pinned: string; thumbnail: string },
): Promise<void> {
  if (!sketchPinnedCol) throw new Error("The Pinned File column isn't there yet - re-run scripts/create-jobsketch-table.ps1");
  const rec: Row = {
    crfdf_jobno: jobNo,
    crfdf_name: jobNo,
    crfdf_fileurl: sketch.fileUrl,
    crfdf_filename: sketch.fileName,
    crfdf_pinned: sketch.pinned,
    // Not the flow's "v4|…" format, so its next run treats the job as changed
    // and makes a thumbnail if we couldn't.
    crfdf_fileversion: `app|${sketch.pinned}|${sketch.thumbnail ? "thumb" : "no-thumbnail"}`,
    crfdf_thumbnail: sketch.thumbnail,
  };
  const existing = await list(SKETCH_SET, { select: "crfdf_jobsketchid", filter: `crfdf_jobno eq '${odataLit(jobNo)}'` });
  const res = existing[0]
    ? await dvUpdate(SKETCH_SET, s(existing[0].crfdf_jobsketchid), rec)
    : await dvCreate(SKETCH_SET, { crfdf_jobsketchid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "saveJobSketch failed");
}

/** crfdf_pinned for a sketch removed in the app ("Remove File"); the nightly
 *  flow skips these jobs (keep in step with REMOVED in flows/_gen_jobsketches_flow.py). */
export const SKETCH_REMOVED = "(removed)";

/**
 * "Remove File": take the sketch off the Jobs list. ONLY the crfdf_jobsketch
 * row changes (link, name and thumbnail cleared, marked removed so the flow
 * doesn't pick a file again) — nothing in SharePoint is touched.
 */
export async function removeJobSketch(jobNo: string): Promise<void> {
  if (!sketchPinnedCol) throw new Error("The Pinned File column isn't there yet - re-run scripts/create-jobsketch-table.ps1");
  const rec: Row = {
    crfdf_jobno: jobNo,
    crfdf_name: jobNo,
    crfdf_fileurl: "",
    crfdf_filename: "",
    crfdf_pinned: SKETCH_REMOVED,
    crfdf_fileversion: "app|removed",
    crfdf_thumbnail: "",
  };
  const existing = await list(SKETCH_SET, { select: "crfdf_jobsketchid", filter: `crfdf_jobno eq '${odataLit(jobNo)}'` });
  const res = existing[0]
    ? await dvUpdate(SKETCH_SET, s(existing[0].crfdf_jobsketchid), rec)
    : await dvCreate(SKETCH_SET, { crfdf_jobsketchid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "removeJobSketch failed");
}

/** Back to the automatic pick: clears the pin (the flow re-picks tonight). */
export async function unpinJobSketch(jobNo: string): Promise<void> {
  const existing = await list(SKETCH_SET, { select: "crfdf_jobsketchid", filter: `crfdf_jobno eq '${odataLit(jobNo)}'` });
  if (!existing[0]) return;
  const res = await dvUpdate(SKETCH_SET, s(existing[0].crfdf_jobsketchid), { crfdf_pinned: "", crfdf_fileversion: "app|unpinned" });
  if (!res.success) throw new Error(res.error?.message ?? "unpinJobSketch failed");
}

/** The thumbnails (data: URLs) for a few jobs. */
export async function fetchSketchThumbnails(jobNos: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!jobNos.length) return out;
  const filter = jobNos.map((j) => `crfdf_jobno eq '${odataLit(j)}'`).join(" or ");
  for (const r of await list(SKETCH_SET, { select: "crfdf_jobno,crfdf_thumbnail", filter })) {
    const thumb = s(r.crfdf_thumbnail);
    if (thumb.startsWith("data:image/")) out.set(s(r.crfdf_jobno).trim(), thumb);
  }
  return out;
}

/** Upsert one month (keyed by crfdf_month). */
export async function saveBillingPeriod(row: BillingPeriodRow): Promise<void> {
  const rec: Row = { crfdf_month: row.month, crfdf_name: row.month, crfdf_cutoffdate: row.cutoff ?? "", crfdf_goal: row.goal };
  const existing = await list(BILLING_SET, { filter: `crfdf_month eq '${odataLit(row.month)}'` });
  const res = existing[0]
    ? await dvUpdate(BILLING_SET, s(existing[0].crfdf_billingperiodid), rec)
    : await dvCreate(BILLING_SET, { crfdf_billingperiodid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "saveBillingPeriod failed");
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
  const rec = { crfdf_appuserid: u.id, ...appUserToRecord(u) };
  const res = await dvCreate(APPUSER_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "createAppUser failed");
}

export async function updateAppUser(id: string, changes: Partial<AppUserRow>): Promise<void> {
  const res = await dvUpdate(APPUSER_SET, id, appUserToRecord(changes));
  if (!res.success) throw new Error(res.error?.message ?? `updateAppUser(${id}) failed`);
}

export async function deleteAppUser(id: string): Promise<void> {
  const res = await dvDelete(APPUSER_SET, id);
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
  // One row per (employee, week, board): update in place if present.
  const existing = await list(RO_SET, { filter: roMatch(o) }).catch(() => [] as Row[]);
  if (existing.length > 0) {
    const id = s(existing[0]!.crfdf_rosteroverrideid);
    const res = await dvUpdate(RO_SET, id, rosterOverrideToRecord(o));
    if (!res.success) throw new Error(res.error?.message ?? "upsertRosterOverride(update) failed");
    return;
  }
  const rec = { crfdf_rosteroverrideid: o.id, ...rosterOverrideToRecord(o) };
  const res = await dvCreate(RO_SET, rec);
  if (!res.success) throw new Error(res.error?.message ?? "upsertRosterOverride(create) failed");
}

export async function deleteRosterOverrideFor(
  boardKind: string,
  weekStart: string,
  employeeId: string,
): Promise<void> {
  const existing = await list(RO_SET, { filter: roMatch({ employeeId, boardKind, weekStart }) }).catch(
    () => [] as Row[],
  );
  await Promise.all(
    existing.map((r) => dvDelete(RO_SET, s(r.crfdf_rosteroverrideid))),
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
    const res = await dvUpdate(JOBDEPT_SET, id, rec);
    if (!res.success) throw new Error(res.error?.message ?? "addJobDeptCompletion(update) failed");
    return;
  }
  const res = await dvCreate(JOBDEPT_SET, { crfdf_jobdeptcompletionid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "addJobDeptCompletion(create) failed");
}

/** Un-complete a job's department (delete the completion row(s)). */
export async function removeJobDeptCompletion(jobNo: string, deptKey: string): Promise<void> {
  const match = `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_deptid eq '${odataLit(deptKey)}'`;
  const existing = await list(JOBDEPT_SET, { filter: match }).catch(() => [] as Row[]);
  await Promise.all(
    existing.map((r) => dvDelete(JOBDEPT_SET, s(r.crfdf_jobdeptcompletionid))),
  );
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
    const res = await dvUpdate(JOBOVR_SET, id, rec);
    if (!res.success) throw new Error(res.error?.message ?? "setJobDeptOverride(update) failed");
    return;
  }
  const res = await dvCreate(JOBOVR_SET, { crfdf_jobdeptoverrideid: uuid(), ...rec });
  if (!res.success) throw new Error(res.error?.message ?? "setJobDeptOverride(create) failed");
}

/** Delete the override row(s) for a (job, dept) — back to the BC default. */
export async function clearJobDeptOverride(jobNo: string, deptKey: string): Promise<void> {
  const match = `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_deptid eq '${odataLit(deptKey)}'`;
  const existing = await list(JOBOVR_SET, { filter: match }).catch(() => [] as Row[]);
  await Promise.all(
    existing.map((r) => dvDelete(JOBOVR_SET, s(r.crfdf_jobdeptoverrideid))),
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
  return stepInfoFromLines(await planningLinesFor(jobNo).catch(() => []));
}

export interface BcPlanningLineLite {
  resourceNo: string;
  description: string;
  hours: number;
  /** BC job task no ("4020" = install travel — one per trip). */
  jobTaskNo: string;
}

// Every BC resource planning line, keyed by job — ONE paged read (5,000+ rows),
// shared by the Jobs steppers and the Job Queue's step groups. Cached for the
// session; pass force to re-read.
let planningLinesP: Promise<Map<string, BcPlanningLineLite[]>> | null = null;
let planningLinesLoaded: Map<string, BcPlanningLineLite[]> | null = null;

/**
 * Planning lines for just these jobs: the shared full read if it's already
 * loaded, else a few small filtered reads (40 jobs each, in parallel) — far
 * lighter than all 7,000+ lines when a board only needs its own jobs.
 */
export async function planningLinesForJobs(jobNos: readonly string[]): Promise<Map<string, BcPlanningLineLite[]>> {
  if (planningLinesLoaded) return planningLinesLoaded;
  const jobs = [...new Set(jobNos.filter(Boolean))];
  const byJob = new Map<string, BcPlanningLineLite[]>();
  const chunks: string[][] = [];
  for (let i = 0; i < jobs.length; i += 40) chunks.push(jobs.slice(i, i + 40));
  const pages = await Promise.all(
    chunks.map((c) =>
      list(BC.planning, {
        select: "crfdf_jobno,crfdf_resourceno,crfdf_no,crfdf_description,crfdf_quantity,crfdf_jobtaskno",
        filter: `crfdf_type eq 'Resource' and (${c.map((j) => `crfdf_jobno eq '${odataLit(j)}'`).join(" or ")})`,
      }),
    ),
  );
  for (const r of pages.flat()) {
    const jobNo = s(r.crfdf_jobno).trim();
    if (!jobNo) continue;
    let arr = byJob.get(jobNo);
    if (!arr) byJob.set(jobNo, (arr = []));
    arr.push({
      resourceNo: s(r.crfdf_resourceno) || s(r.crfdf_no),
      description: s(r.crfdf_description),
      hours: n(r.crfdf_quantity),
      jobTaskNo: s(r.crfdf_jobtaskno),
    });
  }
  return byJob;
}

/** Log how long a load step took (open the console to see where time goes). */
async function timed<T>(label: string, p: Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await p;
  } finally {
    console.info(`[load] ${label}: ${Math.round(performance.now() - t0)} ms`);
  }
}
export function allPlanningLines(force = false): Promise<Map<string, BcPlanningLineLite[]>> {
  if (force || !planningLinesP) {
    planningLinesP = listAll(BC.planning, {
      select: "crfdf_jobno,crfdf_resourceno,crfdf_no,crfdf_description,crfdf_quantity,crfdf_jobtaskno",
      filter: "crfdf_type eq 'Resource'",
    })
      .then((rows) => {
        const byJob = new Map<string, BcPlanningLineLite[]>();
        planningLinesLoaded = byJob;
        for (const r of rows) {
          const jobNo = s(r.crfdf_jobno).trim();
          if (!jobNo) continue;
          let arr = byJob.get(jobNo);
          if (!arr) byJob.set(jobNo, (arr = []));
          arr.push({
            resourceNo: s(r.crfdf_resourceno) || s(r.crfdf_no),
            description: s(r.crfdf_description),
            hours: n(r.crfdf_quantity),
            jobTaskNo: s(r.crfdf_jobtaskno),
          });
        }
        return byJob;
      })
      .catch((e) => {
        planningLinesP = null;
        throw e;
      });
  }
  return planningLinesP;
}

/**
 * Stepper info for EVERY job from the shared planning-line read, instead of one
 * request per job. The Jobs view primes the stepper cache with it so the
 * Stepper column draws immediately.
 */
export async function allJobStepInfo(force = false): Promise<Map<string, { production: string[]; hasInstall: boolean }>> {
  const byJob = await allPlanningLines(force);
  return new Map([...byJob].map(([jobNo, lines]) => [jobNo, stepInfoFromLines(lines)]));
}

/** A job's planning lines for one production department (by department name). */
export function linesForDepartment(lines: readonly BcPlanningLineLite[], deptName: string): BcPlanningLineLite[] {
  return lines.filter(
    (l) => isProductionResource(l.resourceNo) && departmentNameForLine(l.resourceNo, l.description) === deptName,
  );
}

/** A job's install planning lines. */
export function installLines(lines: readonly BcPlanningLineLite[]): BcPlanningLineLite[] {
  return lines.filter((l) => isInstallResource(l.resourceNo));
}

/** Planning lines shaped for the Job Queue's step groups (department + tasks + hours). */
export async function queuePlanningLines(): Promise<Map<string, StepPlanningLine[]>> {
  const byJob = await allPlanningLines();
  return new Map(
    [...byJob].map(([jobNo, lines]) => [
      jobNo,
      lines.map((l) => {
        // Crating labor belongs to the Crating step, whatever resource it's on.
        const crating = isCratingLine(l.description);
        return {
          departmentName: crating
            ? "Crating"
            : isProductionResource(l.resourceNo)
              ? departmentNameForLine(l.resourceNo, l.description) ?? ""
              : "",
          isInstall: !crating && isInstallResource(l.resourceNo),
          description: l.description,
          resourceNo: l.resourceNo,
          hours: l.hours,
        };
      }),
    ]),
  );
}

/** `${jobNo}|${bcStep}` for every step that has a card on any board (all dates). */
export async function scheduledSteps(): Promise<Set<string>> {
  const [prod, cards, names] = await Promise.all([
    listAll(SET.lines, { select: "crfdf_jobno,_crfdf_department_value,crfdf_iscustom", filter: "crfdf_jobno ne null" }),
    listAll(SHIP.cards, { select: "crfdf_jobno,crfdf_iscustom,_crfdf_shipmentload_value", filter: "crfdf_jobno ne null" }),
    departmentNames(),
  ]);
  const out = new Set<string>();
  for (const r of prod) {
    if (r.crfdf_iscustom) continue;
    const step = bcStepForDepartmentName(names.get(s(r["_crfdf_department_value"])));
    if (step) out.add(`${s(r.crfdf_jobno)}|${step}`);
  }
  for (const r of cards) {
    if (r.crfdf_iscustom || r["_crfdf_shipmentload_value"]) continue;
    out.add(`${s(r.crfdf_jobno)}|Install`);
  }
  return out;
}

/**
 * Everything "Sync to BC" needs about the boards, in bulk: every production and
 * install card, department names, and each person's BC Resource No. (production
 * roster crfdf_no; install crew by name — see installResourceLookup).
 */
export async function fetchSyncSnapshot(): Promise<{
  productionCards: ScheduleLine[];
  installCards: ScheduleLine[];
  departmentName: (id: string) => string | undefined;
  productionResourceNo: (employeeId: string) => string;
  installResourceNo: (employeeId: string) => string;
}> {
  const [prodRows, cardRows, names, emps, installLookup] = await Promise.all([
    listAll(SET.lines, { filter: "crfdf_jobno ne null" }),
    listAll(SHIP.cards, { filter: "crfdf_jobno ne null" }),
    departmentNames(),
    listAll(SET.employees, { select: "crfdf_employee1id,crfdf_no" }),
    installResourceLookup(),
  ]);
  const prodNo = new Map(emps.map((e) => [s(e.crfdf_employee1id), s(e.crfdf_no).trim()] as const));
  return {
    productionCards: prodRows.map(mapLine).filter((l) => l.jobNo && !l.isCustom),
    installCards: cardRows.map(mapCardRecord).filter((c) => c.jobNo && !c.isCustom),
    departmentName: (id) => names.get(id),
    productionResourceNo: (id) => (isLaneEmployeeId(id) ? "" : prodNo.get(id) ?? ""),
    installResourceNo: installLookup,
  };
}

/** Every step push still in the outbox (pending or synced) — what BC was last told. */
export async function fetchLastPushes(): Promise<LastPush[]> {
  const rows = await listAll(BCPUSH_SET, {
    select: "crfdf_kind,crfdf_jobno,crfdf_planningstep,crfdf_started,crfdf_complete,crfdf_startdatetime,crfdf_enddatetime,crfdf_assignedto,createdon",
    filter: "(crfdf_kind eq 'state' or crfdf_kind eq 'schedule') and crfdf_status ne 'superseded' and crfdf_status ne 'failed'",
  });
  return rows.map((r) => ({
    kind: s(r.crfdf_kind),
    jobNo: s(r.crfdf_jobno),
    planningStep: s(r.crfdf_planningstep),
    started: Boolean(r.crfdf_started),
    complete: Boolean(r.crfdf_complete),
    startDateTime: r.crfdf_startdatetime == null ? null : s(r.crfdf_startdatetime),
    endDateTime: r.crfdf_enddatetime == null ? null : s(r.crfdf_enddatetime),
    assignedTo: s(r.crfdf_assignedto),
    createdOn: s(r.createdon),
  }));
}

/**
 * Queue many pushes (Sync to BC), a few at a time so a 1,000+ row sync doesn't
 * flood the connector. Unlike `enqueueBcPush` this reports failures — the
 * caller shows them. Returns how many were queued and how many failed.
 */
export async function enqueueBcPushes(
  pushes: readonly BcPlanningPush[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ queued: number; failed: number }> {
  let next = 0;
  let queued = 0;
  let failed = 0;
  const worker = async () => {
    while (next < pushes.length) {
      const p = pushes[next++]!;
      try {
        const res = await dvCreate(BCPUSH_SET, pushToRecord(p));
        if (res.success) queued++;
        else failed++;
      } catch {
        failed++;
      }
      onProgress?.(queued + failed, pushes.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, pushes.length) }, worker));
  return { queued, failed };
}

/**
 * The invoice amount typed on a job's production calendar cards (largest per
 * job). The calendar shows it when BC's remaining balance is empty, so the Jobs
 * Value column uses the same fallback.
 */
export async function jobInvoiceAmounts(): Promise<Map<string, number>> {
  const rows = await listAll(SET.lines, {
    select: "crfdf_jobno,crfdf_invoiceamount",
    filter: "crfdf_invoiceamount gt 0",
  });
  const out = new Map<string, number>();
  for (const r of rows) {
    const jobNo = s(r.crfdf_jobno).trim();
    const v = n(r.crfdf_invoiceamount);
    if (jobNo && v > (out.get(jobNo) ?? 0)) out.set(jobNo, v);
  }
  return out;
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

// ---------------------------------------------------------------------------
// Job purchase orders (crfdf_jobpo) — filled nightly by the BCSync_JobPOs flow
// from our BC queries LumineoJobPOs + LumineoJobPOArchive. Read-only here.
// Created by scripts/create-jobpo-table.ps1.
// ---------------------------------------------------------------------------
const JOBPO_SET = "crfdf_jobpos";

/** One job's purchase orders, newest order first. Throws when the table doesn't exist yet. */
export async function fetchJobPOs(jobNo: string): Promise<JobPO[]> {
  const rows = await list(JOBPO_SET, {
    select: "crfdf_pono,crfdf_vendorno,crfdf_vendorname,crfdf_orderdate,crfdf_postatus",
    filter: `crfdf_jobno eq '${odataLit(jobNo)}'`,
  });
  return sortJobPOs(
    rows
      .map((r) => ({
        poNo: s(r.crfdf_pono).trim(),
        vendorNo: s(r.crfdf_vendorno).trim(),
        vendorName: s(r.crfdf_vendorname).trim(),
        orderDate: s(r.crfdf_orderdate).trim(),
        status: s(r.crfdf_postatus).trim(),
      }))
      .filter((p) => p.poNo),
  );
}

// ---------------------------------------------------------------------------
// Job descriptions (crfdf_jobdesc) — filled hourly by the BCSync_JobDescriptions
// flow from our BC API page jobDescriptions. Read-only here.
// Created by scripts/create-jobdesc-table.ps1.
// ---------------------------------------------------------------------------
const JOBDESC_SET = "crfdf_jobdescs";

/** One job's Field / Production / Extended Description ("" = none). Throws when the table doesn't exist yet. */
export async function fetchJobDescriptions(jobNo: string): Promise<JobDescriptions> {
  const rows = await list(JOBDESC_SET, {
    select: "crfdf_fielddesc,crfdf_proddesc,crfdf_extdesc",
    filter: `crfdf_jobno eq '${odataLit(jobNo)}'`,
  });
  const r = rows[0];
  return {
    field: s(r?.crfdf_fielddesc).trim(),
    production: s(r?.crfdf_proddesc).trim(),
    extended: s(r?.crfdf_extdesc).trim(),
  };
}
