import { addDays, addHours, startOfDay } from "date-fns";
import type {
  Department,
  Employee,
  ScheduleContext,
  ScheduleLine,
} from "../types";

export const TEST_MONDAY = (() => {
  const d = startOfDay(new Date("2026-06-01T00:00:00Z"));
  return d;
})();

export function at(dayOffset: number, hour: number): Date {
  return addHours(addDays(TEST_MONDAY, dayOffset), hour);
}

const DEPTS: Department[] = [
  { id: "metal", name: "Metal Fab", flowOrder: 1, color: "#BED7FF" },
  { id: "paint", name: "Paint", flowOrder: 2, color: "#FAC775" },
  { id: "asm", name: "Assembly", flowOrder: 3, color: "#CECBF6" },
];

const EMPS: Employee[] = [
  { id: "bob", name: "Bob", departmentId: "metal", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 30 },
  { id: "tom", name: "Tom", departmentId: "paint", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 30 },
  { id: "dan", name: "Dan", departmentId: "asm", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 30 },
];

export function buildContext(schedule: ScheduleLine[]): ScheduleContext {
  return {
    departments: new Map(DEPTS.map((d) => [d.id, d])),
    employees: new Map(EMPS.map((e) => [e.id, e])),
    schedule: schedule.map((l) => ({ ...l })),
    workHours: [],
    overtime: [],
  };
}

let _id = 1;
export function line(partial: Partial<ScheduleLine> & {
  jobNo: string;
  employeeId: string;
  departmentId: string;
  start: Date;
  estimatedHours: number;
}): ScheduleLine {
  return {
    id: partial.id ?? `L${_id++}`,
    jobNo: partial.jobNo,
    customerName: partial.customerName ?? `Cust-${partial.jobNo}`,
    planningLineDescription: partial.planningLineDescription ?? `${partial.departmentId} task`,
    startDateTime: partial.start,
    endDateTime: partial.endDateTime ?? addHours(partial.start, partial.estimatedHours),
    estimatedHours: partial.estimatedHours,
    overrideHours: partial.overrideHours ?? null,
    employeeId: partial.employeeId,
    departmentId: partial.departmentId,
    customerDueDate: partial.customerDueDate ?? null,
    isLocked: partial.isLocked ?? false,
    jobSequence: partial.jobSequence ?? 0,
    isCustom: partial.isCustom,
    spanDays: partial.spanDays,
    splitGroupId: partial.splitGroupId,
  };
}
