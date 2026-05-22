import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";
import {
  MOCK_DEPARTMENTS,
  MOCK_EMPLOYEES,
  MOCK_OVERTIME,
  MOCK_SCHEDULE,
  MOCK_WORK_HOURS,
} from "../data/mock-schedule";

// STUB: replace with real Power SDK in M1 final / M2.
// declare const powerSDK: { ... }
// import { Tables } from "../../.power/generated";

let liveSchedule: ScheduleLine[] = MOCK_SCHEDULE.map((l) => ({ ...l }));

function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const dataverseService = {
  async loadDepartments(): Promise<Department[]> {
    return delay(MOCK_DEPARTMENTS.map((d) => ({ ...d })));
  },

  async loadEmployees(): Promise<Employee[]> {
    return delay(MOCK_EMPLOYEES.map((e) => ({ ...e })));
  },

  async loadScheduleLines(_from: Date, _to: Date): Promise<ScheduleLine[]> {
    return delay(liveSchedule.map((l) => ({ ...l })));
  },

  async loadWorkHours(_from: Date, _to: Date): Promise<WorkHoursOverride[]> {
    return delay(MOCK_WORK_HOURS.map((w) => ({ ...w })));
  },

  async loadOvertimeOverrides(_from: Date, _to: Date): Promise<OvertimeOverride[]> {
    return delay(MOCK_OVERTIME.map((o) => ({ ...o })));
  },

  async updateScheduleLine(
    id: string,
    changes: Partial<ScheduleLine>,
  ): Promise<ScheduleLine> {
    const idx = liveSchedule.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error(`Schedule line ${id} not found`);
    liveSchedule[idx] = { ...liveSchedule[idx]!, ...changes };
    return delay({ ...liveSchedule[idx]! });
  },

  async createScheduleLine(line: ScheduleLine): Promise<ScheduleLine> {
    liveSchedule.push({ ...line });
    return delay({ ...line });
  },

  async deleteScheduleLine(id: string): Promise<void> {
    liveSchedule = liveSchedule.filter((l) => l.id !== id);
    return delay(undefined);
  },
};

export type DataverseService = typeof dataverseService;
