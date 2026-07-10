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

// Lazy SDK handle — defers getClient() (needs the runtime) to first use, and
// resolves the Dataverse org URL from the app context. The connector's
// ListRecords/CreateRecord/... operations require the organization explicitly
// (otherwise: "Invalid organization URL 'null' provided"), so we use the
// *WithOrganization variants with the org URL from IContext.app.dataverseOrgUrl.
// The env's Dataverse org URL — final fallback if neither the connector's
// GetOrganizations nor the app context surfaces it.
const ORG_FALLBACK = "https://org8fa22efd.crm.dynamics.com";

let _svc: typeof import("../generated").MicrosoftDataverseService | null = null;
let _org = "";
async function resolveOrg(S: NonNullable<typeof _svc>): Promise<string> {
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
async function sdk() {
  if (!_svc) {
    _svc = (await import("../generated")).MicrosoftDataverseService;
    _org = await resolveOrg(_svc);
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
    // No crfdf_name — the primary-name column isn't crfdf_name on this table.
    const rec = toRecord(line);
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

/** Map an admin input to a crfdf_employee1 record payload (name + dept lookup). */
function employeeRecord(input: ResourceAdminInput): Row {
  const rec: Row = {};
  if (input.name !== undefined) rec.crfdf_employeename = input.name;
  if (input.departmentId)
    rec["crfdf_Department@odata.bind"] = `/${SET.departments}(${input.departmentId})`;
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
    isCertifiedCraneOperator: Boolean(r.crfdf_certifiedcraneoperator),
    position: n(r.crfdf_positiononschedule, 0),
  };
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
      const all = rows.map(mapCardRecord);
      setRegionCards(region, all);
      return all.filter((l) => l.startDateTime >= from && l.startDateTime <= to);
    },
    async loadWorkHours(): Promise<WorkHoursOverride[]> {
      return [];
    },
    async loadOvertimeOverrides(): Promise<OvertimeOverride[]> {
      return [];
    },

    async updateScheduleLine(id: string, changes: Partial<ScheduleLine>): Promise<ScheduleLine> {
      const { S, org } = await sdk();
      const res = await S.UpdateRecordWithOrganization(
        PREFER_WRITE, ACCEPT, org, SHIP.cards, id, cardToRecord(changes, isNek, false),
      );
      if (!res.success) throw new Error(res.error?.message ?? `UpdateInstallCard(${id}) failed`);
      const body = res.data as Row | undefined;
      const line = body?.crfdf_installcardid ? mapCardRecord(body) : ({ id, ...changes } as ScheduleLine);
      cacheUpdateCard(region, id, line);
      return line;
    },
    async createScheduleLine(line: ScheduleLine): Promise<ScheduleLine> {
      const { S, org } = await sdk();
      const id = uuid();
      const rec = { crfdf_installcardid: id, ...cardToRecord(line, isNek, true) };
      const res = await S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, SHIP.cards, rec);
      if (!res.success) throw new Error(res.error?.message ?? "CreateInstallCard failed");
      const created = { ...line, id };
      cacheAddCard(region, created);
      return created;
    },
    async deleteScheduleLine(id: string): Promise<void> {
      const { S, org } = await sdk();
      const res = await S.DeleteRecordWithOrganization(org, SHIP.cards, id);
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
function mapCardRecord(r: Row): ScheduleLine {
  const title = s(r.crfdf_name);
  return {
    id: s(r.crfdf_installcardid),
    jobNo: title,
    customerName: title,
    planningLineDescription: s(r.crfdf_notes),
    startDateTime: dt(r.crfdf_startdatetime),
    endDateTime: dt(r.crfdf_enddatetime),
    estimatedHours: n(r.crfdf_estimatedhours, 8),
    overrideHours: nOrNull(r.crfdf_overridehours),
    employeeId: s(r["_crfdf_employee_value"]),
    departmentId: String(n(r.crfdf_locationvalue, 6)),
    customerDueDate: null,
    isLocked: Boolean(r.crfdf_islocked),
    jobSequence: 0,
    isCustom: Boolean(r.crfdf_iscustom),
    customColor: s(r.crfdf_customcolor) || null,
    customTextColor: s(r.crfdf_customtextcolor) || null,
    shipmentLoadId: r["_crfdf_shipmentload_value"] == null ? null : s(r["_crfdf_shipmentload_value"]),
  };
}

function cardToRecord(line: Partial<ScheduleLine>, isNek: boolean, forCreate: boolean): Row {
  const rec: Row = {};
  const title = line.customerName || line.jobNo;
  if (title !== undefined) rec.crfdf_name = title || "Card";
  if (line.planningLineDescription !== undefined) rec.crfdf_notes = line.planningLineDescription;
  if (line.startDateTime !== undefined) rec.crfdf_startdatetime = iso(line.startDateTime);
  if (line.endDateTime !== undefined) rec.crfdf_enddatetime = iso(line.endDateTime);
  if (line.estimatedHours !== undefined) rec.crfdf_estimatedhours = line.estimatedHours;
  if (line.overrideHours !== undefined) rec.crfdf_overridehours = line.overrideHours;
  if (line.departmentId !== undefined) rec.crfdf_locationvalue = Number(line.departmentId) || 0;
  if (line.isLocked !== undefined) rec.crfdf_islocked = line.isLocked;
  if (line.isCustom !== undefined) rec.crfdf_iscustom = line.isCustom;
  if (line.customColor !== undefined) rec.crfdf_customcolor = line.customColor;
  if (line.customTextColor !== undefined) rec.crfdf_customtextcolor = line.customTextColor;
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

export interface BcJobLive {
  jobNo: string;
  customerName: string;
  description: string;
  /** Bill-to code (crfdf_billtocustomerno) — join key to crfdf_bccustomers. */
  billToNo: string;
  promisedDate: string;
  remainingBalance: number;
  planningLines: Array<{
    lineNo: number;
    description: string;
    estimatedHours: number;
    /** BC resource code (crfdf_no) → department labor category. */
    resourceNo: string;
    /** BC job task no (crfdf_jobtaskno) → phase: 3000s Production, 4000s Install. */
    jobTaskNo: string;
  }>;
}

const odataLit = (v: string) => v.replace(/'/g, "''");

async function planningLinesFor(jobNo: string) {
  // Planning lines match the BC job on crfdf_jobno (NOT crfdf_jobnumber, which
  // is empty on this table). Resource-type lines only — G/L / Item lines aren't
  // schedulable labor.
  //   crfdf_jobtaskno drives the Production (3000s) / Installation (4000s) split.
  //   crfdf_no is the resource code → the exact department labor category.
  //   crfdf_quantity is the estimated hours (crfdf_estimatedhours is a
  //     schedule-line column and is empty on planning lines).
  const rows = await list(BC.planning, {
    filter: `crfdf_jobno eq '${odataLit(jobNo)}' and crfdf_type eq 'Resource'`,
    orderby: "crfdf_lineno asc",
  });
  return rows.map((r) => ({
    lineNo: n(r.crfdf_lineno),
    description: s(r.crfdf_description),
    estimatedHours: n(r.crfdf_quantity) || n(r.crfdf_estimatedhours),
    resourceNo: s(r.crfdf_no),
    jobTaskNo: s(r.crfdf_jobtaskno),
  }));
}

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

function mapBcJobHead(r: Row): Omit<BcJobLive, "planningLines"> {
  const due = r.crfdf_promiseddate;
  return {
    jobNo: s(r.crfdf_jobnumber),
    // Fallback only — replaced by the crfdf_bccustomers join below.
    customerName: s(r.crfdf_customername),
    description: s(r.crfdf_description),
    billToNo: s(r.crfdf_billtocustomerno),
    promisedDate: due == null || due === "" ? "" : String(due).slice(0, 10),
    remainingBalance: n(r.crfdf_remainingbalance),
  };
}

/** Search the BC job staging table by job number or customer; include each
 *  match's planning lines. Throws if Dataverse is unreachable (callers fall
 *  back to the mock). */
export async function searchBcJobsLive(query: string, limit = 8): Promise<BcJobLive[]> {
  const q = odataLit(query.trim());
  const rows = await list(BC.jobs, {
    filter: `contains(crfdf_jobnumber,'${q}') or contains(crfdf_customername,'${q}')`,
    orderby: "crfdf_jobnumber asc",
  });
  const heads = rows.slice(0, limit).map(mapBcJobHead);
  return Promise.all(
    heads.map(async (h) => ({
      ...h,
      customerName: (await resolveCustomerName(h.billToNo)) || h.customerName,
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
    customerName: (await resolveCustomerName(head.billToNo)) || head.customerName,
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
