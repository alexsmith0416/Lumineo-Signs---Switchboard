import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";

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
    title: "Production Scheduling",
    resourceLabel: "Employee",
    resourceLabelPlural: "Employees",
    resourceGroupLabel: "Department",
  },
  installation: {
    kind: "installation",
    title: "Installation Scheduling",
    resourceLabel: "Crew",
    resourceLabelPlural: "Crews",
    resourceGroupLabel: "Crew type",
  },
  shipping: {
    kind: "shipping",
    title: "Shipping Scheduling",
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
