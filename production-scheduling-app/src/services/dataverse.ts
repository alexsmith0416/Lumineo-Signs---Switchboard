import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";
import type { ScheduleDataSource } from "./data-source";

// M1 scaffold: NOT WIRED. M2 (ALE-80) replaces this with a real Power SDK
// adapter that reads the production schedule from the Airtable → Dataverse
// mirror (docs/13-airtable-bridge-mapping.md, docs/15-scheduling-app-spec.md
// §8.6). The adapter must satisfy the ScheduleDataSource interface in
// ./data-source.ts; stores and UI port verbatim from the prototype.

const WARN_KEY = "__lumineo_stub_warned_production__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[stub] productionDataSource is not wired yet (M2 / ALE-80). " +
      "Reads return []; writes throw. " +
      "Replace src/services/dataverse.ts with the Airtable→Dataverse adapter.",
  );
}

function notImplemented(op: string): never {
  throw new Error(
    `[NotImplemented] productionDataSource.${op} — wire in M2 (ALE-80). ` +
      "See docs/15-scheduling-app-spec.md §8.1 / §8.6.",
  );
}

export const productionDataSource: ScheduleDataSource = {
  kind: "production",
  async loadDepartments(): Promise<Department[]> {
    warnOnce();
    return [];
  },
  async loadEmployees(): Promise<Employee[]> {
    warnOnce();
    return [];
  },
  async loadScheduleLines(): Promise<ScheduleLine[]> {
    warnOnce();
    return [];
  },
  async loadWorkHours(): Promise<WorkHoursOverride[]> {
    warnOnce();
    return [];
  },
  async loadOvertimeOverrides(): Promise<OvertimeOverride[]> {
    warnOnce();
    return [];
  },
  async updateScheduleLine() {
    return notImplemented("updateScheduleLine");
  },
  async createScheduleLine() {
    return notImplemented("createScheduleLine");
  },
  async deleteScheduleLine() {
    return notImplemented("deleteScheduleLine");
  },
};

// Preserved alias — legacy imports continue to compile.
export const dataverseService = productionDataSource;
