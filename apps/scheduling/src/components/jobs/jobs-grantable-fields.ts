// The Jobs-list fields that can be granted to a login in Settings → Users
// (see services/job-edit-access.ts). Only fields someone can actually change:
// the built-in editable columns (jobs-editable.ts), the job name (renamed in
// the job panel), Sketch, Stepper, and the custom fields (not Formula Dates,
// which calculate themselves).
import type { CustomFieldDef } from "../../services/custom-fields";
import { BUILTIN_EDITS } from "./jobs-editable";
import { JOB_FIELDS } from "./jobs-fields";

export interface GrantableField {
  key: string;
  label: string;
  group: "Job" | "Columns" | "Custom fields";
  /** Shown under the label in the checklist. */
  hint?: string;
  /** A $ figure — useless to a login that can't see $ (it's hidden from them). */
  money?: boolean;
}

const JOB: GrantableField[] = [
  { key: "status", label: JOB_FIELDS.status!.label, group: "Job", hint: "Runs the status automation (steps, holds)" },
  { key: "job", label: "Job name", group: "Job", hint: "Rename in the job panel" },
  { key: "stepper", label: "Stepper", group: "Job", hint: "Complete / reopen steps — pushed to BC" },
  { key: "sketch", label: "Sketch", group: "Job", hint: "Choose, upload or remove the sketch" },
];

/** Every grantable field, in checklist order. */
export function grantableFields(customDefs: readonly CustomFieldDef[]): GrantableField[] {
  const taken = new Set(JOB.map((f) => f.key));
  const columns: GrantableField[] = Object.keys(BUILTIN_EDITS)
    .filter((k) => !taken.has(k) && JOB_FIELDS[k])
    .map((k) => ({ key: k, label: JOB_FIELDS[k]!.label, group: "Columns" as const }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const custom: GrantableField[] = customDefs
    .filter((d) => d.type !== "formula-date")
    .map((d) => ({ key: d.key, label: d.label, group: "Custom fields" as const, money: d.type === "currency" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...JOB, ...columns, ...custom];
}
