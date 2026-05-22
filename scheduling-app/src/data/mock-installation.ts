import { addDays, addHours, startOfWeek } from "date-fns";
import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";

const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
function at(dayOffset: number, hour: number): Date {
  return addHours(addDays(monday, dayOffset), hour);
}

// "Crew types" filling the `Department` slot. Flow order is used as
// staging: site survey → install → punch list.
export const INSTALL_DEPARTMENTS: Department[] = [
  { id: "crew-survey", name: "Site Survey", flowOrder: 1, color: "#C8E6D4" },
  { id: "crew-mount", name: "Mount Crew", flowOrder: 2, color: "#FFE0A8" },
  { id: "crew-electric", name: "Electric", flowOrder: 3, color: "#BED7FF" },
  { id: "crew-punch", name: "Punch List", flowOrder: 4, color: "#CECBF6" },
];

export const INSTALL_CREWS: Employee[] = [
  { id: "icrew-1", name: "Alpha Survey", departmentId: "crew-survey", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 80 },
  { id: "icrew-2", name: "Bravo 2M+1T", departmentId: "crew-mount", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 110 },
  { id: "icrew-3", name: "Charlie 3M+1T", departmentId: "crew-mount", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 140 },
  { id: "icrew-4", name: "Delta Electric", departmentId: "crew-electric", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 95 },
  { id: "icrew-5", name: "Echo Punch", departmentId: "crew-punch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 75 },
];

export const INSTALL_LINES: ScheduleLine[] = [
  {
    id: "iline-1",
    jobNo: "J102345",
    customerName: "Eastside Plaza",
    planningLineDescription: "Site survey + access check",
    startDateTime: at(0, 8),
    endDateTime: at(0, 13),
    estimatedHours: 5,
    overrideHours: null,
    employeeId: "icrew-1",
    departmentId: "crew-survey",
    customerDueDate: addDays(monday, 14),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "iline-2",
    jobNo: "J102345",
    customerName: "Eastside Plaza",
    planningLineDescription: "Cabinet mount (2M+1T)",
    startDateTime: at(2, 8),
    endDateTime: at(2, 16),
    estimatedHours: 8,
    overrideHours: null,
    employeeId: "icrew-2",
    departmentId: "crew-mount",
    customerDueDate: addDays(monday, 14),
    isLocked: false,
    jobSequence: 2,
  },
  {
    id: "iline-3",
    jobNo: "J102345",
    customerName: "Eastside Plaza",
    planningLineDescription: "Power + final wiring",
    startDateTime: at(3, 8),
    endDateTime: at(3, 14),
    estimatedHours: 5,
    overrideHours: null,
    employeeId: "icrew-4",
    departmentId: "crew-electric",
    customerDueDate: addDays(monday, 14),
    isLocked: false,
    jobSequence: 3,
  },
  {
    id: "iline-4",
    jobNo: "J102301",
    customerName: "North Mall",
    planningLineDescription: "Channel letter install (3M+1T)",
    startDateTime: at(1, 8),
    endDateTime: at(1, 16),
    estimatedHours: 8,
    overrideHours: null,
    employeeId: "icrew-3",
    departmentId: "crew-mount",
    customerDueDate: addDays(monday, 7),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "iline-5",
    jobNo: "J102301",
    customerName: "North Mall",
    planningLineDescription: "Final electric + punch list",
    startDateTime: at(2, 8),
    endDateTime: at(2, 14),
    estimatedHours: 6,
    overrideHours: null,
    employeeId: "icrew-5",
    departmentId: "crew-punch",
    customerDueDate: addDays(monday, 7),
    isLocked: false,
    jobSequence: 2,
  },
];

export const INSTALL_WORK_HOURS: WorkHoursOverride[] = [];
export const INSTALL_OVERTIME: OvertimeOverride[] = [];
