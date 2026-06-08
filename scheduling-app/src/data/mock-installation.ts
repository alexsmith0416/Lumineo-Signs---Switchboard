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
  { id: "wk-dustin", name: "Dustin / CCO (F96)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: true, hourlyRate: 65 },
  { id: "wk-aiden", name: "Aiden", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 55 },
  { id: "wk-jason", name: "Jason / CCO (60)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: true, hourlyRate: 65 },
  { id: "wk-doug", name: "Doug / CCO (F-38)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: true, hourlyRate: 65 },
  { id: "wk-lee", name: "Lee (F81/F50/Chevy 54)", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 58 },
  { id: "wk-tanner", name: "Tanner", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 58 },
  { id: "wk-heath", name: "Heath / CCO", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
  { id: "wk-ray", name: "Ray / CCO (F52)", departmentId: "loc-wichita", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 65 },
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
  startHour?: number;
  hours: number;
  zip: string;
  invoice: number;
  crew: number;
  trucks: number;
  cranes?: number;
  lifts?: number;
  region: "WK" | "NEK";
  isLocked?: boolean;
  customColor?: string;
  isCustom?: boolean;
}

function mkLine(i: MakeLineInput): ScheduleLine {
  const startHour = i.startHour ?? 8;
  return {
    id: i.id,
    jobNo: i.jobNo,
    customerName: i.customer,
    planningLineDescription: i.desc,
    startDateTime: at(i.day, startHour),
    endDateTime: at(i.day, startHour + Math.min(i.hours, 8)),
    estimatedHours: i.hours,
    overrideHours: null,
    employeeId: i.emp,
    departmentId: i.loc,
    customerDueDate: null,
    isLocked: i.isLocked ?? false,
    jobSequence: 1,
    invoiceAmount: i.invoice,
    crewPersons: i.crew,
    crewTrucks: i.trucks,
    crewCranes: i.cranes ?? 0,
    crewLifts: i.lifts ?? 0,
    crewBuckets: 0,
    installZip: i.zip,
    region: i.region,
    isCustom: i.isCustom,
    customColor: i.customColor,
  };
}

// WK schedule — week of 6/8/26 (Mon) through 6/13/26 (Sat).
// Locations, dollar values, and tasks sourced from the WK Installation
// Schedule CSV. ZIP codes drive the weather widget per card.
export const WK_LINES: ScheduleLine[] = [
  // ============ Aiden ============
  mkLine({ id: "wk-aiden-mon-1", jobNo: "J31712", customer: "HFG Architecture", desc: "Reinstall refurbished sign", emp: "wk-aiden", loc: "loc-hutch", day: 0, startHour: 8, hours: 4, zip: "67202", invoice: 9266.19, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-aiden-mon-2", jobNo: "J32429", customer: "City of Andover (Capitol Fed)", desc: "Caulk wireway", emp: "wk-aiden", loc: "loc-hutch", day: 0, startHour: 12, hours: 4, zip: "67002", invoice: 22755.0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-tue-1", jobNo: "J36515", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-aiden", loc: "loc-hutch", day: 1, startHour: 8, hours: 4, zip: "67202", invoice: 20149.95, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-aiden-tue-2", jobNo: "J36516", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-aiden", loc: "loc-hutch", day: 1, startHour: 12, hours: 4, zip: "67202", invoice: 15506.95, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-wed", jobNo: "J28930", customer: "Children's Mercy (Dondlinger & Sons)", desc: "Install one set of face lit channel letters · sign at Wichita shop, take EMT for thru-the-wall", emp: "wk-aiden", loc: "loc-hutch", day: 2, hours: 8, zip: "67202", invoice: 10182.1, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-aiden-thu", jobNo: "J37394", customer: "Equity Bank Ironstone", desc: "Install site sign", emp: "wk-aiden", loc: "loc-hutch", day: 3, hours: 8, zip: "67059", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-aiden-fri", jobNo: "J37921", customer: "Hutchinson Public Schools - Early Head Start", desc: "Remove signage", emp: "wk-aiden", loc: "loc-hutch", day: 4, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),

  // ============ Dustin / CCO (F96) ============
  mkLine({ id: "wk-dustin-mon-1", jobNo: "J31712", customer: "HFG Architecture", desc: "Reinstall refurbished sign", emp: "wk-dustin", loc: "loc-hutch", day: 0, startHour: 8, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-dustin-mon-2", jobNo: "J32429", customer: "City of Andover (Capitol Fed)", desc: "Caulk wireway", emp: "wk-dustin", loc: "loc-hutch", day: 0, startHour: 12, hours: 4, zip: "67002", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-dustin-tue-1", jobNo: "J36515", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-dustin", loc: "loc-hutch", day: 1, startHour: 8, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-dustin-tue-2", jobNo: "J36516", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-dustin", loc: "loc-hutch", day: 1, startHour: 12, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-dustin-wed", jobNo: "J28930", customer: "Children's Mercy (Dondlinger & Sons)", desc: "Install one set of face lit channel letters", emp: "wk-dustin", loc: "loc-hutch", day: 2, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-dustin-thu", jobNo: "J37394", customer: "Equity Bank Ironstone", desc: "Install site sign · Haviland?", emp: "wk-dustin", loc: "loc-hutch", day: 3, hours: 8, zip: "67059", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-dustin-fri", jobNo: "J37921", customer: "Hutchinson Public Schools - Early Head Start", desc: "Remove signage", emp: "wk-dustin", loc: "loc-hutch", day: 4, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-dustin-sat-1", jobNo: "J35522", customer: "Jones Sign · Gallagher", desc: "Gallagher (Assembly & Graphics)", emp: "wk-dustin", loc: "loc-hutch", day: 5, startHour: 8, hours: 4, zip: "67501", invoice: 6748.37, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-dustin-sat-2", jobNo: "J35523", customer: "Jones Sign · Gallagher", desc: "Gallagher (Install — waiting on product)", emp: "wk-dustin", loc: "loc-hutch", day: 5, startHour: 12, hours: 4, zip: "67501", invoice: 7496.0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Heath / CCO ============
  mkLine({ id: "wk-heath-mon", jobNo: "svc-unload-30ft", customer: "Shop Maintenance", desc: "Unload 30ft trailer", emp: "wk-heath", loc: "loc-hutch", day: 0, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Jason / CCO (60) ============
  mkLine({ id: "wk-jason-mon", jobNo: "svc-bushton-greatbend", customer: "Bushton / Great Bend Service", desc: "Service", emp: "wk-jason", loc: "loc-hutch", day: 0, hours: 8, zip: "67530", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-tue", jobNo: "svc-eldorado-benton", customer: "Eldorado / Benton Service", desc: "Service", emp: "wk-jason", loc: "loc-hutch", day: 1, hours: 8, zip: "67042", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-wed", jobNo: "svc-salina", customer: "Salina Service", desc: "Service with Lee", emp: "wk-jason", loc: "loc-hutch", day: 2, hours: 8, zip: "67401", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-thu", jobNo: "svc-wichita", customer: "Wichita Service", desc: "Service", emp: "wk-jason", loc: "loc-hutch", day: 3, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-fri", jobNo: "svc-hutch", customer: "Hutchinson Service", desc: "Service", emp: "wk-jason", loc: "loc-hutch", day: 4, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-sat-1", jobNo: "J35522", customer: "Jones Sign · Gallagher", desc: "Gallagher (Assembly & Graphics)", emp: "wk-jason", loc: "loc-hutch", day: 5, startHour: 8, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-sat-2", jobNo: "J35523", customer: "Jones Sign · Gallagher", desc: "Gallagher (Install — waiting on product)", emp: "wk-jason", loc: "loc-hutch", day: 5, startHour: 12, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Doug / CCO (F-38) ============
  mkLine({ id: "wk-doug-mon-1", jobNo: "J37421", customer: "Cris Corey State Farm", desc: "Remove face and install new", emp: "wk-doug", loc: "loc-hutch", day: 0, startHour: 8, hours: 2, zip: "67202", invoice: 937.54, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-mon-2", jobNo: "J37422", customer: "Cris Corey State Farm", desc: "Remove sign for refurb", emp: "wk-doug", loc: "loc-hutch", day: 0, startHour: 10, hours: 2, zip: "67202", invoice: 7091.19, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-mon-3", jobNo: "J37959", customer: "State Farm (Amy Long Agency) · Everbrite", desc: "Face install", emp: "wk-doug", loc: "loc-hutch", day: 0, startHour: 12, hours: 2, zip: "67202", invoice: 786.0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-mon-4", jobNo: "svc-unload-30ft", customer: "Shop Maintenance", desc: "Unload 30ft trailer", emp: "wk-doug", loc: "loc-hutch", day: 0, startHour: 14, hours: 2, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-tue-1", jobNo: "J35775", customer: "Goodwill (Dondlinger & Sons)", desc: "Install donation letters", emp: "wk-doug", loc: "loc-hutch", day: 1, startHour: 8, hours: 4, zip: "67501", invoice: 6319.83, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-tue-2", jobNo: "J37573", customer: "Fidelity Bank", desc: "Replace trim cap letters", emp: "wk-doug", loc: "loc-hutch", day: 1, startHour: 12, hours: 4, zip: "67202", invoice: 2779.37, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-wed-1", jobNo: "J31666", customer: "Sterling Pharmacy", desc: "Install S/F cabinet", emp: "wk-doug", loc: "loc-hutch", day: 2, startHour: 8, hours: 4, zip: "67579", invoice: 5126.31, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-wed-2", jobNo: "J37290", customer: "Fine Art of Family Dentistry", desc: "Remove sign for refurb", emp: "wk-doug", loc: "loc-hutch", day: 2, startHour: 12, hours: 4, zip: "67202", invoice: 5904.47, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-thu-1", jobNo: "J33723", customer: "Salina Public Library", desc: "Install interior logo and FCOs", emp: "wk-doug", loc: "loc-hutch", day: 3, startHour: 8, hours: 3, zip: "67401", invoice: 2287.44, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-thu-2", jobNo: "J33489", customer: "Family Dentistry (Midway Motors Supercenter)", desc: "Install vinyl wrap", emp: "wk-doug", loc: "loc-hutch", day: 3, startHour: 11, hours: 2, zip: "67460", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-thu-3", jobNo: "J36904", customer: "Weddle & Sons Roofing of Salina", desc: "Install vinyl wrap", emp: "wk-doug", loc: "loc-hutch", day: 3, startHour: 13, hours: 3, zip: "67401", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-fri-1", jobNo: "J37469", customer: "Memorial Art Company", desc: "Install vinyl wrap (McPherson)", emp: "wk-doug", loc: "loc-hutch", day: 4, startHour: 8, hours: 3, zip: "67460", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-fri-2", jobNo: "J37471", customer: "Memorial Art Company", desc: "Install vinyl wrap (Great Bend)", emp: "wk-doug", loc: "loc-hutch", day: 4, startHour: 11, hours: 3, zip: "67530", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-fri-3", jobNo: "svc-midway", customer: "Midway Motors", desc: "Install vinyl wrap", emp: "wk-doug", loc: "loc-hutch", day: 4, startHour: 14, hours: 2, zip: "67460", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-sat-1", jobNo: "J35522", customer: "Jones Sign · Gallagher", desc: "Gallagher (Assembly & Graphics)", emp: "wk-doug", loc: "loc-hutch", day: 5, startHour: 8, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-sat-2", jobNo: "J35523", customer: "Jones Sign · Gallagher", desc: "Gallagher (Install — waiting on product)", emp: "wk-doug", loc: "loc-hutch", day: 5, startHour: 12, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Lee (F81/F50/Chevy 54) ============
  mkLine({ id: "wk-lee-mon-pto", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-lee", loc: "loc-hutch", day: 0, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),
  mkLine({ id: "wk-lee-tue-1", jobNo: "svc-to-dodge", customer: "To Dodge City", desc: "To Dodge with 30ft trailer", emp: "wk-lee", loc: "loc-hutch", day: 1, startHour: 8, hours: 4, zip: "67801", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-lee-tue-2", jobNo: "J36772", customer: "Billboard Business LLC", desc: "Load pipe onto 30ft trailer", emp: "wk-lee", loc: "loc-hutch", day: 1, startHour: 12, hours: 4, zip: "67846", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-lee-wed", jobNo: "svc-salina", customer: "Salina Service", desc: "Service with Jason", emp: "wk-lee", loc: "loc-hutch", day: 2, hours: 8, zip: "67401", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-lee-thu", jobNo: "J33723", customer: "Salina Public Library", desc: "Install interior logo and FCOs", emp: "wk-lee", loc: "loc-hutch", day: 3, hours: 8, zip: "67401", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-lee-fri", jobNo: "svc-steelwork", customer: "Steel work", desc: "Steel work", emp: "wk-lee", loc: "loc-hutch", day: 4, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Tanner ============
  mkLine({ id: "wk-tanner-tue", jobNo: "J37094", customer: "Intellicents", desc: "Interior vinyl", emp: "wk-tanner", loc: "loc-hutch", day: 1, hours: 8, zip: "67202", invoice: 952.06, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-tanner-wed-1", jobNo: "J37648", customer: "Disability Supports", desc: "Vinyl install", emp: "wk-tanner", loc: "loc-hutch", day: 2, startHour: 8, hours: 4, zip: "67501", invoice: 665.6, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-tanner-wed-2", jobNo: "J36732", customer: "CHCT Kansas, LLC", desc: "Door / window vinyl", emp: "wk-tanner", loc: "loc-hutch", day: 2, startHour: 12, hours: 4, zip: "67501", invoice: 687.61, crew: 1, trucks: 0, region: "WK" }),

  // ============ Ray / CCO (F52) — PTO full week ============
  mkLine({ id: "wk-ray-mon", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-ray", loc: "loc-wichita", day: 0, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),
  mkLine({ id: "wk-ray-tue", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-ray", loc: "loc-wichita", day: 1, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),
  mkLine({ id: "wk-ray-wed", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-ray", loc: "loc-wichita", day: 2, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),
  mkLine({ id: "wk-ray-thu", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-ray", loc: "loc-wichita", day: 3, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),
  mkLine({ id: "wk-ray-fri", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-ray", loc: "loc-wichita", day: 4, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),

  // ============ Danny / CCO (420) — Dodge City ============
  mkLine({ id: "wk-danny-mon", jobNo: "J30283", customer: "Finney County Health & EMS (Hutton)", desc: "Install interior panel sign", emp: "wk-danny", loc: "loc-dodge", day: 0, hours: 8, zip: "67846", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-tue-1", jobNo: "J36364", customer: "Satanta District Hospital", desc: "Replace louvers · if too windy reschedule", emp: "wk-danny", loc: "loc-dodge", day: 1, startHour: 8, hours: 4, zip: "67870", invoice: 5348.4, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-tue-2", jobNo: "svc-gc-load", customer: "Garden City Service", desc: "Load pipe on trailer", emp: "wk-danny", loc: "loc-dodge", day: 1, startHour: 12, hours: 4, zip: "67846", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-danny-wed", jobNo: "J36772", customer: "Billboard Business LLC", desc: "Set base pipe · Panhandle on site 9am", emp: "wk-danny", loc: "loc-dodge", day: 2, startHour: 9, hours: 8, zip: "67846", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-thu", jobNo: "J35655", customer: "Lineage", desc: "Concrete removal and set post and panel", emp: "wk-danny", loc: "loc-dodge", day: 3, hours: 8, zip: "67846", invoice: 11738.86, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-fri", jobNo: "J32903", customer: "Minneola Healthcare", desc: "Install cabinet", emp: "wk-danny", loc: "loc-dodge", day: 4, hours: 8, zip: "67865", invoice: 5015.53, crew: 1, trucks: 1, region: "WK" }),

  // ============ Thomas (D90) — Dodge City ============
  mkLine({ id: "wk-thomas-mon", jobNo: "J30283", customer: "Finney County Health & EMS (Hutton)", desc: "Install interior panel sign", emp: "wk-thomas", loc: "loc-dodge", day: 0, hours: 8, zip: "67846", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-tue", jobNo: "J36772", customer: "Billboard Business LLC", desc: "Dig cube footing for billboard", emp: "wk-thomas", loc: "loc-dodge", day: 1, hours: 8, zip: "67846", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-thomas-wed", jobNo: "J36772", customer: "Billboard Business LLC", desc: "Set base pipe · Panhandle on site 9am", emp: "wk-thomas", loc: "loc-dodge", day: 2, startHour: 9, hours: 8, zip: "67846", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-thu", jobNo: "J35655", customer: "Lineage", desc: "Concrete removal and set post and panel", emp: "wk-thomas", loc: "loc-dodge", day: 3, hours: 8, zip: "67846", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-fri-1", jobNo: "J32903", customer: "Minneola Healthcare", desc: "Install cabinet", emp: "wk-thomas", loc: "loc-dodge", day: 4, startHour: 8, hours: 4, zip: "67865", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-fri-2", jobNo: "svc-casino-wraps", customer: "Casino Wraps", desc: "Casino wraps", emp: "wk-thomas", loc: "loc-dodge", day: 4, startHour: 12, hours: 4, zip: "67870", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
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
  { id: "nek-stanc", name: "Stan C", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-morganm", name: "Morgan M", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-connerp", name: "Conner P", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-joshs", name: "Josh S", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-justinj", name: "Justin J", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-jarrodl", name: "Jarrod L", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-aaronw", name: "Aaron W", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
];

// NKC-018 sign package — multi-job NKC Health install package "a lot of
// numbers". The CSV doesn't break out per-job values for this package, so
// we represent the entire week's package as a single rolled-up value on
// the lead-crew rows and paired-crew rows as $0.
const NKC018_PACKAGE_VALUE = 254160.0;

export const NEK_LINES: ScheduleLine[] = [
  // ============ Stan C ============
  mkLine({ id: "nek-stan-mon", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 0, hours: 8, zip: "64116", invoice: NKC018_PACKAGE_VALUE, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),

  // ============ Morgan M ============
  mkLine({ id: "nek-morgan-mon", jobNo: "J36817", customer: "Capitol Federal", desc: "Install directionals", emp: "nek-morganm", loc: "loc-nek", day: 0, hours: 8, zip: "66102", invoice: 3850.0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-morgan-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-morgan-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-morgan-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-morgan-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Conner P ============
  mkLine({ id: "nek-conner-mon", jobNo: "J36817", customer: "Capitol Federal", desc: "Install directionals", emp: "nek-connerp", loc: "loc-nek", day: 0, hours: 8, zip: "66102", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-conner-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-conner-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-conner-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-conner-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),

  // ============ Josh S ============
  mkLine({ id: "nek-josh-mon", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 0, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-tue-1", jobNo: "J37549", customer: "McDonald's #4164 (World Cup)", desc: "Soccer balls · BEFORE 6/11", emp: "nek-joshs", loc: "loc-nek", day: 1, startHour: 8, hours: 4, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-josh-tue-2", jobNo: "J37550", customer: "McDonald's #1511 (World Cup)", desc: "Soccer balls · BEFORE 6/11", emp: "nek-joshs", loc: "loc-nek", day: 1, startHour: 12, hours: 4, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Justin J ============
  mkLine({ id: "nek-justinj-mon", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 0, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-justinj-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-justinj-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-justinj-thu", jobNo: "J36188", customer: "O'Reilly Auto Parts (Emporia)", desc: "Install sign package", emp: "nek-justinj", loc: "loc-nek", day: 3, hours: 8, zip: "66801", invoice: 5445.0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-justinj-fri", jobNo: "J36188", customer: "O'Reilly Auto Parts (Emporia)", desc: "Install sign package", emp: "nek-justinj", loc: "loc-nek", day: 4, hours: 8, zip: "66801", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),

  // ============ Jarrod L ============
  mkLine({ id: "nek-jarrod-mon", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 0, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-jarrod-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-jarrod-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-jarrod-thu", jobNo: "J36188", customer: "O'Reilly Auto Parts (Emporia)", desc: "Install sign package", emp: "nek-jarrodl", loc: "loc-nek", day: 3, hours: 8, zip: "66801", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-jarrod-fri", jobNo: "J36188", customer: "O'Reilly Auto Parts (Emporia)", desc: "Install sign package", emp: "nek-jarrodl", loc: "loc-nek", day: 4, hours: 8, zip: "66801", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Aaron W ============
  mkLine({ id: "nek-aaron-mon", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-aaronw", loc: "loc-nek", day: 0, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-aaron-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-aaronw", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-aaron-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-aaronw", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-aaron-thu", jobNo: "svc-nasb-vinyl", customer: "NASB", desc: "Cut reflective vinyl", emp: "nek-aaronw", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-aaron-fri-1", jobNo: "J37447", customer: "Midwest Trust", desc: "Cut vinyl (Outsourced — Vendor)", emp: "nek-aaronw", loc: "loc-nek", day: 4, startHour: 8, hours: 4, zip: "66210", invoice: 3471.0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-aaron-fri-2", jobNo: "J35352", customer: "Gene's Heartland Foods", desc: "Vinyl must be ready (NEK Production)", emp: "nek-aaronw", loc: "loc-nek", day: 4, startHour: 12, hours: 4, zip: "64116", invoice: 1172.0, crew: 1, trucks: 0, region: "NEK" }),
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
