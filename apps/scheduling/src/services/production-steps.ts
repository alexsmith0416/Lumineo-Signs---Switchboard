import type { DepartmentStep } from "../components/DepartmentStepper";

/**
 * Canonical production-flow order + short node codes for the stepper. Names are
 * matched against planning-line-mapping's department names (Steel MFG, Routing,
 * Metal Fab, Paint, Vinyl / Graphics, Assembly). A job only shows the
 * departments its planning lines actually need, in this order.
 */
export const DEPT_FLOW: ReadonlyArray<{ match: RegExp; key: string; label: string }> = [
  { match: /steel/i, key: "S", label: "Steel MFG" },
  { match: /rout/i, key: "R", label: "Routing" },
  { match: /metal/i, key: "MF", label: "Metal Fab" },
  { match: /paint/i, key: "P", label: "Paint" },
  { match: /vinyl|graphic/i, key: "V", label: "Vinyl / Graphics" },
  { match: /assembl/i, key: "A", label: "Assembly" },
];

/** The final "Install" step, appended when a job has installation labor. */
export const INSTALL_STEP = { key: "I", label: "Install" } as const;

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

/** True when the BC planning lines put this step in the job by default. */
export function bcHasStep(key: string, deptNames: string[], hasInstall: boolean): boolean {
  if (key === INSTALL_STEP.key) return hasInstall;
  const def = DEPT_FLOW.find((d) => d.key === key);
  return !!def && deptNames.some((n) => def.match.test(n));
}

/** The step defs actually shown for a job, in flow order: the BC-derived set with
 *  editor overrides layered on (added / removed). */
export function includedStepDefs(
  deptNames: string[],
  hasInstall: boolean,
  overrides: Record<string, DeptOverride> = {},
): Array<{ key: string; label: string }> {
  return ALL_STEP_DEFS.filter((def) => {
    const ov = overrides[def.key];
    return ov ? ov.included : bcHasStep(def.key, deptNames, hasInstall);
  });
}

/** Candidate steps NOT currently in the stepper — the "add a department" pool. */
export function missingStepDefs(
  deptNames: string[],
  hasInstall: boolean,
  overrides: Record<string, DeptOverride> = {},
): Array<{ key: string; label: string }> {
  const included = new Set(includedStepDefs(deptNames, hasInstall, overrides).map((d) => d.key));
  return ALL_STEP_DEFS.filter((d) => !included.has(d.key));
}

/** Build ordered stepper steps from a job's production department names + whether
 *  it has install work + the completed step keys + editor overrides. `active` =
 *  the first not-completed step (default) PLUS any editor-marked-active step;
 *  everything else not-completed is `included`. */
export function buildDepartmentSteps(
  deptNames: string[],
  completed: Set<string>,
  hasInstall = false,
  overrides: Record<string, DeptOverride> = {},
): DepartmentStep[] {
  const defs = includedStepDefs(deptNames, hasInstall, overrides);
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
  if (key === INSTALL_STEP.key) return INSTALL_STEP.label;
  return DEPT_FLOW.find((d) => d.key === key)?.label ?? key;
}
