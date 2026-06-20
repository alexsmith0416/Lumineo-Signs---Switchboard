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
  { id: "wk-bill", name: "Bill Day", departmentId: "loc-hutch", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 58 },
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

// WK schedule — week of 6/1/26 (Mon) through 6/5/26 (Fri).
// Dollar values + locations sourced from the LNI Production Schedule CSV.
export const WK_LINES: ScheduleLine[] = [
  // ============ AL / CCO (F96) ============
  mkLine({ id: "wk-al-mon-1", jobNo: "J31228", customer: "Iron Insurance", desc: "Install pan sign on building", emp: "wk-al", loc: "loc-hutch", day: 0, startHour: 8, hours: 4, zip: "67505", invoice: 4616.10, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-al-mon-2", jobNo: "J37189", customer: "Iron Insurance", desc: "Install interior sign", emp: "wk-al", loc: "loc-hutch", day: 0, startHour: 12, hours: 2, zip: "67505", invoice: 749.00, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-al-mon-3", jobNo: "J31226", customer: "Iron Insurance", desc: "Remove faces for replacement", emp: "wk-al", loc: "loc-hutch", day: 0, startHour: 14, hours: 2, zip: "67505", invoice: 3102.32, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-al-tue", jobNo: "J32429", customer: "City of Andover (Capitol Fed)", desc: "Install channel letters on freestanding wall with curved wireway on the back", emp: "wk-al", loc: "loc-hutch", day: 1, hours: 8, zip: "67002", invoice: 22755.00, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-al-wed-1", jobNo: "J33723", customer: "Salina Public Library", desc: "Install interior logo and FCOs", emp: "wk-al", loc: "loc-hutch", day: 2, startHour: 8, hours: 4, zip: "67401", invoice: 2287.44, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-al-wed-2", jobNo: "J29256", customer: "MCP Group - Salina Fire Station #4", desc: "Install building letters", emp: "wk-al", loc: "loc-hutch", day: 2, startHour: 12, hours: 4, zip: "67401", invoice: 29168.55, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-al-thu-1", jobNo: "J36515", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-al", loc: "loc-hutch", day: 3, startHour: 8, hours: 4, zip: "67202", invoice: 20149.95, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-al-thu-2", jobNo: "J36516", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-al", loc: "loc-hutch", day: 3, startHour: 12, hours: 4, zip: "67202", invoice: 15506.95, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-al-fri", jobNo: "J31226", customer: "Iron Insurance", desc: "Install new monument faces", emp: "wk-al", loc: "loc-hutch", day: 4, hours: 8, zip: "67505", invoice: 3102.32, crew: 1, trucks: 1, region: "WK" }),

  // ============ Aiden (paired w/ AL all week) ============
  mkLine({ id: "wk-aiden-mon-1", jobNo: "J31228", customer: "Iron Insurance", desc: "Install pan sign on building", emp: "wk-aiden", loc: "loc-hutch", day: 0, startHour: 8, hours: 4, zip: "67505", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-mon-2", jobNo: "J37189", customer: "Iron Insurance", desc: "Install interior sign", emp: "wk-aiden", loc: "loc-hutch", day: 0, startHour: 12, hours: 2, zip: "67505", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-mon-3", jobNo: "J31226", customer: "Iron Insurance", desc: "Remove faces for replacement", emp: "wk-aiden", loc: "loc-hutch", day: 0, startHour: 14, hours: 2, zip: "67505", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-tue", jobNo: "J32429", customer: "City of Andover (Capitol Fed)", desc: "Install channel letters on freestanding wall with curved wireway on the back", emp: "wk-aiden", loc: "loc-hutch", day: 1, hours: 8, zip: "67002", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-wed-1", jobNo: "J33723", customer: "Salina Public Library", desc: "Install interior logo and FCOs", emp: "wk-aiden", loc: "loc-hutch", day: 2, startHour: 8, hours: 4, zip: "67401", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-wed-2", jobNo: "J29256", customer: "MCP Group - Salina Fire Station #4", desc: "Install building letters", emp: "wk-aiden", loc: "loc-hutch", day: 2, startHour: 12, hours: 4, zip: "67401", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-thu-1", jobNo: "J36515", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-aiden", loc: "loc-hutch", day: 3, startHour: 8, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-thu-2", jobNo: "J36516", customer: "Children's Mercy", desc: "Set poles and mow pads", emp: "wk-aiden", loc: "loc-hutch", day: 3, startHour: 12, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-aiden-fri", jobNo: "J31226", customer: "Iron Insurance", desc: "Install new monument faces", emp: "wk-aiden", loc: "loc-hutch", day: 4, hours: 8, zip: "67505", invoice: 0, crew: 1, trucks: 0, region: "WK" }),

  // ============ Jason / CCO (60) ============
  mkLine({ id: "wk-jason-mon-1", jobNo: "J37440", customer: "Citizens Bank of Kansas", desc: "Service call", emp: "wk-jason", loc: "loc-hutch", day: 0, startHour: 8, hours: 4, zip: "67010", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-mon-2", jobNo: "svc-wichita", customer: "Wichita Service", desc: "Wichita service", emp: "wk-jason", loc: "loc-hutch", day: 0, startHour: 12, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-jason-tue", jobNo: "svc-salina", customer: "Salina Service", desc: "Salina service", emp: "wk-jason", loc: "loc-hutch", day: 1, hours: 8, zip: "67401", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-wed", jobNo: "J36944", customer: "City of Wichita", desc: "Light columns", emp: "wk-jason", loc: "loc-hutch", day: 2, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 1, lifts: 1, region: "WK" }),
  mkLine({ id: "wk-jason-thu", jobNo: "svc-greatbend", customer: "Great Bend Service", desc: "Great Bend service", emp: "wk-jason", loc: "loc-hutch", day: 3, hours: 8, zip: "67530", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-jason-fri", jobNo: "svc-hutch", customer: "Hutchinson Service", desc: "Hutchinson service", emp: "wk-jason", loc: "loc-hutch", day: 4, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "WK" }),

  // ============ Doug / CCO (F-38) ============
  mkLine({ id: "wk-doug-mon-1", jobNo: "J36416", customer: "Hutchinson Regional Med. Center", desc: "Install FCOs on bars — meet at shop 9am for new vinyl", emp: "wk-doug", loc: "loc-hutch", day: 0, startHour: 9, hours: 4, zip: "67514", invoice: 5664.09, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-mon-2", jobNo: "J35716", customer: "Greater Wichita YMCA", desc: "Install I/I logo and FCOs", emp: "wk-doug", loc: "loc-hutch", day: 0, startHour: 13, hours: 3, zip: "67501", invoice: 5789.20, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-tue-1", jobNo: "J36681", customer: "NEO Home Loan (Newton)", desc: "Remove faces and bring back to shop for new vinyl", emp: "wk-doug", loc: "loc-hutch", day: 1, startHour: 8, hours: 4, zip: "67114", invoice: 1589.35, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-tue-2", jobNo: "J35594", customer: "Cooper Tire", desc: "Pick up asphalt and fill in by Cooper Tire sign — get packer from Reger Rental", emp: "wk-doug", loc: "loc-hutch", day: 1, startHour: 12, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-wed-1", jobNo: "J36681", customer: "NEO Home Loan (Newton)", desc: "Install faces", emp: "wk-doug", loc: "loc-hutch", day: 2, startHour: 8, hours: 3, zip: "67114", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-wed-2", jobNo: "J36876", customer: "Central National Bank (Halstead)", desc: "Install overlay panels", emp: "wk-doug", loc: "loc-hutch", day: 2, startHour: 11, hours: 3, zip: "67056", invoice: 3110.00, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-wed-3", jobNo: "J36854", customer: "Park City City Hall", desc: "Install post and panel", emp: "wk-doug", loc: "loc-hutch", day: 2, startHour: 14, hours: 2, zip: "67219", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-thu-1", jobNo: "J37097", customer: "Intellicents", desc: "Remove and install FCOs", emp: "wk-doug", loc: "loc-hutch", day: 3, startHour: 8, hours: 4, zip: "67202", invoice: 2676.89, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-thu-2", jobNo: "J37350", customer: "Vona Private Studio", desc: "Install plex face", emp: "wk-doug", loc: "loc-hutch", day: 3, startHour: 12, hours: 4, zip: "67202", invoice: 2239.18, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-fri-1", jobNo: "J34578", customer: "Jimmy's Egg", desc: "Replace logo faces", emp: "wk-doug", loc: "loc-hutch", day: 4, startHour: 8, hours: 2, zip: "67202", invoice: 1267.40, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-doug-fri-2", jobNo: "J34579", customer: "Jimmy's Egg", desc: "Replace logo faces", emp: "wk-doug", loc: "loc-hutch", day: 4, startHour: 10, hours: 2, zip: "67202", invoice: 1767.06, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-fri-3", jobNo: "J37569", customer: "Davis Liquor Outlet", desc: "Meet Tanner for vinyl", emp: "wk-doug", loc: "loc-hutch", day: 4, startHour: 12, hours: 2, zip: "67202", invoice: 643.02, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-doug-fri-4", jobNo: "J34645", customer: "Builders Inc Parklane Shopping", desc: "Install new tenant panel", emp: "wk-doug", loc: "loc-hutch", day: 4, startHour: 14, hours: 2, zip: "67202", invoice: 24425.50, crew: 1, trucks: 0, region: "WK" }),

  // ============ Ray / CCO (F52) — Off all week ============
  mkLine({ id: "wk-ray-off-mon", jobNo: "PTO", customer: "Off", desc: "Off", emp: "wk-ray", loc: "loc-wichita", day: 0, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#FAB0B0" }),
  mkLine({ id: "wk-ray-off-tue", jobNo: "PTO", customer: "Off", desc: "Off", emp: "wk-ray", loc: "loc-wichita", day: 1, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#FAB0B0" }),
  mkLine({ id: "wk-ray-off-wed", jobNo: "PTO", customer: "Off", desc: "Off", emp: "wk-ray", loc: "loc-wichita", day: 2, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#FAB0B0" }),
  mkLine({ id: "wk-ray-off-thu", jobNo: "PTO", customer: "Off", desc: "Off", emp: "wk-ray", loc: "loc-wichita", day: 3, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#FAB0B0" }),
  mkLine({ id: "wk-ray-off-fri", jobNo: "PTO", customer: "Off", desc: "Off", emp: "wk-ray", loc: "loc-wichita", day: 4, hours: 8, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#FAB0B0" }),

  // ============ Lee (F81/F50/Chevy 54) ============
  mkLine({ id: "wk-lee-mon", jobNo: "J36311", customer: "Wichita Bio Med", desc: "To Salina to strap and bring back letters and logos on 30ft trailer", emp: "wk-lee", loc: "loc-hutch", day: 0, hours: 8, zip: "67401", invoice: 268549.47, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-lee-tue", jobNo: "J31949", customer: "Stone Creek Station (GC Investments)", desc: "Refinery steel work", emp: "wk-lee", loc: "loc-hutch", day: 1, hours: 8, zip: "67846", invoice: 10408.44, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-lee-pto-wed", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-lee", loc: "loc-hutch", day: 2, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),
  mkLine({ id: "wk-lee-pto-thu", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-lee", loc: "loc-hutch", day: 3, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),
  mkLine({ id: "wk-lee-pto-fri", jobNo: "PTO", customer: "PTO", desc: "PTO", emp: "wk-lee", loc: "loc-hutch", day: 4, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK", isLocked: true, isCustom: true, customColor: "#F4C2E0" }),

  // ============ Bill Day (one-off Thursday) ============
  mkLine({ id: "wk-bill-thu", jobNo: "J36343", customer: "Presbyterian Manors of Mid-America", desc: "Paint monument sign", emp: "wk-bill", loc: "loc-hutch", day: 3, hours: 8, zip: "66044", invoice: 11159.52, crew: 1, trucks: 1, region: "WK" }),

  // ============ Tanner (one-off Friday) ============
  mkLine({ id: "wk-tanner-fri-1", jobNo: "J37501", customer: "Fidelity Bank", desc: "Fidelity Bank install", emp: "wk-tanner", loc: "loc-hutch", day: 4, startHour: 8, hours: 4, zip: "67202", invoice: 1805.00, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-tanner-fri-2", jobNo: "J37591", customer: "Fidelity Bank", desc: "Fidelity Bank install", emp: "wk-tanner", loc: "loc-hutch", day: 4, startHour: 12, hours: 4, zip: "67202", invoice: 2595.67, crew: 1, trucks: 0, region: "WK" }),

  // ============ Danny / CCO (420) — Dodge City ============
  mkLine({ id: "wk-danny-mon-1", jobNo: "J37472", customer: "Farm Bureau Financial (Kelley Linn)", desc: "Install vinyl wrap", emp: "wk-danny", loc: "loc-dodge", day: 0, startHour: 8, hours: 4, zip: "67877", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-mon-2", jobNo: "J36927", customer: "Lewis Automotive Group", desc: "Pattern letter and more", emp: "wk-danny", loc: "loc-dodge", day: 0, startHour: 12, hours: 4, zip: "67846", invoice: 1046.03, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-danny-tue-1", jobNo: "J34499", customer: "McDonald's G.C. (Milligan Enterprises)", desc: "Service", emp: "wk-danny", loc: "loc-dodge", day: 1, startHour: 8, hours: 4, zip: "67846", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-tue-2", jobNo: "J34500", customer: "McDonald's G.C. (Milligan Enterprises)", desc: "Service", emp: "wk-danny", loc: "loc-dodge", day: 1, startHour: 12, hours: 4, zip: "67846", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-danny-wed", jobNo: "J37773", customer: "Holly School District", desc: "EMC service", emp: "wk-danny", loc: "loc-dodge", day: 2, hours: 8, zip: "81047", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-thu", jobNo: "svc-hugoton-liberal", customer: "Hugoton & Liberal Service", desc: "Hugoton and Liberal service", emp: "wk-danny", loc: "loc-dodge", day: 3, hours: 8, zip: "67901", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
  mkLine({ id: "wk-danny-fri", jobNo: "J36364", customer: "Satanta District Hospital", desc: "Louver replacement and module replacement", emp: "wk-danny", loc: "loc-dodge", day: 4, hours: 8, zip: "67870", invoice: 5348.40, crew: 1, trucks: 1, region: "WK" }),

  // ============ Thomas (D90) — Dodge City paired w/ Doug ============
  mkLine({ id: "wk-thomas-mon-1", jobNo: "J36416", customer: "Hutchinson Regional Med. Center", desc: "Install FCOs on bars — meet at shop 9am for new vinyl", emp: "wk-thomas", loc: "loc-dodge", day: 0, startHour: 9, hours: 4, zip: "67514", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-mon-2", jobNo: "J35716", customer: "Greater Wichita YMCA", desc: "Install I/I logo and FCOs", emp: "wk-thomas", loc: "loc-dodge", day: 0, startHour: 13, hours: 3, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-tue-1", jobNo: "J36681", customer: "NEO Home Loan (Newton)", desc: "Remove faces and bring back to shop for new vinyl", emp: "wk-thomas", loc: "loc-dodge", day: 1, startHour: 8, hours: 4, zip: "67114", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-tue-2", jobNo: "J35594", customer: "Cooper Tire", desc: "Pick up asphalt and fill in by Cooper Tire sign — get packer from Reger Rental", emp: "wk-thomas", loc: "loc-dodge", day: 1, startHour: 12, hours: 4, zip: "67501", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-wed-1", jobNo: "J36681", customer: "NEO Home Loan (Newton)", desc: "Install faces", emp: "wk-thomas", loc: "loc-dodge", day: 2, startHour: 8, hours: 3, zip: "67114", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-wed-2", jobNo: "J36876", customer: "Central National Bank (Halstead)", desc: "Install overlay panels", emp: "wk-thomas", loc: "loc-dodge", day: 2, startHour: 11, hours: 3, zip: "67056", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-wed-3", jobNo: "J36854", customer: "Park City City Hall", desc: "Install post and panel", emp: "wk-thomas", loc: "loc-dodge", day: 2, startHour: 14, hours: 2, zip: "67219", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-thu-1", jobNo: "J37097", customer: "Intellicents", desc: "Remove and install FCOs", emp: "wk-thomas", loc: "loc-dodge", day: 3, startHour: 8, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-thu-2", jobNo: "J37350", customer: "Vona Private Studio", desc: "Install plex face", emp: "wk-thomas", loc: "loc-dodge", day: 3, startHour: 12, hours: 4, zip: "67202", invoice: 0, crew: 1, trucks: 0, region: "WK" }),
  mkLine({ id: "wk-thomas-fri", jobNo: "svc-return-dc", customer: "Return to D.C.", desc: "Take back signage", emp: "wk-thomas", loc: "loc-dodge", day: 4, hours: 8, zip: "67801", invoice: 0, crew: 1, trucks: 1, region: "WK" }),
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
  { id: "nek-hunter", name: "Hunter", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 55 },
  { id: "nek-joshs", name: "Josh S", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-justinj", name: "Justin J", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-jarrodl", name: "Jarrod L", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
  { id: "nek-aaronw", name: "Aaron W", departmentId: "loc-nek", productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2, worksWeekends: false, hourlyRate: 60 },
];

// NKC-018 sign package = the multi-job NKC Health install rolled up.
// CSV total across major NKC Health jobs that haven't been called out
// individually elsewhere comes to ~$254K — use that as the package value
// on the lead crew's entry, with paired crew rows at $0.
const NKC018_PACKAGE_VALUE = 254160.0;
const NKC021_013_PACKAGE_VALUE = 28413.34; // J36400 ($15,477.96) + J36291 ($12,935.38)
const FJ_BLD_VALUE = 8732.0; // J34769 Faith Journey Church

export const NEK_LINES: ScheduleLine[] = [
  // ============ Stan C ============
  mkLine({ id: "nek-stan-mon-1", jobNo: "J34769", customer: "Faith Journey Church", desc: "FJ bld sign install", emp: "nek-stanc", loc: "loc-nek", day: 0, startHour: 8, hours: 4, zip: "66061", invoice: FJ_BLD_VALUE, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-mon-2", jobNo: "J37858", customer: "First National Bank of Louisburg", desc: "EMC service · Louisburg", emp: "nek-stanc", loc: "loc-nek", day: 0, startHour: 12, hours: 4, zip: "66053", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-stan-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: NKC018_PACKAGE_VALUE, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-stanc", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-stan-fri", jobNo: "J34368", customer: "Goodwin Outdoors · Walnut Reserve", desc: "Walnut Reserve monument", emp: "nek-stanc", loc: "loc-nek", day: 4, hours: 8, zip: "66212", invoice: 17800.0, crew: 1, trucks: 1, region: "NEK" }),

  // ============ Morgan M ============
  mkLine({ id: "nek-morgan-mon", jobNo: "J34769", customer: "Faith Journey Church", desc: "FJ bld sign install", emp: "nek-morganm", loc: "loc-nek", day: 0, hours: 8, zip: "66061", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-morgan-tue", jobNo: "J36400 / J36291 · NKC-021/013", customer: "NKC Health", desc: "Install sign package", emp: "nek-morganm", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: NKC021_013_PACKAGE_VALUE, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-morgan-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-morgan-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-morgan-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-morganm", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Conner P ============
  mkLine({ id: "nek-conner-mon", jobNo: "J34769", customer: "Faith Journey Church", desc: "FJ bld sign install", emp: "nek-connerp", loc: "loc-nek", day: 0, hours: 8, zip: "66061", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-conner-tue", jobNo: "J36400 / J36291 · NKC-021/013", customer: "NKC Health", desc: "Install sign package", emp: "nek-connerp", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-conner-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-conner-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-connerp", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-conner-fri", jobNo: "svc-hutch-pickup", customer: "Hutchinson Pickup", desc: "Pick up sign faces", emp: "nek-connerp", loc: "loc-nek", day: 4, hours: 8, zip: "67501", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),

  // ============ Hunter ============
  mkLine({ id: "nek-hunter-mon", jobNo: "svc-kdem", customer: "KDEM", desc: "KDEM service call", emp: "nek-hunter", loc: "loc-nek", day: 0, hours: 8, zip: "66603", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-hunter-tue", jobNo: "J36400 / J36291 · NKC-021/013", customer: "NKC Health", desc: "Install sign package", emp: "nek-hunter", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-hunter-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-hunter", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-hunter-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-hunter", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-hunter-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-hunter", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Josh S ============
  mkLine({ id: "nek-josh-mon", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 0, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-tue", jobNo: "J36400 / J36291 · NKC-021/013", customer: "NKC Health", desc: "Install sign package", emp: "nek-joshs", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-josh-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-joshs", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Justin J ============
  mkLine({ id: "nek-justinj-mon", jobNo: "svc-kdem", customer: "KDEM", desc: "KDEM service call", emp: "nek-justinj", loc: "loc-nek", day: 0, hours: 8, zip: "66603", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-justinj-tue", jobNo: "J36400 / J36291 · NKC-021/013", customer: "NKC Health", desc: "Install sign package", emp: "nek-justinj", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-justinj-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-justinj-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-justinj-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-justinj", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Jarrod L ============
  mkLine({ id: "nek-jarrod-mon", jobNo: "svc-regional", customer: "Regional Service", desc: "Regional service call", emp: "nek-jarrodl", loc: "loc-nek", day: 0, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-jarrod-tue", jobNo: "J36400 / J36291 · NKC-021/013", customer: "NKC Health", desc: "Install sign package", emp: "nek-jarrodl", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-jarrod-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-jarrod-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),
  mkLine({ id: "nek-jarrod-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-jarrodl", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 0, region: "NEK" }),

  // ============ Aaron W ============
  mkLine({ id: "nek-aaron-mon", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers) · 9401 N Oak", emp: "nek-aaronw", loc: "loc-nek", day: 0, hours: 8, zip: "64155", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-aaron-tue", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-aaronw", loc: "loc-nek", day: 1, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-aaron-wed", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-aaronw", loc: "loc-nek", day: 2, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-aaron-thu", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-aaronw", loc: "loc-nek", day: 3, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
  mkLine({ id: "nek-aaron-fri", jobNo: "NKC-018", customer: "NKC Health · Sign Package", desc: "Install sign package (a lot of numbers)", emp: "nek-aaronw", loc: "loc-nek", day: 4, hours: 8, zip: "64116", invoice: 0, crew: 1, trucks: 1, region: "NEK" }),
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
