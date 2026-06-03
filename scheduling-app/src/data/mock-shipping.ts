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

// Shipping departments are now destination CITIES, not vehicle types.
// Custom locations (e.g., "Colorado - DaVinci Signs") can be added at
// runtime through the Add Custom Location dialog on the Shipping
// calendar — they get a stable id prefix of `loc-custom-`.
export const SHIPPING_DEPARTMENTS: Department[] = [
  { id: "loc-wichita", name: "Wichita", flowOrder: 1, color: "#BED7FF" },
  { id: "loc-dodge", name: "Dodge City", flowOrder: 2, color: "#FAC775" },
  { id: "loc-topeka", name: "Topeka", flowOrder: 3, color: "#C8E6D4" },
  { id: "loc-lawrence", name: "Lawrence", flowOrder: 4, color: "#F8D5B7" },
  { id: "loc-olathe", name: "Olathe", flowOrder: 5, color: "#CECBF6" },
];

// Trucks are still the resources; they're now grouped by which city
// they primarily serve (default home base). Re-assignment is fine — the
// engine doesn't care which "department" a resource lives in for
// scheduling purposes, only for visual grouping.
export const SHIPPING_TRUCKS: Employee[] = [
  { id: "truck-w1", name: "WC-101 (Wichita)", departmentId: "loc-wichita", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 90 },
  { id: "truck-w2", name: "WC-102 (Wichita)", departmentId: "loc-wichita", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: true, hourlyRate: 90 },
  { id: "truck-d1", name: "DC-201 (Dodge City)", departmentId: "loc-dodge", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 70 },
  { id: "truck-t1", name: "TP-301 (Topeka)", departmentId: "loc-topeka", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 70 },
  { id: "truck-l1", name: "LW-401 (Lawrence)", departmentId: "loc-lawrence", productivityRate: 1, standardHoursPerDay: 10, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 65 },
  { id: "truck-o1", name: "OL-501 (Olathe)", departmentId: "loc-olathe", productivityRate: 1, standardHoursPerDay: 12, maxOvertimePerDay: 4, worksWeekends: true, hourlyRate: 70 },
];

export const SHIPPING_LINES: ScheduleLine[] = [
  {
    id: "sline-1",
    jobNo: "J102345",
    customerName: "Eastside Plaza · 1421 Main St",
    planningLineDescription: "Cabinet delivery",
    startDateTime: at(2, 7),
    endDateTime: at(2, 14),
    estimatedHours: 7,
    overrideHours: null,
    employeeId: "truck-w1",
    departmentId: "loc-wichita",
    customerDueDate: addDays(monday, 14),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "sline-2",
    jobNo: "J102301",
    customerName: "North Mall · 8800 Bridgeport Rd",
    planningLineDescription: "Raceway + letters",
    startDateTime: at(1, 7),
    endDateTime: at(1, 14),
    estimatedHours: 6,
    overrideHours: null,
    employeeId: "truck-w2",
    departmentId: "loc-wichita",
    customerDueDate: addDays(monday, 7),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "sline-3",
    jobNo: "J102501",
    customerName: "Riverside Diner · 502 River Pkwy",
    planningLineDescription: "Channel letters",
    startDateTime: at(3, 6),
    endDateTime: at(3, 11),
    estimatedHours: 5,
    overrideHours: null,
    employeeId: "truck-d1",
    departmentId: "loc-dodge",
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
    employeeId: "truck-t1",
    departmentId: "loc-topeka",
    customerDueDate: addDays(monday, 28),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "sline-5",
    jobNo: "NKC-024",
    customerName: "Crown Center Office · Kansas City, MO",
    planningLineDescription: "Lobby + exterior brand panels",
    startDateTime: at(2, 7),
    endDateTime: at(2, 13),
    estimatedHours: 6,
    overrideHours: null,
    employeeId: "truck-o1",
    departmentId: "loc-olathe",
    customerDueDate: addDays(monday, 21),
    isLocked: false,
    jobSequence: 1,
  },
  {
    id: "sline-6",
    jobNo: "J103401",
    customerName: "University of Kansas · Lawrence",
    planningLineDescription: "Wayfinding signage delivery",
    startDateTime: at(3, 8),
    endDateTime: at(3, 14),
    estimatedHours: 6,
    overrideHours: null,
    employeeId: "truck-l1",
    departmentId: "loc-lawrence",
    customerDueDate: addDays(monday, 18),
    isLocked: false,
    jobSequence: 1,
  },
];

export const SHIPPING_WORK_HOURS: WorkHoursOverride[] = [];
export const SHIPPING_OVERTIME: OvertimeOverride[] = [];
