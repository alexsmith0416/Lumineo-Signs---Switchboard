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

// ============================================================
// WK Region — Hutchinson / Wichita / Salina / Dodge City
// "Departments" here are base locations.
// ============================================================

export const WK_DEPARTMENTS: Department[] = [
  { id: "loc-hutch", name: "Hutchinson", flowOrder: 1, color: "#BED7FF" },
  { id: "loc-wichita", name: "Wichita", flowOrder: 2, color: "#FAC775" },
  { id: "loc-salina", name: "Salina", flowOrder: 3, color: "#C8E6D4" },
  { id: "loc-dodge", name: "Dodge City", flowOrder: 4, color: "#F8D5B7" },
];

export const WK_CREWS: Employee[] = [
  { id: "wk-dustin", name: "Dustin / CCO", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-al", name: "AL / CCO (F96)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-aiden", name: "Aiden", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 55 },
  { id: "wk-jason", name: "Jason / CCO (60)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-doug", name: "Doug / CCO (F38)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-lee", name: "Lee (F81/F50)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 58 },
  { id: "wk-heath", name: "Heath / CCO", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-ray", name: "Ray / CCO (F52)", departmentId: "loc-wichita", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-don", name: "Don D.", departmentId: "loc-salina", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 55 },
  { id: "wk-danny", name: "Danny / CCO (420)", departmentId: "loc-dodge", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-thomas", name: "Thomas (D90)", departmentId: "loc-dodge", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 55 },
];

interface MakeLineInput {
  id: string;
  jobNo: string;
  customer: string;
  desc: string;
  emp: string;
  loc: string;
  day: number;
  hours: number;
  zip: string;
  invoice: number;
  crew: number;
  trucks: number;
  cranes?: number;
  lifts?: number;
  region: "WK" | "NEK";
}

function mkLine(i: MakeLineInput): ScheduleLine {
  return {
    id: i.id,
    jobNo: i.jobNo,
    customerName: i.customer,
    planningLineDescription: i.desc,
    startDateTime: at(i.day, 8),
    endDateTime: at(i.day, 8 + Math.min(i.hours, 8)),
    estimatedHours: i.hours,
    overrideHours: null,
    employeeId: i.emp,
    departmentId: i.loc,
    customerDueDate: null,
    isLocked: false,
    jobSequence: 1,
    invoiceAmount: i.invoice,
    crewPersons: i.crew,
    crewTrucks: i.trucks,
    crewCranes: i.cranes ?? 0,
    crewLifts: i.lifts ?? 0,
    crewBuckets: 0,
    installZip: i.zip,
    region: i.region,
  };
}

// Schedule lines for WK week of 5/25/26 mapped to current-week day offsets.
// Day 0 = Mon (Memorial Day holiday — no install lines), 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat.
export const WK_LINES: ScheduleLine[] = [
  // ============ Tuesday — McPherson J35730 (multi-crew) ============
  mkLine({ id: "wk-1", jobNo: "J35730", customer: "McPherson", desc: "Install remaining set of RGB channel letters", emp: "wk-al", loc: "loc-hutch", day: 1, hours: 8, zip: "67460", invoice: 24500, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-2", jobNo: "J35730", customer: "McPherson", desc: "Install remaining set of RGB channel letters", emp: "wk-aiden", loc: "loc-hutch", day: 1, hours: 8, zip: "67460", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-3", jobNo: "J35730", customer: "McPherson", desc: "Install remaining set of RGB channel letters", emp: "wk-doug", loc: "loc-hutch", day: 1, hours: 8, zip: "67460", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-4", jobNo: "J35730", customer: "McPherson", desc: "Install remaining set of RGB channel letters", emp: "wk-heath", loc: "loc-hutch", day: 1, hours: 8, zip: "67460", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-5", jobNo: "J36617", customer: "Leiker (Steel)", desc: "Weld up cross beam with transition pipe", emp: "wk-lee", loc: "loc-hutch", day: 1, hours: 8, zip: "67501", invoice: 8500, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-6", jobNo: "J36842", customer: "First Dental", desc: "Reinstall cabinet and new faces", emp: "wk-danny", loc: "loc-dodge", day: 1, hours: 4, zip: "67801", invoice: 12800, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-7", jobNo: "J37441", customer: "Southwest Livestock", desc: "Install ACM panel", emp: "wk-danny", loc: "loc-dodge", day: 1, hours: 4, zip: "67801", invoice: 6200, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-8", jobNo: "J36842", customer: "First Dental", desc: "Reinstall cabinet and new faces", emp: "wk-thomas", loc: "loc-dodge", day: 1, hours: 4, zip: "67801", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-9", jobNo: "J37441", customer: "Southwest Livestock", desc: "Install ACM panel", emp: "wk-thomas", loc: "loc-dodge", day: 1, hours: 4, zip: "67801", invoice: 0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Wednesday ============
  mkLine({ id: "wk-10", jobNo: "J34016", customer: "Bethel (with Chuck)", desc: "Install donor wall panels", emp: "wk-dustin", loc: "loc-hutch", day: 2, hours: 8, zip: "67114", invoice: 18400, crew: 2, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-11", jobNo: "J33841", customer: "Goodwill", desc: "Install quick sticks, faces, paint pole cabinet + retainers", emp: "wk-al", loc: "loc-hutch", day: 2, hours: 8, zip: "67501", invoice: 32600, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-12", jobNo: "J33841", customer: "Goodwill", desc: "Install quick sticks, faces, paint pole cabinet + retainers", emp: "wk-aiden", loc: "loc-hutch", day: 2, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-13", jobNo: "J36944", customer: "City of Wichita (light columns)", desc: "Install letters", emp: "wk-jason", loc: "loc-hutch", day: 2, hours: 4, zip: "67202", invoice: 14200, crew: 1, trucks: 1, lifts: 1, region: "WK" }),
  mkLine({ id: "wk-14", jobNo: "J37686", customer: "Carlos O'Kelly's", desc: "Remove 1 set of raceway mounted channel letters", emp: "wk-jason", loc: "loc-hutch", day: 2, hours: 4, zip: "67202", invoice: 4200, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-15", jobNo: "J29256", customer: "Salina Fire", desc: "Install letters", emp: "wk-heath", loc: "loc-hutch", day: 2, hours: 4, zip: "67401", invoice: 9800, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-16", jobNo: "J37686", customer: "Carlos O'Kelly's", desc: "Remove channel letters", emp: "wk-heath", loc: "loc-hutch", day: 2, hours: 4, zip: "67401", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-17", jobNo: "J35663-J36617", customer: "Leiker", desc: "Install S/F wall sign + refurb pole sign + weld cross beam (overnight)", emp: "wk-doug", loc: "loc-hutch", day: 2, hours: 8, zip: "67501", invoice: 41200, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-18", jobNo: "J35663-J36617", customer: "Leiker", desc: "Install S/F wall sign + refurb pole sign + weld cross beam (overnight)", emp: "wk-lee", loc: "loc-hutch", day: 2, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-19", jobNo: "J37472", customer: "Farm Bureau", desc: "Install vinyl wrap", emp: "wk-danny", loc: "loc-dodge", day: 2, hours: 4, zip: "67801", invoice: 7600, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-20", jobNo: "GC-svc", customer: "G.C. Service", desc: "Service call", emp: "wk-danny", loc: "loc-dodge", day: 2, hours: 4, zip: "67801", invoice: 2400, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-21", jobNo: "J36364", customer: "Satanta Hospital", desc: "Replace damaged louvers", emp: "wk-thomas", loc: "loc-dodge", day: 2, hours: 8, zip: "67801", invoice: 5800, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-22", jobNo: "J28930", customer: "Childrens Mercy", desc: "Install channel letters", emp: "wk-don", loc: "loc-salina", day: 2, hours: 8, zip: "67401", invoice: 28400, crew: 1, trucks: 1, region: "WK" }),

  // ============ Thursday ============
  mkLine({ id: "wk-23", jobNo: "J36734", customer: "First Security", desc: "Remove old cabinet + install new flex face cabinet", emp: "wk-al", loc: "loc-hutch", day: 3, hours: 4, zip: "67501", invoice: 22300, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-24", jobNo: "J36219", customer: "First Security", desc: "Install channel letters", emp: "wk-al", loc: "loc-hutch", day: 3, hours: 4, zip: "67501", invoice: 9400, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-25", jobNo: "J36734", customer: "First Security", desc: "Remove old cabinet + install new flex face cabinet", emp: "wk-aiden", loc: "loc-hutch", day: 3, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-26", jobNo: "J36219", customer: "First Security", desc: "Install channel letters", emp: "wk-aiden", loc: "loc-hutch", day: 3, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-27", jobNo: "J36734", customer: "First Security", desc: "Remove old cabinet + install new flex face cabinet", emp: "wk-jason", loc: "loc-hutch", day: 3, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-28", jobNo: "J36219", customer: "First Security", desc: "Install channel letters", emp: "wk-jason", loc: "loc-hutch", day: 3, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-29", jobNo: "J35663-J36617", customer: "Leiker (overnight Russel?/Oneok?)", desc: "Install S/F wall sign + refurb pole + weld transition", emp: "wk-doug", loc: "loc-hutch", day: 3, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-30", jobNo: "J35663-J36617", customer: "Leiker (overnight Russel?/Oneok?)", desc: "Install S/F wall sign + refurb pole + weld transition", emp: "wk-lee", loc: "loc-hutch", day: 3, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-31", jobNo: "J32903", customer: "Minneola Healthcare", desc: "Set base pipe", emp: "wk-danny", loc: "loc-dodge", day: 3, hours: 8, zip: "67865", invoice: 6700, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-32", jobNo: "J32903", customer: "Minneola Healthcare", desc: "Set base pipe", emp: "wk-thomas", loc: "loc-dodge", day: 3, hours: 8, zip: "67865", invoice: 0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Friday ============
  mkLine({ id: "wk-33", jobNo: "J36228", customer: "First Security (Conway)", desc: "Install raceway mounted channel letters", emp: "wk-al", loc: "loc-hutch", day: 4, hours: 4, zip: "67501", invoice: 16200, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-34", jobNo: "J36253", customer: "First Security (Norwich)", desc: "Install S/F routed cabinet", emp: "wk-al", loc: "loc-hutch", day: 4, hours: 4, zip: "67118", invoice: 18700, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-35", jobNo: "J36228", customer: "First Security (Conway)", desc: "Install raceway mounted channel letters", emp: "wk-aiden", loc: "loc-hutch", day: 4, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-36", jobNo: "J36253", customer: "First Security (Norwich)", desc: "Install S/F routed cabinet", emp: "wk-aiden", loc: "loc-hutch", day: 4, hours: 4, zip: "67118", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-37", jobNo: "J36228", customer: "First Security (Conway)", desc: "Install raceway mounted channel letters", emp: "wk-jason", loc: "loc-hutch", day: 4, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-38", jobNo: "J36253", customer: "First Security (Norwich)", desc: "Install S/F routed cabinet", emp: "wk-jason", loc: "loc-hutch", day: 4, hours: 4, zip: "67118", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-39", jobNo: "J36515-J36516", customer: "Childrens Mercy", desc: "Set poles and mow pads", emp: "wk-doug", loc: "loc-hutch", day: 4, hours: 8, zip: "67401", invoice: 26800, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-40", jobNo: "J36314", customer: "KS State Bank", desc: "Install letter faces", emp: "wk-lee", loc: "loc-hutch", day: 4, hours: 4, zip: "67501", invoice: 7400, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-41", jobNo: "J36343", customer: "Presbyterian Manors", desc: "Remove faces and bring back for refurb", emp: "wk-lee", loc: "loc-hutch", day: 4, hours: 4, zip: "67501", invoice: 3200, crew: 1, trucks: 0, region: "WK" }),

  // ============ Saturday ============
  mkLine({ id: "wk-42", jobNo: "J-CN-GB", customer: "Central National Great Bend", desc: "Install monument faces, S/F wall sign, small pan sign, window vinyl", emp: "wk-don", loc: "loc-salina", day: 5, hours: 8, zip: "67530", invoice: 38900, crew: 1, trucks: 1, region: "WK" }),
];

export const WK_WORK_HOURS: WorkHoursOverride[] = [];
export const WK_OVERTIME: OvertimeOverride[] = [];

// ============================================================
// NEK Region — Kansas City area
// ============================================================

export const NEK_DEPARTMENTS: Department[] = [
  { id: "loc-nek", name: "NEK Crews", flowOrder: 1, color: "#CECBF6" },
];

export const NEK_CREWS: Employee[] = [
  { id: "nek-justinf", name: "Justin F", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-stanc", name: "Stan C", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-kevinb", name: "Kevin B", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-morganm", name: "Morgan M", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-connerp", name: "Conner P", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-aaronw", name: "Aaron W", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-jarrodl", name: "Jarrod L", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-justinj", name: "Justin J", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-joshs", name: "Josh S", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
];

export const NEK_LINES: ScheduleLine[] = [
  // Tuesday — NKC-017 sign packages + CMH J31961
  mkLine({ id: "nek-1", jobNo: "NKC-017 / J36394-J36398", customer: "NKC-017 Sign Package", desc: "Install sign package", emp: "nek-stanc", loc: "loc-nek", day: 1, hours: 8, zip: "64106", invoice: 84200, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-2", jobNo: "NKC-017 / J36394-J36398", customer: "NKC-017 Sign Package", desc: "Install sign package", emp: "nek-morganm", loc: "loc-nek", day: 1, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-3", jobNo: "NKC-017 / J36394-J36398", customer: "NKC-017 Sign Package", desc: "Install sign package", emp: "nek-connerp", loc: "loc-nek", day: 1, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-4", jobNo: "NKC-017 / J36394-J36398", customer: "NKC-017 Sign Package", desc: "Install sign package", emp: "nek-justinj", loc: "loc-nek", day: 1, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-5", jobNo: "NKC-011 / J36201-J36205", customer: "NKC-011 Sign Package", desc: "Install sign package", emp: "nek-jarrodl", loc: "loc-nek", day: 1, hours: 8, zip: "64106", invoice: 92500, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-6", jobNo: "NKC-011 / J36201-J36205", customer: "NKC-011 Sign Package", desc: "Install sign package", emp: "nek-joshs", loc: "loc-nek", day: 1, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-7", jobNo: "J31961", customer: "CMH", desc: "Install digital print (on site 9:30)", emp: "nek-aaronw", loc: "loc-nek", day: 1, hours: 8, zip: "64108", invoice: 18600, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-8", jobNo: "svc-sprinkler", customer: "Site Maintenance", desc: "Fix broken sprinkler line", emp: "nek-kevinb", loc: "loc-nek", day: 1, hours: 6, zip: "64106", invoice: 1800, crew: 1, trucks: 1, region: "NEK" }),

  // Wednesday — NKC-019 packages, NKC-011, CMH J36200, Cap Fed J37163, Foley J36696
  mkLine({ id: "nek-9", jobNo: "NKC-019", customer: "NKC-019 Sign Package", desc: "Install sign package", emp: "nek-stanc", loc: "loc-nek", day: 2, hours: 8, zip: "64106", invoice: 76800, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-10", jobNo: "NKC-019", customer: "NKC-019 Sign Package", desc: "Install sign package", emp: "nek-morganm", loc: "loc-nek", day: 2, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-11", jobNo: "NKC-019", customer: "NKC-019 Sign Package", desc: "Install sign package", emp: "nek-connerp", loc: "loc-nek", day: 2, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-12", jobNo: "NKC-011 / J36201-J36205", customer: "NKC-011 Sign Package", desc: "Install sign package", emp: "nek-jarrodl", loc: "loc-nek", day: 2, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-13", jobNo: "NKC-011 / J36201-J36205", customer: "NKC-011 Sign Package", desc: "Install sign package", emp: "nek-joshs", loc: "loc-nek", day: 2, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-14", jobNo: "J36200", customer: "CMH", desc: "Install vinyl (J36408/J36394-J36398, NKC-019/NKC-017)", emp: "nek-aaronw", loc: "loc-nek", day: 2, hours: 8, zip: "64108", invoice: 12400, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-15", jobNo: "J37163", customer: "Cap Fed", desc: "Interior install", emp: "nek-justinj", loc: "loc-nek", day: 2, hours: 4, zip: "66102", invoice: 14600, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-16", jobNo: "J36696", customer: "Foley", desc: "Install panels", emp: "nek-justinj", loc: "loc-nek", day: 2, hours: 4, zip: "66102", invoice: 7800, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-17", jobNo: "svc-meet-elec", customer: "Site Meeting", desc: "Meet electrician", emp: "nek-kevinb", loc: "loc-nek", day: 2, hours: 4, zip: "64106", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),

  // Thursday — NKC-018, CMH-Don Chisolm J31961, lots of numbers
  mkLine({ id: "nek-18", jobNo: "J31961", customer: "CMH - Don Chisolm", desc: "Install sign package", emp: "nek-stanc", loc: "loc-nek", day: 3, hours: 8, zip: "64108", invoice: 19200, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-19", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 3, hours: 8, zip: "64106", invoice: 102400, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-20", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 3, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-21", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 3, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-22", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 3, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-23", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 3, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // Friday — NKC-018 continues, Kevin B Lee help on J36343
  mkLine({ id: "nek-24", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 4, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-25", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 4, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-26", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 4, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-27", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 4, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-28", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 4, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-29", jobNo: "NKC-018", customer: "NKC-018 Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 4, hours: 8, zip: "64106", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-30", jobNo: "svc-meet-roof", customer: "Roofing Co Meeting", desc: "Meet Roofing Co · 11 AM · 6450 N Chatam Ave", emp: "nek-kevinb", loc: "loc-nek", day: 4, hours: 3, zip: "64151", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-31", jobNo: "J36343", customer: "Presbyterian Manors (Lawrence)", desc: "Lee needs help", emp: "nek-kevinb", loc: "loc-nek", day: 4, hours: 5, zip: "66044", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
];

export const NEK_WORK_HOURS: WorkHoursOverride[] = [];
export const NEK_OVERTIME: OvertimeOverride[] = [];

// Re-export legacy names so existing imports keep compiling.
export {
  WK_DEPARTMENTS as INSTALL_DEPARTMENTS,
  WK_CREWS as INSTALL_CREWS,
  WK_LINES as INSTALL_LINES,
  WK_WORK_HOURS as INSTALL_WORK_HOURS,
  WK_OVERTIME as INSTALL_OVERTIME,
};
