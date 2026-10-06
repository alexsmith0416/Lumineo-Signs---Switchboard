/**
 * Shop-floor "Task complete" ticks → the stepper department they complete (pure).
 *
 * A tick (BC table "LUM Task Completion", synced to crfdf_taskcompletion)
 * names the EMPLOYEE, the job and the job task. The job task's planning lines
 * name LABOR CATEGORIES (2010 Metal Fab, 2030 Paint…), which map to stepper
 * departments the same way the stepper itself is built. So:
 *
 *  1. the departments of that task's planning lines — if exactly one, it;
 *  2. several (a task covering more than one department): the employee's own
 *     department if it's one of them, else the first of them in flow order
 *     that isn't complete yet;
 *  3. none (no lines on the task): the employee's department, else the task's
 *     description ("Paint", "Metal Fab"…).
 *
 * Install labor lines map to the Install step.
 */
import { departmentNameForLine, isInstallResource, isProductionResource } from "./planning-line-mapping";
import { ALL_STEP_DEFS, INSTALL_STEP, deptKeyForName, stepLabel } from "./production-steps";

export interface TaskLine {
  resourceNo: string;
  description: string;
}

export interface CompletionInput {
  /** The job's planning lines on the ticked job task. */
  taskLines: readonly TaskLine[];
  /** The ticking employee's roster department name ("" = unknown). */
  employeeDept: string;
  /** BC job task description ("" = none). */
  taskDescription: string;
  /** Step keys already complete on the job. */
  completed: ReadonlySet<string>;
}

export type DeptPick = { key: string; why: string } | { key: null; why: string };

const FLOW_ORDER = ALL_STEP_DEFS.map((d) => d.key);
const byFlow = (a: string, b: string) => FLOW_ORDER.indexOf(a) - FLOW_ORDER.indexOf(b);

function lineKey(l: TaskLine): string | null {
  if (!isProductionResource(l.resourceNo) && isInstallResource(l.resourceNo)) return INSTALL_STEP.key;
  return deptKeyForName(departmentNameForLine(l.resourceNo, l.description));
}

export function deptForCompletion(c: CompletionInput): DeptPick {
  const keys = [...new Set(c.taskLines.map(lineKey).filter((k): k is string => !!k))].sort(byFlow);
  const own = deptKeyForName(c.employeeDept);
  if (keys.length === 1) return { key: keys[0]!, why: "the task's planning lines" };
  if (keys.length > 1) {
    if (own && keys.includes(own)) return { key: own, why: "the employee's department (task covers several)" };
    const open = keys.find((k) => !c.completed.has(k));
    return open
      ? { key: open, why: `the task's first open department (covers ${keys.map(stepLabel).join(", ")})` }
      : { key: keys[0]!, why: "the task's planning lines (all already complete)" };
  }
  if (own) return { key: own, why: "the employee's department (no planning lines on the task)" };
  const fromTask = deptKeyForName(c.taskDescription);
  if (fromTask) return { key: fromTask, why: "the task's description" };
  return { key: null, why: "couldn't tell which department this task is" };
}
