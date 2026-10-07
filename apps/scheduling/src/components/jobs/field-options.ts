// "Edit field…" for the built-in Jobs columns: a column's NAME, and for choice
// columns (Current Status, Priority, Hold, Vendor, …) their option LIST — the
// order shown in the dropdown and used to sort and group by the column — each
// option's colour, and Single vs Multi Select.
//
// Built-in columns start from their defaults (jobs-fields.ts names + badge
// colours, jobs-editable.ts lists); edits are stored as an override per column
// (store/field-options-store.ts), shared by everyone. Custom fields keep all of
// this on the field itself (crfdf_jobfield).
import { contrastText, optionColor, type CustomFieldDef } from "../../services/custom-fields";
import { BUILTIN_EDITS } from "./jobs-editable";
import { BADGE_COLORS, badgeColor, type JobFieldDef } from "./jobs-fields";

export interface FieldOptionOverride {
  /** The options in order; replaces the default list. */
  opts?: string[];
  /** Option → background colour (hex); text colour follows. */
  colors?: Record<string, string>;
  /** The column's name everywhere in the app ("" / absent = the default name). */
  label?: string;
  /** Multi Select (true) or Single Select (false); absent = the column's default. */
  multi?: boolean;
}

/** A built-in column with its edited name and Single / Multi setting. */
export function builtinColumn(col: JobFieldDef, override?: FieldOptionOverride): JobFieldDef {
  const label = override?.label?.trim();
  const multi = builtinIsMulti(col.key, override);
  return label || multi !== !!col.multi ? { ...col, label: label || col.label, multi } : col;
}

/** Can this built-in column switch between Single and Multi Select? Only the
 *  plain tracking choices (saved as text, "A, B" when several): not Current
 *  Status or Hold, which drive the status automation. */
export function canToggleMulti(field: string): boolean {
  const t = BUILTIN_EDITS[field];
  return t?.kind === "track" && field !== "holdReason" && (t.field.type === "select" || t.field.type === "multiselect");
}

/** Does this built-in column hold several values? */
export function builtinIsMulti(field: string, override?: FieldOptionOverride): boolean {
  const def = BUILTIN_EDITS[field]?.field.type === "multiselect";
  return canToggleMulti(field) && typeof override?.multi === "boolean" ? override.multi : def;
}

/** The in-place editor for a built-in column: its edited option list and Single / Multi. */
export function builtinEditor(field: string, override?: FieldOptionOverride): CustomFieldDef | null {
  const f = BUILTIN_EDITS[field]?.field;
  if (!f) return null;
  if (!f.opts) return f;
  return { ...f, type: builtinIsMulti(field, override) ? "multiselect" : "select", opts: builtinOptions(field, override) };
}

/** "A, B" (how a multi value is saved on the tracking row) → ["A", "B"]. */
export function splitMulti(v: unknown): string[] {
  return String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

export interface OptionStyle {
  bg: string;
  text: string;
}

/** A column whose values are chosen from a list (shown as coloured pills). */
export function isChoiceColumn(col: JobFieldDef): boolean {
  return col.type === "badge" || (col.type === "select" && !!col.custom);
}

/** A built-in column's options: the override, else its default list. */
export function builtinOptions(field: string, override?: FieldOptionOverride): string[] {
  return override?.opts ?? [...(BUILTIN_EDITS[field]?.field.opts ?? [])];
}

/** A built-in column's colour for a value: the override, else its badge colour. */
export function builtinStyle(field: string, value: string, override?: FieldOptionOverride): OptionStyle {
  const bg = override?.colors?.[value];
  return bg ? { bg, text: contrastText(bg) } : BADGE_COLORS[badgeColor(field, value)];
}

/** A custom field's colour for a value. */
export function customStyle(def: CustomFieldDef, value: string): OptionStyle {
  const bg = optionColor(def, value);
  return { bg, text: contrastText(bg) };
}

/** The colour a built-in value has with no override (for the colour picker). */
export function defaultBg(field: string, value: string): string {
  return BADGE_COLORS[badgeColor(field, value)].bg;
}

/** Where a value sits in an option list (values not in it go last). */
export function rankIn(order: readonly string[], value: string): number {
  const i = order.indexOf(value);
  return i < 0 ? order.length : i;
}
