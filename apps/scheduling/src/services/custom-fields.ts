/**
 * Custom fields for the Jobs list (pure) — ported from the LNI Production
 * Scheduler app (types/schema.ts CustomFieldDef, hooks/useCustomFields.ts,
 * FieldManager), but shared: definitions live in Dataverse crfdf_jobfield and
 * each job's values in crfdf_jobtrack.crfdf_customvalues (JSON, keyed by field).
 *
 * Values by type: text / multiline / url / email / phone → string; number /
 * currency → number; date → "YYYY-MM-DD"; bool → boolean; select → string;
 * multiselect → string[]. Formula Date fields hold no value — they're computed
 * from another date column plus an offset. A field can change type within its
 * group (compatibleTypes); values are never rewritten — Single / Multi Select
 * read either shape (choiceList) until the cell is next edited.
 */
import { addBusinessDays, addDays, addWeeks, format } from "date-fns";
import type { JobRow } from "./job-tracking";

export type CustomFieldType =
  | "text"
  | "multiline"
  | "number"
  | "currency"
  | "date"
  | "bool"
  | "select"
  | "multiselect"
  | "url"
  | "email"
  | "phone"
  | "formula-date";

export type FormulaUnit = "days" | "weeks" | "workdays";

export interface FormulaDateConfig {
  /** A date column's key: a built-in one (FORMULA_BASE_FIELDS) or a custom Date field. */
  baseField: string;
  /** Whole number; negative = before. */
  offset: number;
  unit: FormulaUnit;
}

export interface CustomFieldDef {
  /** "cf_<id>" — the column key in views, widths and the values JSON. */
  key: string;
  label: string;
  type: CustomFieldType;
  width: number;
  /** Options for select / multiselect. */
  opts?: string[];
  /** Option → hex colour. */
  optColors?: Record<string, string>;
  formula?: FormulaDateConfig;
}

export type CustomValues = Record<string, unknown>;

export const CUSTOM_KEY_PREFIX = "cf_";
export const isCustomKey = (key: string): boolean => key.startsWith(CUSTOM_KEY_PREFIX);

export const FIELD_TYPES: ReadonlyArray<{ type: CustomFieldType; icon: string; label: string }> = [
  { type: "text", icon: "Aa", label: "Text" },
  { type: "multiline", icon: "¶", label: "Long text" },
  { type: "number", icon: "#", label: "Number" },
  { type: "currency", icon: "$", label: "Currency" },
  { type: "date", icon: "⬚", label: "Date" },
  { type: "bool", icon: "☑", label: "Checkbox" },
  { type: "select", icon: "▼", label: "Single Select" },
  { type: "multiselect", icon: "▼▼", label: "Multi Select" },
  { type: "url", icon: "↗", label: "URL" },
  { type: "email", icon: "@", label: "Email" },
  { type: "phone", icon: "☎", label: "Phone" },
  { type: "formula-date", icon: "f()", label: "Formula Date" },
];

export const DEFAULT_WIDTH: Record<CustomFieldType, number> = {
  text: 160, multiline: 200, number: 100, currency: 110, date: 120, bool: 80,
  select: 150, multiselect: 200, url: 180, email: 180, phone: 130, "formula-date": 120,
};

/** Types a field can switch between without touching any job's value: the
 *  stored shapes are the same, or (Single ↔ Multi Select) read either way. */
const TYPE_GROUPS: ReadonlyArray<readonly CustomFieldType[]> = [
  ["select", "multiselect"],
  ["text", "multiline", "url", "email", "phone"],
  ["number", "currency"],
];

/** What an existing field of this type can be changed to (itself included). */
export function compatibleTypes(type: CustomFieldType): readonly CustomFieldType[] {
  return TYPE_GROUPS.find((g) => g.includes(type)) ?? [type];
}

/** A Single / Multi Select value as a list, whichever way it was saved
 *  (a field switched from Single keeps "A"; from Multi keeps ["A", "B"]). */
export function choiceList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && !!x);
  return typeof v === "string" && v ? [v] : [];
}

/** Built-in Jobs date columns a Formula Date can start from. */
export const FORMULA_BASE_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "releaseDate", label: "Release Date" },
  { key: "orderDate", label: "Order Date" },
  { key: "mfgTarget", label: "Mfg Target" },
  { key: "mfgTargetMod", label: "Mfg Target Mod" },
  { key: "mfgFinalDate", label: "Mfg Final Date" },
  { key: "installTarget", label: "Install Target" },
  { key: "scheduledInstall", label: "Sched. Install" },
  { key: "redDate", label: "RED DATE" },
  { key: "expeditor", label: "Expeditor" },
  { key: "dateToHold", label: "Date to Hold" },
  { key: "dateOffHold", label: "Date off Hold" },
  { key: "vendorShipDate", label: "Vendor Ship Date" },
  { key: "outsourcedArrival", label: "Outsourced Arrival" },
  { key: "dateInstalled", label: "Date Installed" },
  { key: "dateToAdmin", label: "Date to Admin" },
  { key: "dateInvoiced", label: "Date Invoiced" },
];

/** What a Formula Date can start from: the built-in dates + custom Date fields. */
export function formulaBaseOptions(defs: readonly CustomFieldDef[]): Array<{ key: string; label: string }> {
  return [
    ...FORMULA_BASE_FIELDS,
    ...defs.filter((d) => d.type === "date").map((d) => ({ key: d.key, label: d.label })),
  ];
}

const UNIT_LABEL: Record<FormulaUnit, [string, string]> = {
  days: ["day", "days"],
  weeks: ["week", "weeks"],
  workdays: ["working day", "working days"],
};

/** "Release Date + 3 weeks" */
export function describeFormula(f: FormulaDateConfig, defs: readonly CustomFieldDef[]): string {
  const base = formulaBaseOptions(defs).find((o) => o.key === f.baseField)?.label ?? f.baseField;
  if (!f.offset) return `= ${base}`;
  const n = Math.abs(f.offset);
  return `= ${base} ${f.offset < 0 ? "−" : "+"} ${n} ${UNIT_LABEL[f.unit][n === 1 ? 0 : 1]}`;
}

const dayOf = (s: unknown): Date | null => {
  const m = typeof s === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** A Formula Date's value from a date string ("" when the base is blank). */
export function computeFormulaDate(base: unknown, f: FormulaDateConfig): string {
  const d = dayOf(base);
  if (!d) return "";
  const n = Math.trunc(f.offset) || 0;
  const out = f.unit === "weeks" ? addWeeks(d, n) : f.unit === "workdays" ? addBusinessDays(d, n) : addDays(d, n);
  return format(out, "yyyy-MM-dd");
}

/** The cell value a job row carries for a field (what sort / filter / group see). */
export function cellValue(def: CustomFieldDef, v: unknown): unknown {
  switch (def.type) {
    case "number":
    case "currency":
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    case "bool":
      return v === true;
    case "select":
    case "multiselect":
      return choiceList(v).join(", ");
    default:
      return typeof v === "string" ? v : "";
  }
}

/**
 * Put every custom field's value on each row, under the field's key. Formula
 * Dates are computed after the stored values, so one can start from a custom
 * Date field.
 */
export function withCustomFields(
  rows: readonly JobRow[],
  defs: readonly CustomFieldDef[],
  valuesFor: (jobNo: string) => CustomValues | undefined,
): JobRow[] {
  if (!defs.length) return rows as JobRow[];
  const stored = defs.filter((d) => d.type !== "formula-date");
  const formulas = defs.filter((d) => d.type === "formula-date" && d.formula);
  return rows.map((row) => {
    const vals = valuesFor(row.jobNo) ?? {};
    const out: Record<string, unknown> = { ...row };
    for (const d of stored) out[d.key] = cellValue(d, vals[d.key]);
    for (const d of formulas) out[d.key] = computeFormulaDate(out[d.formula!.baseField], d.formula!);
    return out as unknown as JobRow;
  });
}

/** Clean a value typed into an editor for storage (null = clear it). */
export function normalizeValue(def: CustomFieldDef, raw: unknown): unknown {
  switch (def.type) {
    case "number":
    case "currency": {
      if (raw === "" || raw == null) return null;
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
      return Number.isFinite(n) ? (def.type === "currency" ? Math.round(n * 100) / 100 : n) : null;
    }
    case "bool":
      return raw === true;
    case "date":
      return dayOf(raw) ? String(raw).slice(0, 10) : null;
    case "multiselect":
      return choiceList(raw);
    case "url": {
      const s = String(raw ?? "").trim();
      return s && !/^[a-z][a-z0-9+.-]*:/i.test(s) ? `https://${s}` : s || null;
    }
    case "formula-date":
      return null;
    default: {
      const s = String(raw ?? "").trim();
      return s || null;
    }
  }
}

/** A link for URL / Email / Phone values ("" when there's nothing to link). */
export function linkFor(type: CustomFieldType, value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (type === "email") return `mailto:${v}`;
  if (type === "phone") return `tel:${v.replace(/[^\d+]/g, "")}`;
  if (type === "url") return /^https?:\/\//i.test(v) ? v : "";
  return "";
}

/** A fresh field key. */
export const newFieldKey = (): string => `${CUSTOM_KEY_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Readable text on a hex background. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#222";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1f2330" : "#ffffff";
}

/** Option colours offered in the field editor (the app's badge palette). */
export const OPTION_COLORS: readonly string[] = [
  "#D2F5D2", "#BEDCFF", "#DCD2FF", "#FFE6C8", "#FFD699", "#FFC8C8", "#EEF0F3",
  "#1a6b1a", "#003a70", "#3a0070", "#7a4000", "#8a0000", "#141464",
];

/** An option's colour: the one set on the field, else the palette in option order. */
export function optionColor(def: Pick<CustomFieldDef, "opts" | "optColors">, opt: string): string {
  const set = def.optColors?.[opt];
  if (set) return set;
  const i = Math.max(0, (def.opts ?? []).indexOf(opt));
  return OPTION_COLORS[i % 7]!;
}
