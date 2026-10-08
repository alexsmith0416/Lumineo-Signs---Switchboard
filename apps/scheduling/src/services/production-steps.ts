import type { DepartmentStep } from "../components/DepartmentStepper";

/**
 * Canonical production-flow order + short node codes for the stepper. Names are
 * matched against planning-line-mapping's department names (Steel MFG, Routing,
 * Metal Fab, Paint, Vinyl / Graphics, Assembly). A job only shows the
 * departments its planning lines actually need, in this order.
 *
 * Crating is added automatically when a planning line is crating labor
 * (planning-line-mapping `stepInfoFromLines`). Material Cut has no planning
 * line, so an editor adds it from the stepper's Edit (or the Airtable import did).
 */
export const DEPT_FLOW: ReadonlyArray<{ match: RegExp; key: string; label: string }> = [
  { match: /material cut|substrate/i, key: "MC", label: "Material Cut" },
  { match: /steel/i, key: "S", label: "Steel MFG" },
  { match: /rout/i, key: "R", label: "Routing" },
  { match: /metal/i, key: "MF", label: "Metal Fab" },
  { match: /paint/i, key: "P", label: "Paint" },
  { match: /vinyl|graphic/i, key: "V", label: "Vinyl / Graphics" },
  { match: /assembl/i, key: "A", label: "Assembly" },
  { match: /crat/i, key: "CR", label: "Crating" },
];

/** The final "Install" step, appended when a job has installation labor. */
export const INSTALL_STEP = { key: "I", label: "Install" } as const;

/**
 * The stepper is the job's DEPARTMENTS + Install only (Alex, Oct 7 — the
 * lifecycle stages tried earlier that day are gone from it). The lifecycle —
 * New Order … Complete Invoiced — lives in the Current Status, and BC's
 * lifecycle steps follow the status (services/status-lifecycle.ts).
 * Completion rows for the old lifecycle keys (NO, UM, RP, PU, RI, CP, CA, CI)
 * are simply ignored.
 */

/** A production department (MC, S, R, MF, P, V, A, CR)? */
export const isDeptKey = (key: string): boolean => DEPT_FLOW.some((d) => d.key === key);

/** Every candidate step in flow order (production departments + Install last) —
 *  the pool an editor can add a missing department from. */
export const ALL_STEP_DEFS: ReadonlyArray<{ key: string; label: string }> = [
  ...DEPT_FLOW.map((d) => ({ key: d.key, label: d.label })),
  { key: INSTALL_STEP.key, label: INSTALL_STEP.label },
];

/** An editor's override for one department on one job (from crfdf_jobdeptoverride). */
export interface DeptOverride {
  /** Force the department into (true) or out of (false) the stepper. */
  included: boolean;
  /** Mark it as an additional active step (on top of the default first-incomplete). */
  active: boolean;
}

/** True when the BC planning lines put this step in the job by default. (`service`
 *  is kept for callers; it no longer changes anything here.) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function bcHasStep(key: string, deptNames: string[], hasInstall: boolean, _service = false): boolean {
  if (key === INSTALL_STEP.key) return hasInstall;
  const def = DEPT_FLOW.find((d) => d.key === key);
  return !!def && deptNames.some((n) => def.match.test(n));
}

/** The step defs actually shown for a job, in flow order: the BC-derived set with
 *  editor overrides layered on (added / removed). `order` (the job's flow —
 *  services/job-flow.ts) reorders them; steps it doesn't name keep their
 *  default place relative to the rest. */
export function includedStepDefs(
  deptNames: string[],
  hasInstall: boolean,
  overrides: Record<string, DeptOverride> = {},
  order?: readonly string[],
  service = false,
): Array<{ key: string; label: string }> {
  const defs = ALL_STEP_DEFS.filter((def) => {
    const ov = overrides[def.key];
    return ov ? ov.included : bcHasStep(def.key, deptNames, hasInstall, service);
  });
  return order?.length ? orderSteps(defs, order) : defs;
}

/** Steps in `order`; any it doesn't name go right after the step that precedes
 *  them in the default flow (or first, when none does). */
export function orderSteps<T extends { key: string }>(defs: readonly T[], order: readonly string[]): T[] {
  const named = order.map((k) => defs.find((d) => d.key === k)).filter((d): d is T => !!d);
  const flow = ALL_STEP_DEFS.map((d) => d.key);
  const out = [...named];
  for (const d of defs) {
    if (out.includes(d)) continue;
    const before = flow.slice(0, flow.indexOf(d.key));
    let at = 0;
    for (let i = out.length - 1; i >= 0; i--) {
      if (before.includes(out[i]!.key)) {
        at = i + 1;
        break;
      }
    }
    out.splice(at, 0, d);
  }
  return out;
}

/** Candidate steps NOT currently in the stepper — the "add a department" pool. */
export function missingStepDefs(
  deptNames: string[],
  hasInstall: boolean,
  overrides: Record<string, DeptOverride> = {},
  service = false,
): Array<{ key: string; label: string }> {
  const included = new Set(includedStepDefs(deptNames, hasInstall, overrides, undefined, service).map((d) => d.key));
  return ALL_STEP_DEFS.filter((d) => !included.has(d.key));
}

/** Build ordered stepper steps from a job's production department names + whether
 *  it has install work + the completed step keys + editor overrides, in the
 *  job's flow order (`order`). `active` =
 *  the first not-completed step (default) PLUS any editor-marked-active step;
 *  everything else not-completed is `included`. */
export function buildDepartmentSteps(
  deptNames: string[],
  completed: Set<string>,
  hasInstall = false,
  overrides: Record<string, DeptOverride> = {},
  order?: readonly string[],
  service = false,
): DepartmentStep[] {
  const defs = includedStepDefs(deptNames, hasInstall, overrides, order, service);
  // Default active = the first step in flow order that isn't completed.
  const firstActiveKey = defs.find((d) => !completed.has(d.key))?.key;
  return defs.map((d) => {
    let state: DepartmentStep["state"] = "included";
    if (completed.has(d.key)) state = "completed";
    else if (d.key === firstActiveKey || overrides[d.key]?.active) state = "active";
    return { key: d.key, label: d.label, state };
  });
}

/** The stepper department key for a department name (for completion writes). */
export function deptKeyForName(name: string | null | undefined): string | null {
  if (!name) return null;
  return DEPT_FLOW.find((d) => d.match.test(name))?.key ?? null;
}

/** The stepper step a card completes: install cards complete the Install step;
 *  production cards complete their department. */
export function cardStepKey(
  boardKind: string,
  deptName: string | null | undefined,
): string | null {
  if (boardKind === "installation") return INSTALL_STEP.key;
  return deptKeyForName(deptName);
}

/** Label for a step key (for the card "Completed" button + who/when line). */
export function stepLabel(key: string): string {
  return ALL_STEP_DEFS.find((d) => d.key === key)?.label ?? SERVICE_LABELS[key] ?? key;
}

// Service stepper labels (services/service-steps.ts owns the steps; kept here
// so stepLabel — History, completion stamps — names them too without a cycle).
const SERVICE_LABELS: Readonly<Record<string, string>> = {
  SU: "Survey",
  SE: "Service",
  SA: "Complete to Admin (service)",
  SI: "Complete Invoiced (service)",
};
