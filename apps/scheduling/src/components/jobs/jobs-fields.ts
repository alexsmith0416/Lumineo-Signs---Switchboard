// Jobs view columns, badge colours and saved views — ported from the Airtable
// recreation app (Documents/LNI-ProductionSchedule: fieldDefs.ts, statusColors.ts,
// viewConfigs.ts) and adapted to JobRow (services/job-tracking.ts). The "/" "X"
// department columns are gone: the Stepper column replaces them.
import type { JobRow } from "../../services/job-tracking";
import type { CustomFieldDef } from "../../services/custom-fields";

export type JobFieldType =
  | "text" | "multiline" | "badge" | "date" | "currency" | "bool" | "days" | "stepper" | "sketch" | "pos"
  // custom fields
  | "number" | "select" | "link";

export interface JobFieldDef {
  /** A JobRow key, "stepper", or a custom field's "cf_…" key. */
  key: keyof JobRow | "stepper" | (string & {});
  label: string;
  type: JobFieldType;
  width: number;
  /** Only shown to roles that may see $ values. */
  money?: boolean;
  /** Set on custom fields. */
  custom?: CustomFieldDef;
  /** A choice column that holds several values ("VB, NH") — one pill each. */
  multi?: boolean;
}

/** A custom field as a Jobs column. */
export function customColumn(def: CustomFieldDef): JobFieldDef {
  const type: JobFieldType =
    def.type === "select" || def.type === "multiselect"
      ? "select"
      : def.type === "url" || def.type === "email" || def.type === "phone"
        ? "link"
        : def.type === "formula-date"
          ? "date"
          : def.type;
  // A Currency field is a $ figure — hidden from users without $ access, like Value.
  return {
    key: def.key, label: def.label, type, width: def.width, custom: def, money: def.type === "currency",
    multi: def.type === "multiselect",
  };
}

const F = (key: JobFieldDef["key"], label: string, type: JobFieldType, width: number, money = false): JobFieldDef => ({
  key, label, type, width, money,
});

export const JOB_FIELDS: Record<string, JobFieldDef> = Object.fromEntries(
  [
    F("job", "Job # / Name", "text", 260),
    F("status", "Current Status", "badge", 190),
    F("stepper", "Stepper", "stepper", 300),
    F("sketch", "Sketch", "sketch", 90),
    F("description", "Description", "multiline", 240),
    { ...F("sales", "Sales", "badge", 80), multi: true },
    F("location", "Location", "text", 120),
    F("region", "Region", "badge", 70),
    F("priority", "Priority", "badge", 95),
    F("orderDate", "Order Date", "date", 105),
    F("mfgFinalDate", "Mfg Final Date", "date", 115),
    F("mfgTarget", "Mfg Target", "date", 105),
    F("mfgTargetMod", "Mfg Target Mod", "date", 120),
    F("installTarget", "Install Target", "date", 115),
    F("leadRule", "Lead Time Rule", "text", 150),
    F("redDate", "RED DATE", "date", 100),
    F("releaseDate", "Release Date", "date", 110),
    F("scheduledInstall", "Sched. Install", "date", 115),
    F("dip", "DIP", "days", 65),
    F("doh", "DOH", "days", 65),
    F("actualDip", "Actual DIP", "days", 90),
    F("notes", "Job Notes", "multiline", 200),
    F("powerlines", "Powerlines", "badge", 95),
    F("holdReason", "Hold", "badge", 140),
    F("dateToHold", "Date to Hold", "date", 110),
    F("dateOffHold", "Date off Hold", "date", 110),
    F("expeditor", "Expeditor", "date", 105),
    F("dateInstalled", "Date Installed", "date", 115),
    F("dateToAdmin", "Date to Admin", "date", 115),
    F("dateInvoiced", "Date Invoiced", "date", 115),
    F("vendor", "Vendor", "badge", 115),
    F("po", "P.O. #", "text", 85),
    F("pos", "POs", "pos", 190),
    F("vendorStatus", "Vendor Status", "badge", 115),
    F("storageLocation", "Storage Location", "text", 160),
    F("vendorShipDate", "Vendor Ship Date", "date", 125),
    F("vendorShipDate2", "2nd Vendor Ship", "date", 125),
    F("outsourcedArrival", "Outsourced Arrival", "date", 135),
    F("graphics", "Graphics", "badge", 110),
    F("routingType", "Routing Type", "text", 135),
    F("ulSign", "UL Sign", "bool", 70),
    F("process", "Process (Airtable)", "badge", 130),
    F("mfgRegion", "MFG Region", "badge", 95),
    F("installRegion", "Install Region", "badge", 110),
    F("value", "Value", "currency", 100, true),
    F("remaining", "Remaining Balance", "currency", 135, true),
  ].map((f) => [f.key, f]),
);

// ── Badge colours ────────────────────────────────────────────────────────────
export const BADGE_COLORS = {
  green: { bg: "#D2F5D2", text: "#1a6b1a" },
  red: { bg: "#FFC8C8", text: "#8a0000" },
  orange: { bg: "#FFE6C8", text: "#7a4000" },
  blue: { bg: "#BEDCFF", text: "#003a70" },
  purple: { bg: "#DCD2FF", text: "#3a0070" },
  yellow: { bg: "#FFD699", text: "#5a3a00" },
  gray: { bg: "#EEF0F3", text: "#4a4f5e" },
  navy: { bg: "#141464", text: "#FFFFFF" },
} as const;
export type BadgeColor = keyof typeof BADGE_COLORS;

const STATUS: Record<string, BadgeColor> = {
  "Complete Invoiced": "green", "Complete to Admin": "green", "Service Complete to Admin": "green",
  "Complete-need paperwork": "orange", Installation: "blue", "Install - waiting on product": "blue",
  "New Order this week": "blue", "NEK - Production": "blue", "Upcoming Mfg.": "orange",
  "Steel MFG": "purple", "Needs Shipped": "purple", "Service or Contract Order": "red",
  "Service - Hold": "yellow", "Not tracked yet": "gray",
};
const VENDOR_STATUS: Record<string, BadgeColor> = {
  ORDERED: "blue", SHIPPING: "yellow", RECEIVED: "green", "ON HOLD": "red", "Ready to Pick Up": "orange",
  SHIPPED: "blue", "Artwork Approved": "green", Delayed: "red",
};
const SALES: Record<string, BadgeColor> = {
  LNI: "navy", CC: "blue", NH: "purple", DW: "green", MM: "orange", AS: "red", DP: "blue", VB: "purple",
  SP: "green", AW: "yellow", QT: "orange", MS: "gray", TC: "red", DD: "navy", JA: "blue", JL: "purple", TN: "green",
};
const REGION: Record<string, BadgeColor> = { WK: "green", NEK: "red" };

export function badgeColor(field: string, value: string): BadgeColor {
  if (!value) return "gray";
  if (field === "status") {
    if (STATUS[value]) return STATUS[value]!;
    if (value.startsWith("MFG")) return "orange";
    if (value.startsWith("Hold") || value.includes("Hold")) return "yellow";
    return "gray";
  }
  if (field === "holdReason") return "yellow";
  if (field === "priority") return value === "RED DATE" ? "red" : value === "Rush" ? "orange" : "blue";
  if (field === "vendorStatus") return VENDOR_STATUS[value] ?? "gray";
  if (field === "sales") return SALES[value.split(",")[0]!.trim()] ?? "gray";
  if (field === "region" || field === "mfgRegion" || field === "installRegion") return REGION[value] ?? "gray";
  return "gray";
}

/** Default ordering tier by Current Status (from the Airtable app): lower first. */
export function statusTier(status: string): number {
  if (/^Complete|Invoiced/.test(status)) return 1;
  if (/^Install|Needs Shipped/.test(status)) return 2;
  if (/^MFG|Steel MFG|Upcoming Mfg/.test(status)) return 3;
  if (/Subcontracted|Outsourced|NEK - Production|Service/.test(status)) return 4;
  if (/Hold/.test(status)) return 5;
  if (/New Order/.test(status)) return 6;
  if (status === "Not tracked yet") return 9;
  return 7;
}

// ── Saved views ──────────────────────────────────────────────────────────────
export interface JobsView {
  name: string;
  cols: string[];
  /** Group by this field when the view is opened with no saved grouping. */
  defaultGroup?: string;
  /** A built-in row limit (see jobs-view-layout PRESETS). */
  preset?: "untracked";
}

export const JOB_VIEW_GROUPS: { label: string; views: JobsView[] }[] = [
  {
    label: "Master",
    views: [
      { name: "All Jobs", defaultGroup: "status",
        cols: ["job", "sketch", "status", "stepper", "sales", "location", "region", "priority", "orderDate", "mfgFinalDate", "redDate", "scheduledInstall", "dip", "doh", "actualDip", "value", "remaining"] },
      { name: "Not tracked yet", preset: "untracked",
        cols: ["job", "status", "description", "sales", "location", "value", "remaining"] },
    ],
  },
  {
    label: "Team",
    views: [
      { name: "OPS / MFG", defaultGroup: "status",
        cols: ["job", "status", "stepper", "mfgRegion", "routingType", "graphics", "orderDate", "mfgTarget", "mfgTargetMod", "mfgFinalDate", "redDate", "notes"] },
      { name: "OPS / Install", defaultGroup: "status",
        cols: ["job", "status", "stepper", "installRegion", "location", "installTarget", "scheduledInstall", "redDate", "dateInstalled", "powerlines", "sales", "dip", "actualDip", "notes"] },
      { name: "Warehouse Coord.",
        cols: ["job", "status", "pos", "storageLocation", "vendorStatus", "vendorShipDate", "vendor", "notes"] },
    ],
  },
  {
    label: "Individual",
    views: [
      { name: "WK Expeditor", defaultGroup: "status",
        cols: ["job", "sketch", "status", "stepper", "orderDate", "mfgTarget", "mfgTargetMod", "mfgFinalDate", "installTarget", "sales", "location", "region",
          "description", "priority", "redDate", "releaseDate", "scheduledInstall", "notes", "powerlines", "holdReason", "dateToHold", "dateOffHold", "expeditor",
          "dateInstalled", "dateToAdmin", "dateInvoiced", "vendor", "po", "vendorStatus", "storageLocation", "vendorShipDate",
          "vendorShipDate2", "outsourcedArrival", "graphics", "routingType", "ulSign", "process", "mfgRegion", "installRegion",
          "dip", "doh", "actualDip", "value", "remaining"] },
    ],
  },
];
