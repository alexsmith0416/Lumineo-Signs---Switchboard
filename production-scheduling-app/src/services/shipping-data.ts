import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";
import type { ScheduleDataSource } from "./data-source";

// M1 scaffold: NOT WIRED. M7 (ALE-85) replaces this with a real Power SDK
// adapter reading `crfdf_shippingscheduleline` from the Airtable → Dataverse
// mirror.

const WARN_KEY = "__lumineo_stub_warned_shipping__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[stub] shippingDataSource is not wired yet (M7 / ALE-85). " +
      "Reads return []; writes throw. " +
      "Replace src/services/shipping-data.ts with the Airtable→Dataverse adapter.",
  );
}

function notImplemented(op: string): never {
  throw new Error(
    `[NotImplemented] shippingDataSource.${op} — wire in M7 (ALE-85). ` +
      "See docs/15-scheduling-app-spec.md §8.1 / §8.6.",
  );
}

export const shippingDataSource: ScheduleDataSource = {
  kind: "shipping",
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
