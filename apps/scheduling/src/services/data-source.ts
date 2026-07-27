import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";

/**
 * Admin edit to a roster row (employee / crew). Production sources read
 * `name` + `departmentId`; installation sources read the install-specific
 * fields. Undefined fields are left unchanged on update; `truckNumber: null`
 * clears the truck.
 */
export interface ResourceAdminInput {
  name?: string;
  /** Production: department lookup id (crfdf_department1). */
  departmentId?: string;
  /** Installation: crfdf_location option value (group). */
  location?: number;
  /** Installation: crfdf_region — false = WK, true = NEK. */
  region?: boolean;
  /** Installation: crfdf_positiononschedule — zero-padded order string. */
  position?: string;
  /** Installation: crfdf_truck (null/"" clears it). */
  truckNumber?: string | null;
  /** Installation: crfdf_certifiedcraneoperator. */
  isCertifiedCraneOperator?: boolean;
  /** Standard clock hours available per work day (crfdf_standardhoursperday). */
  standardHoursPerDay?: number;
  /** Time-efficiency as a rate (1 = 100%). Scales available hours per day
   *  (crfdf_productivityrate). */
  productivityRate?: number;
}

export interface ScheduleDataSource {
  kind: ScheduleKind;
  loadDepartments(): Promise<Department[]>;
  loadEmployees(): Promise<Employee[]>;
  loadScheduleLines(from: Date, to: Date): Promise<ScheduleLine[]>;
  loadWorkHours(from: Date, to: Date): Promise<WorkHoursOverride[]>;
  loadOvertimeOverrides(from: Date, to: Date): Promise<OvertimeOverride[]>;
  updateScheduleLine(id: string, changes: Partial<ScheduleLine>): Promise<ScheduleLine>;
  createScheduleLine(line: ScheduleLine): Promise<ScheduleLine>;
  deleteScheduleLine(id: string): Promise<void>;
  // Roster admin (right-click). Implemented per-kind against the live roster
  // table; absent on mock sources (the store falls back to in-memory edits).
  createResource?(input: ResourceAdminInput): Promise<void>;
  updateResource?(id: string, input: ResourceAdminInput): Promise<void>;
  deleteResource?(id: string): Promise<void>;
}

export type ScheduleKind = "production" | "installation" | "shipping";

export interface ScheduleKindMeta {
  kind: ScheduleKind;
  title: string;
  resourceLabel: string;
  resourceLabelPlural: string;
  resourceGroupLabel: string;
}

export const KIND_META: Record<ScheduleKind, ScheduleKindMeta> = {
  production: {
    kind: "production",
    title: "Production Schedule",
    resourceLabel: "Employee",
    resourceLabelPlural: "Employees",
    resourceGroupLabel: "Department",
  },
  installation: {
    kind: "installation",
    title: "Installation & Service Schedule",
    resourceLabel: "Employee",
    resourceLabelPlural: "Employees",
    resourceGroupLabel: "Location",
  },
  shipping: {
    kind: "shipping",
    title: "Shipping Schedule",
    resourceLabel: "Truck",
    resourceLabelPlural: "Trucks",
    resourceGroupLabel: "Vehicle type",
  },
};

interface MockBackingData {
  departments: Department[];
  employees: Employee[];
  schedule: ScheduleLine[];
  workHours: WorkHoursOverride[];
  overtime: OvertimeOverride[];
}

export function createMockDataSource(
  kind: ScheduleKind,
  seed: MockBackingData,
  delayMs = 80,
): ScheduleDataSource {
  let schedule = seed.schedule.map((l) => ({ ...l }));

  function delay<T>(value: T): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
  }

  return {
    kind,

    async loadDepartments() {
      return delay(seed.departments.map((d) => ({ ...d })));
    },
    async loadEmployees() {
      return delay(seed.employees.map((e) => ({ ...e })));
    },
    async loadScheduleLines() {
      return delay(schedule.map((l) => ({ ...l })));
    },
    async loadWorkHours() {
      return delay(seed.workHours.map((w) => ({ ...w })));
    },
    async loadOvertimeOverrides() {
      return delay(seed.overtime.map((o) => ({ ...o })));
    },
    async updateScheduleLine(id, changes) {
      const idx = schedule.findIndex((l) => l.id === id);
      if (idx === -1) throw new Error(`Schedule line ${id} not found (${kind})`);
      schedule[idx] = { ...schedule[idx]!, ...changes };
      return delay({ ...schedule[idx]! });
    },
    async createScheduleLine(line) {
      schedule.push({ ...line });
      return delay({ ...line });
    },
    async deleteScheduleLine(id) {
      schedule = schedule.filter((l) => l.id !== id);
      return delay(undefined);
    },
  };
}
