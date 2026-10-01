// Choice columns (Current Status, Priority, Hold, Vendor, … and custom Single /
// Multi Select fields): their option LIST — the order shown in the dropdown and
// used to sort and group by the column — and each option's colour.
//
// Built-in columns start from their default lists (jobs-editable.ts) and badge
// colours (jobs-fields.ts); edits made with "Edit field…" on the column header
// are stored as an override per column (store/field-options-store.ts), shared
// by everyone. Custom fields keep their options on the field itself.
import { contrastText, optionColor, type CustomFieldDef } from "../../services/custom-fields";
import { BUILTIN_EDITS } from "./jobs-editable";
import { BADGE_COLORS, badgeColor, type JobFieldDef } from "./jobs-fields";

export interface FieldOptionOverride {
  /** The options in order; replaces the default list. */
  opts?: string[];
  /** Option → background colour (hex); text colour follows. */
  colors?: Record<string, string>;
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
