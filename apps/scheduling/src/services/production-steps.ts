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

/** Build ordered stepper steps from a job's production department names + whether
 *  it has install work, plus the set of completed step keys. `active` = the first
 *  needed step that isn't completed; everything after it is `included`. */
export function buildDepartmentSteps(
  deptNames: string[],
  completed: Set<string>,
  hasInstall = false,
): DepartmentStep[] {
  const needed = DEPT_FLOW.filter((d) => deptNames.some((n) => d.match.test(n)));
  const defs = hasInstall
    ? [...needed.map((d) => ({ key: d.key, label: d.label })), { key: INSTALL_STEP.key, label: INSTALL_STEP.label }]
    : needed.map((d) => ({ key: d.key, label: d.label }));
  let activeAssigned = false;
  return defs.map((d) => {
    let state: DepartmentStep["state"] = "included";
    if (completed.has(d.key)) {
      state = "completed";
    } else if (!activeAssigned) {
      state = "active";
      activeAssigned = true;
    }
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
