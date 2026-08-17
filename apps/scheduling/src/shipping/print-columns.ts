// Tick-box columns on a load's printed shipping list.
//
// The sheet starts with "Loaded" and "Order", but a run often needs its own
// check-offs (Strapped, Tarped, Paperwork, Photo…). The user keeps a library of
// column options and picks which of them print. Pure logic here; the library +
// selection persist in settings-store, and LoadPrintSheet renders one column per
// selected option.

/** Always offered, and can't be deleted (deselecting them is enough). */
export const BUILT_IN_CHECK_COLUMNS = ["Loaded", "Order"];

/** Keeps a column narrow enough to stay readable on paper. */
export const MAX_CHECK_LABEL = 20;

/** Past this the header row eats the sheet, so the picker stops offering more. */
export const MAX_CHECK_COLUMNS = 6;

/** Trim, collapse inner whitespace, and cap the length. "" = not a usable label. */
export function normalizeCheckLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHECK_LABEL);
}

const sameLabel = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Add a label to the library. Blank or already-present (case-insensitively) →
 *  the list is returned unchanged, so callers can detect a no-op by identity. */
export function addCheckOption(options: string[], raw: string): string[] {
  const label = normalizeCheckLabel(raw);
  if (!label) return options;
  if (options.some((o) => sameLabel(o, label))) return options;
  return [...options, label];
}

/** Remove a user-added label. Built-ins are kept — they're the sheet's baseline. */
export function removeCheckOption(options: string[], label: string): string[] {
  if (BUILT_IN_CHECK_COLUMNS.some((b) => sameLabel(b, label))) return options;
  const next = options.filter((o) => !sameLabel(o, label));
  return next.length === options.length ? options : next;
}

/** Tick / untick a column. Refuses to go past MAX_CHECK_COLUMNS. */
export function toggleCheckColumn(selected: string[], label: string): string[] {
  if (selected.some((s) => sameLabel(s, label))) {
    return selected.filter((s) => !sameLabel(s, label));
  }
  if (selected.length >= MAX_CHECK_COLUMNS) return selected;
  return [...selected, label];
}

/** The columns to actually print: selected ones, in library order (so the sheet
 *  doesn't reshuffle with click order), minus any whose option was deleted. */
export function visibleCheckColumns(selected: string[], options: string[]): string[] {
  return options.filter((o) => selected.some((s) => sameLabel(s, o)));
}
