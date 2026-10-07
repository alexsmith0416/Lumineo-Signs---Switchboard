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
 * The job LIFECYCLE stages around the departments (decided Sep 29, 2026): the
 * production stepper runs New Order → Upcoming Mfg → Purchasing → the
 * departments → Ready for Install → Install → Complete-Need Paperwork →
 * Complete to Admin (the production team's last step — BC's job "complete"
 * fires here) → Complete Invoiced (Admin's step, the true end).
 * Every production job has them; Ready for Install only with install work.
 * A service-only job (BC Order Type SERVICE / SIGNCONT / MNTCCONT and no
 * production department) has none — it gets the Service stepper instead
 * (services/service-steps.ts).
 */
export const LIFECYCLE_BEFORE: ReadonlyArray<{ key: string; label: string }> = [
  { key: "NO", label: "New Order" },
  { key: "UM", label: "Upcoming Mfg" },
  { key: "PU", label: "Purchasing" },
];
export const READY_FOR_INSTALL = { key: "RI", label: "Ready for Install" } as const;
export const LIFECYCLE_AFTER: ReadonlyArray<{ key: string; label: string }> = [
  { key: "CP", label: "Complete-Need Paperwork" },
  { key: "CA", label: "Complete to Admin" },
  { key: "CI", label: "Complete Invoiced" },
];
const LIFECYCLE_KEYS: ReadonlySet<string> = new Set(
  [...LIFECYCLE_BEFORE, READY_FOR_INSTALL, ...LIFECYCLE_AFTER].map((d) => d.key),
);
/** A lifecycle stage (not a department, not Install)? */
export const isLifecycleKey = (key: string): boolean => LIFECYCLE_KEYS.has(key);
/** A production department (MC, S, R, MF, P, V, A, CR)? */
export const isDeptKey = (key: string): boolean => DEPT_FLOW.some((d) => d.key === key);
/** Complete to Admin — completing it completes the job in BC. */
export const COMPLETE_TO_ADMIN = "CA";

/** Every candidate production-stepper step in flow order — the pool an editor
 *  can add a missing step from. */
export const ALL_STEP_DEFS: ReadonlyArray<{ key: string; label: string }> = [
  ...LIFECYCLE_BEFORE,
  ...DEPT_FLOW.map((d) => ({ key: d.key, label: d.label })),
  READY_FOR_INSTALL,
  { key: INSTALL_STEP.key, label: INSTALL_STEP.label },
  ...LIFECYCLE_AFTER,
];

/** An editor's override for one department on one job (from crfdf_jobdeptoverride). */
export interface DeptOverride {
  /** Force the department into (true) or out of (false) the stepper. */
  included: boolean;
  /** Mark it as an additional active step (on top of the default first-incomplete). */
  active: boolean;
}

/** True when a job has this step by default: departments from its BC planning
 *  lines, Install from install labor, lifecycle stages on every production job
 *  (`service` = a service / contract order — with no department it's a
 *  service-only job and gets no lifecycle stages). */
export function bcHasStep(key: string, deptNames: string[], hasInstall: boolean, service = false): boolean {
  if (key === INSTALL_STEP.key) return hasInstall;
  if (isLifecycleKey(key)) {
    const productionJob = !service || deptNames.some((n) => DEPT_FLOW.some((d) => d.match.test(n)));
    return productionJob && (key !== READY_FOR_INSTALL.key || hasInstall);
  }
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
    return { key: d.key, label: d.label, state, ...(isLifecycleKey(d.key) ? { lifecycle: true } : {}) };
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
