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

// Department display + cascade order (top-to-bottom on the calendar).
export const MOCK_DEPARTMENTS: Department[] = [
  { id: "dept-routing", name: "Routing", flowOrder: 1, color: "#F8D5B7" },
  { id: "dept-metal", name: "Metal Fab", flowOrder: 2, color: "#BED7FF" },
  { id: "dept-paint", name: "Paint", flowOrder: 3, color: "#FAC775" },
  { id: "dept-assembly", name: "Assembly", flowOrder: 4, color: "#CECBF6" },
  { id: "dept-vinyl", name: "Vinyl / Graphics", flowOrder: 5, color: "#C8E6D4" },
  { id: "dept-steel", name: "Steel MFG", flowOrder: 6, color: "#D6DCE5" },
];

// Production roster as captured from the BC Project Scheduler. Productivity
// defaults to 100% / 8h/day until per-person rates are captured.
export const MOCK_EMPLOYEES: Employee[] = [
  { id: "emp-lee", name: "Lee McQueen", departmentId: "dept-steel", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 32 },

  { id: "emp-chris", name: "Chris Owen", departmentId: "dept-metal", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 32 },
  { id: "emp-len", name: "Len Cook Jr", departmentId: "dept-metal", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 30 },
  { id: "emp-terry", name: "Terry Heath", departmentId: "dept-metal", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 30 },

  { id: "emp-miguel", name: "Miguel Enriquez", departmentId: "dept-routing", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 30 },

  { id: "emp-chance", name: "Chance Carey", departmentId: "dept-paint", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 28 },
  { id: "emp-bill", name: "Bill Day", departmentId: "dept-paint", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 28 },
  { id: "emp-malaki", name: "Malaki Miller", departmentId: "dept-paint", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 28 },

  { id: "emp-tanner", name: "Tanner Rue", departmentId: "dept-vinyl", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 27 },

  { id: "emp-adam", name: "Adam Upshaw", departmentId: "dept-assembly", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 31 },
  { id: "emp-nick", name: "Nick Alkire", departmentId: "dept-assembly", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 4, worksWeekends: false, hourlyRate: 31 },
];

interface JobLineSeed {
  id: string;
  jobNo: string;
  customer: string;
  desc: string;
  emp: string;
  dept: string;
  day: number;
  hours: number;
  dueDays?: number;
}

function mkLine(s: JobLineSeed): ScheduleLine {
  const start = at(s.day, 8);
  return {
    id: s.id,
    jobNo: s.jobNo,
    customerName: s.customer,
    planningLineDescription: s.desc,
    startDateTime: start,
    endDateTime: at(s.day, 8 + Math.min(s.hours, 8)),
    estimatedHours: s.hours,
    overrideHours: null,
    employeeId: s.emp,
    departmentId: s.dept,
    customerDueDate: s.dueDays !== undefined ? addDays(monday, s.dueDays) : null,
    isLocked: false,
    jobSequence: 1,
  };
}

// Schedule reflects the BC Project Scheduler June 2026 view (`Project
// Scheduler__June_2026_LUM.pdf`). Day offsets are relative to the current
// Monday — so `day: 0` = this week Mon. Negative offsets pull jobs from
// the previous week (e.g., long-running jobs that began last week).
export const MOCK_SCHEDULE: ScheduleLine[] = [
  // ============ Vinyl / Graphics — Tanner Rue ============
  // Heavy graphics output spanning multiple jobs each week.
  mkLine({ id: "vr-1", jobNo: "J36732", customer: "Cypress Medical Park BLDG 300", desc: "Vinyl graphics + window film", emp: "emp-tanner", dept: "dept-vinyl", day: 0, hours: 16, dueDays: 14 }),
  mkLine({ id: "vr-2", jobNo: "J37501", customer: "Fidelity Bank", desc: "Brand vinyl application", emp: "emp-tanner", dept: "dept-vinyl", day: 2, hours: 12, dueDays: 14 }),
  mkLine({ id: "vr-3", jobNo: "J37245", customer: "Cambridge Dentistry", desc: "Wall vinyl + door graphics", emp: "emp-tanner", dept: "dept-vinyl", day: 3, hours: 8, dueDays: 21 }),
  mkLine({ id: "vr-4", jobNo: "J34645", customer: "Cedar Lake Village", desc: "Monument vinyl panels", emp: "emp-tanner", dept: "dept-vinyl", day: 4, hours: 8, dueDays: 21 }),
  // Next week
  mkLine({ id: "vr-5", jobNo: "J31712", customer: "HFG Architecture", desc: "Lobby + suite directory graphics", emp: "emp-tanner", dept: "dept-vinyl", day: 7, hours: 12, dueDays: 28 }),
  mkLine({ id: "vr-6", jobNo: "J37350", customer: "Vona Private Studio", desc: "Storefront vinyl + window graphics", emp: "emp-tanner", dept: "dept-vinyl", day: 9, hours: 6, dueDays: 28 }),
  mkLine({ id: "vr-7", jobNo: "J34578", customer: "Jimmy's Egg", desc: "Brand refresh — Phase A", emp: "emp-tanner", dept: "dept-vinyl", day: 10, hours: 5, dueDays: 28 }),
  mkLine({ id: "vr-8", jobNo: "J34579", customer: "Jimmy's Egg", desc: "Brand refresh — Phase B", emp: "emp-tanner", dept: "dept-vinyl", day: 10, hours: 5, dueDays: 28 }),
  mkLine({ id: "vr-9", jobNo: "J36730", customer: "Saint Luke's", desc: "Wayfinding vinyl program", emp: "emp-tanner", dept: "dept-vinyl", day: 11, hours: 8, dueDays: 35 }),

  // ============ Routing — Miguel Enriquez ============
  mkLine({ id: "rt-1", jobNo: "J34830", customer: "MERITRUST CREDIT UNION", desc: "CNC rout ACM panels", emp: "emp-miguel", dept: "dept-routing", day: 0, hours: 8, dueDays: 14 }),
  mkLine({ id: "rt-2", jobNo: "J31949", customer: "Refinery (at Stone Creek Station)", desc: "Route MDF base + halo letters", emp: "emp-miguel", dept: "dept-routing", day: 1, hours: 14, dueDays: 18 }),
  mkLine({ id: "rt-3", jobNo: "J35471", customer: "MERITRUST CREDIT UNION", desc: "Route monument inlays", emp: "emp-miguel", dept: "dept-routing", day: 3, hours: 8, dueDays: 18 }),
  mkLine({ id: "rt-4", jobNo: "J36938", customer: "Community National Bank and Trust", desc: "Route channel-letter blanks", emp: "emp-miguel", dept: "dept-routing", day: 4, hours: 8, dueDays: 21 }),
  // Next week
  mkLine({ id: "rt-5", jobNo: "J33316", customer: "Greenbush — Southeast KS Service Center", desc: "CNC rout HDU phase", emp: "emp-miguel", dept: "dept-routing", day: 7, hours: 10, dueDays: 28 }),
  mkLine({ id: "rt-6", jobNo: "J34689", customer: "Greenbush — Southeast KS Service Center", desc: "Rout ACM wall panels", emp: "emp-miguel", dept: "dept-routing", day: 9, hours: 8, dueDays: 28 }),
  mkLine({ id: "rt-7", jobNo: "J34690", customer: "Greenbush — Southeast KS Service Center", desc: "Rout interior way-finders", emp: "emp-miguel", dept: "dept-routing", day: 10, hours: 8, dueDays: 28 }),

  // ============ Metal Fab — Chris Owen ============
  mkLine({ id: "mf-1", jobNo: "J36861", customer: "First Security Bank", desc: "Cabinet fabrication", emp: "emp-chris", dept: "dept-metal", day: 0, hours: 16, dueDays: 18 }),
  mkLine({ id: "mf-2", jobNo: "J37225", customer: "NKC-018 NKCH Main Hospital Campus", desc: "Wayfinding metal package", emp: "emp-chris", dept: "dept-metal", day: 3, hours: 16, dueDays: 28 }),
  // Next week
  mkLine({ id: "mf-3", jobNo: "J36938", customer: "Community National Bank and Trust", desc: "Pole sign sub-structure", emp: "emp-chris", dept: "dept-metal", day: 7, hours: 12, dueDays: 28 }),
  mkLine({ id: "mf-4", jobNo: "J36940", customer: "Refinery (at Stone Creek Station)", desc: "Channel letter fab", emp: "emp-chris", dept: "dept-metal", day: 9, hours: 12, dueDays: 28 }),
  mkLine({ id: "mf-5", jobNo: "J35899", customer: "Food Bank of Reno County", desc: "Exterior cabinet weld-up", emp: "emp-chris", dept: "dept-metal", day: 11, hours: 8, dueDays: 35 }),

  // ============ Metal Fab — Terry Heath ============
  mkLine({ id: "mf-6", jobNo: "J37303", customer: "Refinery (at Stone Creek Station)", desc: "Halo letter brackets", emp: "emp-terry", dept: "dept-metal", day: 0, hours: 12, dueDays: 18 }),
  mkLine({ id: "mf-7", jobNo: "J37657", customer: "Newton Public Library", desc: "Reader-board frame", emp: "emp-terry", dept: "dept-metal", day: 2, hours: 12, dueDays: 21 }),
  mkLine({ id: "mf-8", jobNo: "J36343", customer: "Presbyterian Manors of Mid-America", desc: "Refurb pole sign frame", emp: "emp-terry", dept: "dept-metal", day: 4, hours: 8, dueDays: 21 }),
  // Next week
  mkLine({ id: "mf-9", jobNo: "J33316", customer: "Greenbush — Southeast KS Service Center", desc: "Bracket fab phase", emp: "emp-terry", dept: "dept-metal", day: 7, hours: 16, dueDays: 28 }),

  // ============ Metal Fab — Len Cook Jr ============
  mkLine({ id: "mf-10", jobNo: "J36774", customer: "Carlos O'Kelly's", desc: "Channel letter blanks", emp: "emp-len", dept: "dept-metal", day: 0, hours: 14, dueDays: 14 }),
  mkLine({ id: "mf-11", jobNo: "J35655", customer: "Lineage", desc: "Cabinet face frame", emp: "emp-len", dept: "dept-metal", day: 3, hours: 10, dueDays: 21 }),
  // Next week
  mkLine({ id: "mf-12", jobNo: "J36912", customer: "Wichita State Univ.", desc: "Sub-structure plate cut", emp: "emp-len", dept: "dept-metal", day: 7, hours: 12, dueDays: 28 }),

  // ============ Paint — Bill Day ============
  mkLine({ id: "pt-1", jobNo: "J29155", customer: "MORTON BUILDINGS", desc: "Powder coat cabinet", emp: "emp-bill", dept: "dept-paint", day: 0, hours: 16, dueDays: 14 }),
  mkLine({ id: "pt-2", jobNo: "J36343", customer: "Presbyterian Manors of Mid-America", desc: "Refurb pole sign topcoat", emp: "emp-bill", dept: "dept-paint", day: 3, hours: 10, dueDays: 21 }),
  // Next week
  mkLine({ id: "pt-3", jobNo: "J36774", customer: "Carlos O'Kelly's", desc: "Powder coat channel letters", emp: "emp-bill", dept: "dept-paint", day: 7, hours: 12, dueDays: 21 }),

  // ============ Paint — Chance Carey ============
  mkLine({ id: "pt-4", jobNo: "J33316", customer: "Greenbush — Southeast KS Service Center", desc: "Paint monument", emp: "emp-chance", dept: "dept-paint", day: 0, hours: 12, dueDays: 28 }),
  mkLine({ id: "pt-5", jobNo: "J35471", customer: "MERITRUST CREDIT UNION", desc: "Prime + topcoat panels", emp: "emp-chance", dept: "dept-paint", day: 3, hours: 10, dueDays: 18 }),
  // Next week
  mkLine({ id: "pt-6", jobNo: "J34689", customer: "Greenbush — Southeast KS Service Center", desc: "Paint ACM panels", emp: "emp-chance", dept: "dept-paint", day: 7, hours: 10, dueDays: 28 }),
  mkLine({ id: "pt-7", jobNo: "J34690", customer: "Greenbush — Southeast KS Service Center", desc: "Paint way-finders", emp: "emp-chance", dept: "dept-paint", day: 9, hours: 10, dueDays: 28 }),

  // ============ Paint — Malaki Miller ============
  mkLine({ id: "pt-8", jobNo: "J36774", customer: "Carlos O'Kelly's", desc: "Prime metal blanks", emp: "emp-malaki", dept: "dept-paint", day: 0, hours: 8, dueDays: 21 }),
  mkLine({ id: "pt-9", jobNo: "J36938", customer: "Community National Bank and Trust", desc: "Cabinet powder coat", emp: "emp-malaki", dept: "dept-paint", day: 2, hours: 12, dueDays: 28 }),
  // Next week
  mkLine({ id: "pt-10", jobNo: "J37569", customer: "Davis Liquor Outlet", desc: "Cabinet paint + striping", emp: "emp-malaki", dept: "dept-paint", day: 7, hours: 8, dueDays: 28 }),
  mkLine({ id: "pt-11", jobNo: "J33724", customer: "Dough Co Donuts", desc: "Powder coat letters", emp: "emp-malaki", dept: "dept-paint", day: 9, hours: 6, dueDays: 28 }),

  // ============ Assembly — Adam Upshaw ============
  mkLine({ id: "as-1", jobNo: "J36881", customer: "NMC Health — Medical Plaza of Park City", desc: "LED + face assembly", emp: "emp-adam", dept: "dept-assembly", day: 0, hours: 16, dueDays: 21 }),
  mkLine({ id: "as-2", jobNo: "J37350", customer: "Vona Private Studio", desc: "Final assembly + crating", emp: "emp-adam", dept: "dept-assembly", day: 3, hours: 12, dueDays: 28 }),
  // Next week
  mkLine({ id: "as-3", jobNo: "J37225", customer: "NKC-018 NKCH Main Hospital Campus", desc: "Wayfinder final assembly", emp: "emp-adam", dept: "dept-assembly", day: 7, hours: 14, dueDays: 28 }),
  mkLine({ id: "as-4", jobNo: "J31712", customer: "HFG Architecture", desc: "Directory final assembly", emp: "emp-adam", dept: "dept-assembly", day: 9, hours: 8, dueDays: 28 }),

  // ============ Assembly — Nick Alkire ============
  mkLine({ id: "as-5", jobNo: "J34926", customer: "Greenbush — Southeast KS Service Center", desc: "Letter assembly", emp: "emp-nick", dept: "dept-assembly", day: 0, hours: 16, dueDays: 28 }),
  mkLine({ id: "as-6", jobNo: "J34368", customer: "Walnut Reserve", desc: "Monument assembly", emp: "emp-nick", dept: "dept-assembly", day: 3, hours: 12, dueDays: 28 }),
  // Next week
  mkLine({ id: "as-7", jobNo: "J36121", customer: "Greenbush — Southeast KS Service Center", desc: "Interior letter assembly", emp: "emp-nick", dept: "dept-assembly", day: 7, hours: 14, dueDays: 28 }),
  mkLine({ id: "as-8", jobNo: "J37515", customer: "Dodge City Smiles", desc: "Cabinet final assembly", emp: "emp-nick", dept: "dept-assembly", day: 9, hours: 8, dueDays: 35 }),

  // ============ Steel MFG — Lee McQueen ============
  mkLine({ id: "st-1", jobNo: "J36617", customer: "Leiker Smiles Dental", desc: "Steel sub-structure weld", emp: "emp-lee", dept: "dept-steel", day: 0, hours: 10, dueDays: 14 }),
  mkLine({ id: "st-2", jobNo: "J35225", customer: "Leiker Smiles Dental", desc: "Steel cross-beam weld", emp: "emp-lee", dept: "dept-steel", day: 2, hours: 8, dueDays: 14 }),
  mkLine({ id: "st-3", jobNo: "J35663", customer: "Leiker Smiles Dental", desc: "Pole sign sub-structure", emp: "emp-lee", dept: "dept-steel", day: 3, hours: 8, dueDays: 14 }),
  mkLine({ id: "st-4", jobNo: "J36343", customer: "Presbyterian Manors of Mid-America", desc: "Pole refurb sub-frame", emp: "emp-lee", dept: "dept-steel", day: 4, hours: 8, dueDays: 21 }),
  // Next week
  mkLine({ id: "st-5", jobNo: "J29155", customer: "MORTON BUILDINGS", desc: "Steel mount kit", emp: "emp-lee", dept: "dept-steel", day: 7, hours: 16, dueDays: 28 }),
  mkLine({ id: "st-6", jobNo: "J36314", customer: "KS StateBank", desc: "Steel letter mounts", emp: "emp-lee", dept: "dept-steel", day: 10, hours: 6, dueDays: 35 }),
];

export const MOCK_WORK_HOURS: WorkHoursOverride[] = [];
export const MOCK_OVERTIME: OvertimeOverride[] = [];
