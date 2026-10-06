// Who may change what on the Jobs list.
//
//  - Full editors (role: Admin / Developer / Ops — `editJobs`) change anything:
//    every field, the shared views, field options, custom field definitions.
//  - Anyone else may be GRANTED individual fields in Settings → Users (stored
//    per login on crfdf_appuser.crfdf_jobeditfields). They can change exactly
//    those cells — nothing structural (views, Fields, options) and no other
//    field. No grants = view only.
//
// Field keys are the Jobs column keys (jobs-fields.ts / jobs-editable.ts) and
// custom fields' own keys (cf_…). Pure — no I/O.

export interface JobEditAccess {
  /** Full editor (role-based): every field + the list's structure. */
  all: boolean;
  /** Fields granted to this login (ignored when `all`). */
  fields: ReadonlySet<string>;
}

export const NO_JOB_EDITS: JobEditAccess = { all: false, fields: new Set() };

export function jobEditAccess(fullEditor: boolean, granted: readonly string[]): JobEditAccess {
  return { all: fullEditor, fields: fullEditor ? new Set() : new Set(granted) };
}

/** May this login change the field with this key? */
export function canEditJobField(a: JobEditAccess, key: string): boolean {
  return a.all || a.fields.has(key);
}

/** Any edit at all (full, or at least one granted field). */
export function hasAnyJobEdits(a: JobEditAccess): boolean {
  return a.all || a.fields.size > 0;
}

/** crfdf_jobeditfields text → keys (comma-separated; blanks + repeats dropped). */
export function parseJobEditFields(raw: string | null | undefined): string[] {
  const out: string[] = [];
  for (const k of (raw ?? "").split(",")) {
    const key = k.trim();
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Keys → crfdf_jobeditfields text. */
export function formatJobEditFields(keys: readonly string[]): string {
  return parseJobEditFields(keys.join(",")).join(",");
}
