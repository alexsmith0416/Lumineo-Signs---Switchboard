import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";
import type { ScheduleDataSource } from "./data-source";

// =============================================================================
// productionDataSource — M2 / ALE-80
// =============================================================================
//
// Status: SKELETON. Reads still return []; writes still throw. Runtime
// behavior is identical to the M1 stub so the app keeps booting and the 47
// engine tests stay green. What's new vs. the M1 stub is that every value the
// real adapter will need is named and grouped at the top of this file. When
// the Dataverse table info + Entra creds land, wiring this up is a
// fill-in-the-blanks job, not a from-scratch write.
//
// Open questions for @alexrsmith — answers turn this skeleton into M2:
//
//   Q1. Table naming. There are two conventions documented:
//         (a) crfdf_productionscheduleline  — docs/15 §4.2 (original spec)
//         (b) lum_Task (joined to lum_Job)  — docs/04 + docs/13 (Airtable mirror)
//       The Airtable mirror (airtablemirror_sync) writes to (b). The original
//       spec assumed (a). Pick one for the interim and update TABLE_NAMES.
//
//   Q2. Employee + Department source. The Airtable mirror doesn't carry
//       resource info — only Job + Task + CrewAssignment. Possible sources:
//         (a) UserProfile filtered by department + a static Department enum
//         (b) New lum_Employee + lum_Department tables seeded once
//         (c) The crfdf_employee1 / crfdf_department1 tables the original
//             spec called for, populated separately
//       Whichever wins, set EMPLOYEE_TABLE / DEPARTMENT_TABLE accordingly.
//
//   Q3. WorkHoursOverride + OvertimeOverride. Spec §4.2 names
//       crfdf_employeeworkhours + crfdf_overtimeoverride. Mirror doesn't
//       carry these. Probably fine to leave empty arrays through interim
//       (engine treats absent overrides as "use Employee defaults") — confirm.
//
// Per docs/15 §8.6: the interim Power SDK adapter reads from the Dataverse
// mirror exactly as the BC-backed final version would. The interface stays
// the same; only the table/column names and the auth context change.
// =============================================================================

// -----------------------------------------------------------------------------
// FILL-IN-THE-BLANKS: pick the table-naming convention and set names.
// -----------------------------------------------------------------------------

/** Dataverse logical names. Resolve Q1/Q2 above before wiring. */
const TABLE_NAMES = {
  // Q1: schedule lines (production)
  // scheduleLine: "crfdf_productionscheduleline",  // option (a) per spec §4.2
  // scheduleLine: "lum_Task",                       // option (b) per docs/13
  scheduleLine: "TBD_TABLE_NAME_FOR_SCHEDULE_LINE",

  // If option (b), we also need lum_Job for customer + jobNumber:
  job: "lum_Job",

  // Q2: employees + departments
  employee: "TBD_TABLE_NAME_FOR_EMPLOYEE",
  department: "TBD_TABLE_NAME_FOR_DEPARTMENT",

  // Q3: overrides (likely empty until populated by ops)
  workHoursOverride: "crfdf_employeeworkhours",
  overtimeOverride: "crfdf_overtimeoverride",
} as const;

/**
 * Column mapping for the schedule-line table → ScheduleLine engine type.
 *
 * The exact column logical names depend on Q1. The shape of the mapping is
 * stable — these are the source-of-truth fields the engine consumes.
 *
 * For option (b) (lum_Task + lum_Job), the mapping draws from both rows;
 * see docs/13 "Task-level decomposition" + "Job-level field mapping".
 */
const SCHEDULE_LINE_FIELDS = {
  id: "TBD",                          // → ScheduleLine.id (Dataverse row guid)
  jobNo: "TBD",                       // → ScheduleLine.jobNo (lum_Job.jobNumber or crfdf_jobno)
  customerName: "TBD",                // → ScheduleLine.customerName (lum_Job.customer / crfdf_customer)
  planningLineDescription: "TBD",     // → ScheduleLine.planningLineDescription (lum_Task.title / crfdf_description)
  startDateTime: "TBD",               // → ScheduleLine.startDateTime
  endDateTime: "TBD",                 // → ScheduleLine.endDateTime
  estimatedHours: "TBD",              // → ScheduleLine.estimatedHours (lum_Task.estimatedHours)
  overrideHours: "TBD",               // → ScheduleLine.overrideHours (spec §4.2 NEW column)
  employeeId: "TBD",                  // → ScheduleLine.employeeId (lum_Task.assignedTo / crfdf_employee)
  departmentId: "TBD",                // → ScheduleLine.departmentId (lum_Task.department choice)
  customerDueDate: "TBD",             // → ScheduleLine.customerDueDate (lum_Job.dueDate)
  isLocked: "TBD",                    // → ScheduleLine.isLocked (spec §4.2 NEW column)
  jobSequence: "TBD",                 // → ScheduleLine.jobSequence (spec §4.2 NEW column)
} as const;

/** Engine type ↔ Dataverse mapping for Employee. Q2-dependent. */
const EMPLOYEE_FIELDS = {
  id: "TBD",
  name: "TBD",
  departmentId: "TBD",
  productivityRate: "TBD",            // spec §4.2: backfill default 0.85
  standardHoursPerDay: "TBD",         // default 8
  maxOvertimePerDay: "TBD",           // default 4
  worksWeekends: "TBD",               // default false
  hourlyRate: "TBD",                  // optional, for OT cost in scenarios
} as const;

/** Engine type ↔ Dataverse mapping for Department. Q2-dependent. */
const DEPARTMENT_FIELDS = {
  id: "TBD",
  name: "TBD",
  flowOrder: "TBD",                   // spec §4.2 NEW column
  color: "TBD",                       // spec §4.2 NEW column, hex
} as const;

// -----------------------------------------------------------------------------
// Power SDK client. Resolved by main.tsx auth bootstrap (services/auth.ts).
// -----------------------------------------------------------------------------

// When Entra creds land, replace this with the real client from auth.ts.
// Until then, _powerSDK is undefined and every method falls through to the
// stub branch below.
declare const _powerSDK: undefined | {
  /** Sketch of the Power SDK shape — real types come from the generated SDK. */
  tables: Record<string, {
    list(query: {
      $select?: string[];
      $filter?: string;
      $top?: number;
    }): Promise<Record<string, unknown>[]>;
    create(row: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(id: string): Promise<void>;
  }>;
};

// -----------------------------------------------------------------------------
// Skeleton mappers. Drop the TODOs and read from SCHEDULE_LINE_FIELDS etc.
// once the column names are filled in.
// -----------------------------------------------------------------------------

function mapRowToScheduleLine(_row: Record<string, unknown>): ScheduleLine {
  // TODO M2: read each SCHEDULE_LINE_FIELDS.* off _row; coerce dates with
  // new Date(...); coalesce overrideHours to null; flag isCustom/customColor
  // from the new columns added in M15.
  throw new Error("[NotImplemented] mapRowToScheduleLine — fill in once SCHEDULE_LINE_FIELDS is resolved.");
}

function mapRowToEmployee(_row: Record<string, unknown>): Employee {
  // TODO M2: see Q2. Resolve productivityRate to 0.85 if column null.
  throw new Error("[NotImplemented] mapRowToEmployee — fill in once EMPLOYEE_FIELDS is resolved.");
}

function mapRowToDepartment(_row: Record<string, unknown>): Department {
  // TODO M2: see Q2.
  throw new Error("[NotImplemented] mapRowToDepartment — fill in once DEPARTMENT_FIELDS is resolved.");
}

function mapScheduleLineToRow(_line: Partial<ScheduleLine>): Record<string, unknown> {
  // Inverse of mapRowToScheduleLine for create + update.
  throw new Error("[NotImplemented] mapScheduleLineToRow — fill in once SCHEDULE_LINE_FIELDS is resolved.");
}

// -----------------------------------------------------------------------------
// Public service. Runtime behavior matches the M1 stub until _powerSDK is
// resolved by auth.ts — that's the single switch that turns this on.
// -----------------------------------------------------------------------------

const WARN_KEY = "__lumineo_skeleton_warned_production__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[skeleton] productionDataSource is not wired yet (M2 / ALE-80). " +
      "Reads return []; writes throw. Resolve Q1-Q3 at the top of " +
      "src/services/dataverse.ts and replace the TBD constants to turn this on.",
  );
}

function notImplemented(op: string): never {
  throw new Error(
    `[NotImplemented] productionDataSource.${op} — wire in M2 (ALE-80). ` +
      "See top-of-file Q1-Q3 for the unresolved Dataverse table / column choices.",
  );
}

export const productionDataSource: ScheduleDataSource = {
  kind: "production",

  async loadDepartments(): Promise<Department[]> {
    if (!_powerSDK) {
      warnOnce();
      return [];
    }
    // M2: const rows = await _powerSDK.tables[TABLE_NAMES.department].list({
    //   $select: Object.values(DEPARTMENT_FIELDS),
    // });
    // return rows.map(mapRowToDepartment);
    return [];
  },

  async loadEmployees(): Promise<Employee[]> {
    if (!_powerSDK) {
      warnOnce();
      return [];
    }
    // M2: const rows = await _powerSDK.tables[TABLE_NAMES.employee].list({
    //   $select: Object.values(EMPLOYEE_FIELDS),
    // });
    // return rows.map(mapRowToEmployee);
    return [];
  },

  async loadScheduleLines(_from: Date, _to: Date): Promise<ScheduleLine[]> {
    if (!_powerSDK) {
      warnOnce();
      return [];
    }
    // M2: const rows = await _powerSDK.tables[TABLE_NAMES.scheduleLine].list({
    //   $select: Object.values(SCHEDULE_LINE_FIELDS),
    //   $filter: `${SCHEDULE_LINE_FIELDS.startDateTime} ge ${_from.toISOString()} ` +
    //            `and ${SCHEDULE_LINE_FIELDS.startDateTime} le ${_to.toISOString()}`,
    // });
    // If table === lum_Task, also fetch matching lum_Job rows in one batched
    // call and merge customer + jobNumber + dueDate into each ScheduleLine.
    // return rows.map(mapRowToScheduleLine);
    return [];
  },

  async loadWorkHours(_from: Date, _to: Date): Promise<WorkHoursOverride[]> {
    if (!_powerSDK) {
      warnOnce();
      return [];
    }
    // M2: range-query crfdf_employeeworkhours, map row → WorkHoursOverride.
    return [];
  },

  async loadOvertimeOverrides(_from: Date, _to: Date): Promise<OvertimeOverride[]> {
    if (!_powerSDK) {
      warnOnce();
      return [];
    }
    // M2: range-query crfdf_overtimeoverride, map row → OvertimeOverride.
    return [];
  },

  async updateScheduleLine(_id: string, _changes: Partial<ScheduleLine>): Promise<ScheduleLine> {
    if (!_powerSDK) return notImplemented("updateScheduleLine");
    // M2: const patch = mapScheduleLineToRow(_changes);
    // const row = await _powerSDK.tables[TABLE_NAMES.scheduleLine].update(_id, patch);
    // return mapRowToScheduleLine(row);
    return notImplemented("updateScheduleLine");
  },

  async createScheduleLine(_line: ScheduleLine): Promise<ScheduleLine> {
    if (!_powerSDK) return notImplemented("createScheduleLine");
    // M2: const row = await _powerSDK.tables[TABLE_NAMES.scheduleLine].create(
    //   mapScheduleLineToRow(_line),
    // );
    // return mapRowToScheduleLine(row);
    return notImplemented("createScheduleLine");
  },

  async deleteScheduleLine(_id: string): Promise<void> {
    if (!_powerSDK) return notImplemented("deleteScheduleLine");
    // M2: await _powerSDK.tables[TABLE_NAMES.scheduleLine].delete(_id);
    return notImplemented("deleteScheduleLine");
  },
};

// Preserved alias — legacy imports continue to compile.
export const dataverseService = productionDataSource;
