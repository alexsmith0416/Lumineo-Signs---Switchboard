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

// "Vehicle types" filling the `Department` slot.
export const SHIPPING_DEPARTMENTS: Department[] = [
  { id: "veh-flatbed", name: "Flatbed", flowOrder: 1, color: "#BED7FF" },
  { id: "veh-box", name: "Box Truck", flowOrder: 2, color: "#FAC775" },
  { id: "veh-hotshot", name: "Hot Shot", flowOrder: 3, color: "#FFE0A8" },
];

export const SHIPPING_TRUCKS: Employee[] = [
  { id: "truck-1", name: "FB-101 (Flatbed)", departmentId: "veh-flatbed", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 90 },
  { id: "truck-2", name: "FB-102 (Flatbed)", departmentId: "veh-flatbed", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: true, hourlyRate: 90 },
  { id: "truck-3", name: "BX-201 (24 ft)", departmentId: "veh-box", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 70 },
  { id: "truck-4", name: "BX-202 (16 ft)", departmentId: "veh-box", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 60 },
  { id: "truck-5", name: "HS-301 (Cargo)", departmentId: "veh-hotshot", productivityRate: 1, standardHoursPerDay: 12, maxOvertimePerDay: 4, worksWeekends: true, hourlyRate: 55 },
];

export const SHIPPING_LINES: ScheduleLine[] = [
  {
    id: "sline-1",
    jobNo: "J102345",
    customerName: "Eastside Plaza · 1421 Main St",
    planningLineDescription: "Cabinet delivery (LTL → Flatbed)",
    startDateTime: at(2, 7),
    endDateTime: at(2, 14),
    estimatedHours: 7,
    overrideHours: null,
    employeeId: "truck-1",
    departmentId: "veh-flatbed",
    customerDueDate: addDays(monday, 14),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "sline-2",
    jobNo: "J102301",
    customerName: "North Mall · 8800 Bridgeport Rd",
    planningLineDescription: "Raceway + letters (Box)",
    startDateTime: at(1, 7),
    endDateTime: at(1, 14),
    estimatedHours: 6,
    overrideHours: null,
    employeeId: "truck-3",
    departmentId: "veh-box",
    customerDueDate: addDays(monday, 7),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "sline-3",
    jobNo: "J102501",
    customerName: "Riverside Diner · 502 River Pkwy",
    planningLineDescription: "Channel letters (Hot Shot)",
    startDateTime: at(3, 6),
    endDateTime: at(3, 11),
    estimatedHours: 5,
    overrideHours: null,
    employeeId: "truck-5",
    departmentId: "veh-hotshot",
    customerDueDate: addDays(monday, 21),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "sline-4",
    jobNo: "J102801",
    customerName: "West Lake Office Park · 22 Lakeview Dr",
    planningLineDescription: "Monument sign panels",
    startDateTime: at(4, 7),
    endDateTime: at(4, 15),
    estimatedHours: 8,
    overrideHours: null,
    employeeId: "truck-2",
    departmentId: "veh-flatbed",
    customerDueDate: addDays(monday, 28),
    isLocked: false,
    jobSequence: 1,
  },
];

export const SHIPPING_WORK_HOURS: WorkHoursOverride[] = [];
export const SHIPPING_OVERTIME: OvertimeOverride[] = [];
