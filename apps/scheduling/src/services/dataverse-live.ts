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
import type { ScheduleDataSource } from "./data-source";
import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";

// Entity SET names (plural) used by the connector's ListRecords. Adjust here if
// Dataverse pluralized any differently than logical-name + "s".
const SET = {
  departments: "crfdf_departments",
  employees: "crfdf_employees",
  lines: "crfdf_productionschedulelines",
} as const;

const ACCEPT = "application/json";
const PREFER_READ = 'odata.include-annotations="*"';
const PREFER_WRITE = "return=representation";

type Row = Record<string, unknown>;

// Lazy SDK handle — defers getClient() (needs the runtime) to first use, and
// resolves the Dataverse org URL from the app context. The connector's
// ListRecords/CreateRecord/... operations require the organization explicitly
// (otherwise: "Invalid organization URL 'null' provided"), so we use the
// *WithOrganization variants with the org URL from IContext.app.dataverseOrgUrl.
let _svc: typeof import("../generated").MicrosoftDataverseService | null = null;
let _org = "";
async function sdk() {
  if (!_svc) {
    _svc = (await import("../generated")).MicrosoftDataverseService;
    try {
      const { getContext } = await import("@microsoft/power-apps/app");
      const ctx = await getContext();
      _org = ctx.app.dataverseOrgUrl ?? "";
    } catch {
      _org = "";
    }
  }
  return { S: _svc, org: _org };
}

async function list(
  entitySet: string,
  opts: { select?: string; filter?: string; orderby?: string } = {},
): Promise<Row[]> {
  const { S, org } = await sdk();
  const res = await S.ListRecordsWithOrganization(
    org, entitySet, PREFER_READ, ACCEPT, false, false, opts.select, opts.filter, opts.orderby,
  );
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

function mapLine(r: Row): ScheduleLine {
  return {
    id: s(r.crfdf_productionschedulelineid),
    jobNo: s(r.crfdf_jobno),
    customerName: s(r.crfdf_customername),
    planningLineDescription: s(r.crfdf_planninglinedescription),
    startDateTime: dt(r.crfdf_startdatetime),
    endDateTime: dt(r.crfdf_enddatetime),
    estimatedHours: n(r.crfdf_estimatedhours),
    overrideHours: nOrNull(r.crfdf_overridehours),
    employeeId: s(r["_crfdf_employee_value"]),
    departmentId: s(r["_crfdf_department_value"]),
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
  if (line.planningLineDescription !== undefined) rec.crfdf_planninglinedescription = line.planningLineDescription;
  if (line.startDateTime !== undefined) rec.crfdf_startdatetime = iso(line.startDateTime);
  if (line.endDateTime !== undefined) rec.crfdf_enddatetime = iso(line.endDateTime);
  if (line.estimatedHours !== undefined) rec.crfdf_estimatedhours = line.estimatedHours;
  if (line.overrideHours !== undefined) rec.crfdf_overridehours = line.overrideHours;
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
  // Lookups via @odata.bind
  if (line.employeeId) rec["crfdf_Employee@odata.bind"] = `/${SET.employees}(${line.employeeId})`;
  if (line.departmentId) rec["crfdf_Department@odata.bind"] = `/${SET.departments}(${line.departmentId})`;
  return rec;
}

export const liveProductionDataSource: ScheduleDataSource = {
  kind: "production",

  async loadDepartments(): Promise<Department[]> {
    const rows = await list(SET.departments, {
      select: "crfdf_departmentid,crfdf_departmentname,crfdf_floworder,crfdf_color",
      orderby: "crfdf_floworder asc,crfdf_departmentname asc",
    });
    return rows.map((r, i) => ({
      id: s(r.crfdf_departmentid),
      name: s(r.crfdf_departmentname, "Department"),
      flowOrder: r.crfdf_floworder == null ? i + 1 : n(r.crfdf_floworder),
      color: s(r.crfdf_color, "#cccccc"),
    }));
  },

  async loadEmployees(): Promise<Employee[]> {
    const rows = await list(SET.employees, {
      select:
        "crfdf_employeeid,crfdf_employeename,crfdf_productivityrate,crfdf_standardhoursperday,crfdf_maxovertimeperday,crfdf_worksweekends,crfdf_hourlyrate,_crfdf_department_value",
    });
    return rows.map((r) => ({
      id: s(r.crfdf_employeeid),
      name: s(r.crfdf_employeename, "Employee"),
      departmentId: s(r["_crfdf_department_value"]),
      productivityRate: n(r.crfdf_productivityrate, 1) || 1,
      standardHoursPerDay: n(r.crfdf_standardhoursperday, 8),
      maxOvertimePerDay: n(r.crfdf_maxovertimeperday, 0),
      worksWeekends: Boolean(r.crfdf_worksweekends),
      hourlyRate: nOrNull(r.crfdf_hourlyrate) ?? undefined,
    }));
  },

  async loadScheduleLines(from: Date, to: Date): Promise<ScheduleLine[]> {
    const filter = `crfdf_startdatetime ge ${from.toISOString()} and crfdf_startdatetime le ${to.toISOString()}`;
    const rows = await list(SET.lines, { filter, orderby: "crfdf_startdatetime asc" });
    return rows.map(mapLine);
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
    const { S, org } = await sdk();
    const res = await S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SET.lines, id, toRecord(changes));
    if (!res.success) throw new Error(res.error?.message ?? `UpdateRecord(${id}) failed`);
    const body = res.data as Row | undefined;
    return body && body.crfdf_productionschedulelineid ? mapLine(body) : ({ id, ...changes } as ScheduleLine);
  },

  async createScheduleLine(line: ScheduleLine): Promise<ScheduleLine> {
    const { S, org } = await sdk();
    const rec = toRecord(line);
    rec.crfdf_name = `${line.jobNo} · ${line.planningLineDescription}`.slice(0, 200);
    const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SET.lines, rec);
    if (!res.success) throw new Error(res.error?.message ?? `CreateRecord failed`);
    // CreateRecord returns void; the new id is in the response location header
    // which the generated wrapper doesn't surface — return the input line. A
    // reload (loadWeek) picks up the server id. TODO: capture the created id.
    return line;
  },

  async deleteScheduleLine(id: string): Promise<void> {
    const { S, org } = await sdk();
    const res = await S.DeleteRecordWithOrganization(org, SET.lines, id);
    if (!res.success) throw new Error(res.error?.message ?? `DeleteRecord(${id}) failed`);
  },
};

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
