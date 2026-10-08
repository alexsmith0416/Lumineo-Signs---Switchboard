// Which built-in Jobs columns editors can change in the grid, and where each
// one saves. The editor itself is the custom-field editor (CustomValueEditor),
// so every column gets a CustomFieldDef-shaped description of its input.
//
//  - "track"    → the job's crfdf_jobtrack row (Airtable-era tracking fields)
//  - "schedule" → the SHARED job-schedule store (the same Install Dates the
//                 boards use), so a change shows on the boards too
//  - "status"   → Current Status, through the status automation (setStatus)
//
// Sales fills from BC's salesperson, but can be changed here: the edit is kept
// in the app only (crfdf_jobtrack.crfdf_salesoverride), never written to BC;
// clearing it goes back to BC's value.
//
// Not here on purpose: Location / Region (filled from BC), Mfg Target /
// Install Target / Mfg Final / DIP / DOH (calculated), Value / Remaining
// Balance (BC), and the Job name (rename in the job panel).
import type { CustomFieldDef } from "../../services/custom-fields";
import type { JobTrack } from "../../services/job-tracking";
import { STATUS_OPTIONS, isHoldStatus } from "../../services/job-status";

export type TrackEditKey = keyof Pick<
  JobTrack,
  | "priority" | "holdReason" | "dateToHold" | "dateOffHold" | "expeditorDate" | "dateInstalled" | "dateToAdmin"
  | "dateInvoiced" | "vendor" | "poNumber" | "vendorStatus" | "storageLocation" | "vendorShipDate" | "vendorShipDate2"
  | "outsourcedArrival" | "graphics" | "routingType" | "powerlines" | "mfgRegion" | "installRegion" | "ulSign" | "notes"
  | "salesOverride"
>;

export type ScheduleEditKey = "releasedDate" | "productionCompleteDate" | "scheduledInstallDate" | "redDate";

export type EditTarget =
  | { kind: "track"; trackKey: TrackEditKey; field: CustomFieldDef }
  | { kind: "schedule"; schedKey: ScheduleEditKey; field: CustomFieldDef }
  | { kind: "status"; field: CustomFieldDef };

const field = (key: string, type: CustomFieldDef["type"], opts?: readonly string[]): CustomFieldDef => ({
  key, label: key, type, width: 0, ...(opts ? { opts: [...opts] } : {}),
});

const track = (key: string, trackKey: TrackEditKey, type: CustomFieldDef["type"], opts?: readonly string[]): [string, EditTarget] =>
  [key, { kind: "track", trackKey, field: field(key, type, opts) }];
const schedule = (key: string, schedKey: ScheduleEditKey): [string, EditTarget] =>
  [key, { kind: "schedule", schedKey, field: field(key, "date") }];

// Option lists from the LNI Production Scheduler app (data/fieldDefs.ts).
const PRIORITY = ["RED DATE", "Rush", "SIP", "WI", "ILM", "DNI", "PI", "Priority"];
const VENDOR = [
  "GREGORY", "GEMINI", "SIGN HOUSE", "LAWRENCE", "WATCHFIRE", "SALINA", "UFB", "MIRATEC", "DSW", "Fossil", "Reece",
  "GSG", "Eastern Metals", "Midwest Supply", "GRIMCO", "SIGNAL TECH", "REGIONAL", "REGAL", "UNITED RENTALS",
  "BENCHMARK", "ESCO", "Display4Sale", "Wichita Awning", "Federal Heath", "Everbrite", "Horizon", "Daktronics",
  "Sign Leaders", "Awning Innovations", "Zlight/GSG", "40 Visual", "Illumatech",
];
const VENDOR_STATUS = ["ORDERED", "SHIPPING", "RECEIVED", "Ready to Pick Up", "SHIPPED", "Artwork Approved", "Delayed", "ON HOLD"];
const GRAPHICS = [
  "Hutch", "Lawrence", "Pattern", "Complete", "Here/Ready", "Outsourced", "Incomplete", "Shipped", "N/A",
  "Routing overlay", "Paint Mask", "NEK to Apply", "Graphics",
];
const ROUTING_TYPE = [
  "Metal & Backed", "Metal w/ Push Thru", "Metal Only", "1/2 Plex", "Routing Complete", "Metal & Plex", "PVC Board",
  "Plex Face", "3/8 Plex", "Routing",
];
const POWERLINES = ["?", "YES", "Covered", "N/A", "Powerlines", "Requested"];
const MFG_REGION = ["WK", "NEK", "Sub", "HOUSE"];
const INSTALL_REGION = ["WK", "NEK", "Sub-Installer", "HOUSE"];
export const STORAGE_LOCATIONS = [
  "Bus Barn - Floor", "Bus Barn - Garage", "Car Barn - Floor", "Outside of Shop", "Receiving Shelf", "Supply Room",
  "Vinyl Room", "Warehouse - Floor", "Warehouse - South Wall", "Warehouse - West Wall",
];
const HOLDS = STATUS_OPTIONS.filter(isHoldStatus);
// Sales initials (the LNI list).
const SALES = ["LNI", "CC", "NH", "DW", "MM", "AS", "DP", "VB", "SP", "AW", "QT", "MS", "TC", "DD", "JA", "JL", "TN"];

/** Editable built-in columns, by Jobs column key. */
export const BUILTIN_EDITS: Readonly<Record<string, EditTarget>> = Object.fromEntries([
  ["status", { kind: "status", field: field("status", "select", STATUS_OPTIONS) }],
  track("priority", "priority", "select", PRIORITY),
  track("sales", "salesOverride", "multiselect", SALES),
  track("holdReason", "holdReason", "select", HOLDS),
  track("dateToHold", "dateToHold", "date"),
  track("dateOffHold", "dateOffHold", "date"),
  track("expeditor", "expeditorDate", "date"),
  track("dateInstalled", "dateInstalled", "date"),
  track("dateToAdmin", "dateToAdmin", "date"),
  track("dateInvoiced", "dateInvoiced", "date"),
  track("vendor", "vendor", "select", VENDOR),
  track("po", "poNumber", "text"),
  track("vendorStatus", "vendorStatus", "select", VENDOR_STATUS),
  track("storageLocation", "storageLocation", "select", STORAGE_LOCATIONS),
  track("vendorShipDate", "vendorShipDate", "date"),
  track("vendorShipDate2", "vendorShipDate2", "date"),
  track("outsourcedArrival", "outsourcedArrival", "date"),
  track("graphics", "graphics", "select", GRAPHICS),
  track("routingType", "routingType", "select", ROUTING_TYPE),
  track("powerlines", "powerlines", "select", POWERLINES),
  track("mfgRegion", "mfgRegion", "select", MFG_REGION),
  track("installRegion", "installRegion", "select", INSTALL_REGION),
  track("ulSign", "ulSign", "bool"),
  track("notes", "notes", "multiline"),
  // Order Date IS the release date, so both edit the in-app release date.
  schedule("releaseDate", "releasedDate"),
  schedule("orderDate", "releasedDate"),
  schedule("mfgTargetMod", "productionCompleteDate"),
  schedule("scheduledInstall", "scheduledInstallDate"),
  schedule("redDate", "redDate"),
]);

/** A value from the editor, as a crfdf_jobtrack field stores it ("" = cleared).
 *  `field` = the editor actually shown (a choice column may be switched to
 *  Single / Multi Select with "Edit field…"); several values save as "A, B". */
export function trackValue(field: Pick<CustomFieldDef, "type">, v: unknown): string | boolean {
  if (field.type === "bool") return v === true;
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x).join(", ");
  return typeof v === "string" ? v : "";
}

/** "YYYY-MM-DD" → a local date (null when blank). */
export function localDate(v: unknown): Date | null {
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
