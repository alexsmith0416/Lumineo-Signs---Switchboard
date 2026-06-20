/**
 * Live Dataverse data source — Phase 2 vertical slice.
 *
 * Replaces the in-memory `productionDataSource` stub with real reads through
 * the generated Power SDK client (`MicrosoftDataverseService`, from
 * `pac code add-data-source`). Only the read path is wired so far
 * (loadDepartments is verified end-to-end against live data); the remaining
 * methods are marked TODO and fall back to empty/throw until their tables are
 * added as data sources and mapped.
 *
 * Tables (real deployed schema, discovered in the audit):
 *   crfdf_department      → Department   (cols: crfdf_departmentid, crfdf_departmentname)
 *   crfdf_employee        → Employee     (TODO: add data source + map)
 *   crfdf_projectschedule → ScheduleLine (TODO: has crfdf_startdate/enddate)
 *
 * Note: crfdf_department has no flowOrder/color column yet — the brief calls
 * for adding crfdf_floworder. Until then we derive a stable flowOrder from
 * name order and use the fallback color.
 */
import { MicrosoftDataverseService } from "../generated";
import type { ScheduleDataSource } from "./data-source";
import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";

const ACCEPT = "application/json";
const PREFER = 'odata.include-annotations="*"';

type Row = Record<string, unknown>;

/** Run a ListRecords query and return the rows as plain key→value objects. */
async function listRecords(
  entitySet: string,
  opts: { select?: string; filter?: string; orderby?: string } = {},
): Promise<Row[]> {
  const res = await MicrosoftDataverseService.ListRecords(
    entitySet,
    PREFER,
    ACCEPT,
    false,
    opts.select,
    opts.filter,
    opts.orderby,
  );
  if (!res.success) {
    throw new Error(res.error?.message ?? `ListRecords(${entitySet}) failed`);
  }
  const items = res.data?.value ?? [];
  // Rows come back either flat or nested under `dynamicProperties` depending
  // on the connector metadata mode — normalize to a flat record.
  return items.map((it) => (it.dynamicProperties ?? (it as unknown)) as Row);
}

const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));

export const liveProductionDataSource: ScheduleDataSource = {
  kind: "production",
  async loadDepartments(): Promise<Department[]> {
    const rows = await listRecords("crfdf_departments", {
      select: "crfdf_departmentid,crfdf_departmentname",
      orderby: "crfdf_departmentname asc",
    });
    return rows.map((r, i) => ({
      id: str(r.crfdf_departmentid, str(r.crfdf_departmentname, `dept-${i}`)),
      name: str(r.crfdf_departmentname, "Department"),
      // crfdf_department has no flow-order / color column yet — derive a
      // stable order and use the engine's fallback color until columns land.
      flowOrder: i + 1,
      color: "#cccccc",
    }));
  },

  // --- Remaining methods: TODO once their tables are added as data sources. ---
  async loadEmployees(): Promise<Employee[]> {
    return [];
  },
  async loadScheduleLines(): Promise<ScheduleLine[]> {
    return [];
  },
  async loadWorkHours(): Promise<WorkHoursOverride[]> {
    return [];
  },
  async loadOvertimeOverrides(): Promise<OvertimeOverride[]> {
    return [];
  },
  async updateScheduleLine(): Promise<ScheduleLine> {
    throw new Error("updateScheduleLine not yet wired to Dataverse");
  },
  async createScheduleLine(): Promise<ScheduleLine> {
    throw new Error("createScheduleLine not yet wired to Dataverse");
  },
  async deleteScheduleLine(): Promise<void> {
    throw new Error("deleteScheduleLine not yet wired to Dataverse");
  },
};

/**
 * Dev probe: prove the live read end-to-end. Calls loadDepartments through the
 * Power SDK and logs the result. Invoked from main.tsx when running under the
 * Power Apps runtime (`pac code run`).
 */
export async function probeLiveDepartments(): Promise<void> {
  try {
    const depts = await liveProductionDataSource.loadDepartments();
    // eslint-disable-next-line no-console
    console.log(`[live-probe] loaded ${depts.length} departments from Dataverse:`, depts);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[live-probe] Dataverse read failed:", err);
  }
}
