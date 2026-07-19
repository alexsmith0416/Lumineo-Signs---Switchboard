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

/** Build ordered stepper steps from a job's production department names and the
 *  set of completed department keys. `active` = the first needed department that
 *  isn't completed; everything after it is `included`. */
export function buildDepartmentSteps(deptNames: string[], completed: Set<string>): DepartmentStep[] {
  const needed = DEPT_FLOW.filter((d) => deptNames.some((n) => d.match.test(n)));
  let activeAssigned = false;
  return needed.map((d) => {
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
