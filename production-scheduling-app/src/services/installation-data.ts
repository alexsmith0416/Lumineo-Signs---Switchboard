import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";
import type { ScheduleDataSource } from "./data-source";

// M1 scaffold: NOT WIRED. M6 (ALE-84) replaces this with real Power SDK
// adapters reading WK + NEK install lines from the Airtable → Dataverse
// mirror (filtered by region). Crew fields are populated by the
// CrewAssignment table per docs/10-crew-truck-indicator-spec.md once M10
// lands.

function makeStub(region: "WK" | "NEK"): ScheduleDataSource {
  const warnKey = `__lumineo_stub_warned_install_${region}__`;

  function warnOnce(): void {
    const g = globalThis as Record<string, unknown>;
    if (g[warnKey]) return;
    g[warnKey] = true;
    console.warn(
      `[stub] ${region} install data source is not wired yet (M6 / ALE-84). ` +
        "Reads return []; writes throw. " +
        "Replace src/services/installation-data.ts with the regional adapters.",
    );
  }

  function notImplemented(op: string): never {
    throw new Error(
      `[NotImplemented] ${region}InstallDataSource.${op} — wire in M6 (ALE-84). ` +
        "See docs/15-scheduling-app-spec.md §8.1 / §8.6.",
    );
  }

  return {
    kind: "installation",
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
}

export const wkInstallDataSource: ScheduleDataSource = makeStub("WK");
export const nekInstallDataSource: ScheduleDataSource = makeStub("NEK");

// Default — most existing imports point here.
export const installationDataSource = wkInstallDataSource;
