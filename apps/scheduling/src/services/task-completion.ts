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
import { ALL_DONE } from "./status-rules";

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

/** What a tick did, as the Jobs → History columns show it. */
export interface TickOutcome {
  /** The department it completed ("Routing"). */
  department: string;
  /** The job's active step afterwards ("Metal Fab" / "All steps complete"; "" = unknown). */
  nextDept: string;
  statusFrom: string;
  /** "" = the status was left as it was. */
  statusTo: string;
}

/**
 * A tick's outcome by column. Ticks applied before Oct 6 only carry the
 * sentence in `result` ("Completed Routing (why) · status A → B"), so the
 * department and status are read back out of it; a missing "moved to" step is
 * the step whose flow stage is the status the job moved to (`stepFor`, from the
 * company flow — job-flow.ts stepForStatus).
 */
export function tickOutcome(
  t: TickOutcome & { result: string },
  stepFor: (status: string) => string | null,
): TickOutcome {
  let { department, nextDept, statusFrom, statusTo } = t;
  const result = t.result ?? "";
  if (!department) {
    const m =
      /^Completed the .+? stage of (.+?) — /.exec(result) ??
      /^Completed (.+?)(?: \(| · |$)/.exec(result) ??
      /^(.+?) was already complete/.exec(result);
    department = m?.[1]?.trim() ?? "";
  }
  if (!statusFrom) {
    const moved = / · status (.+?) → (.+)$/.exec(result);
    const left = / · status left as (.+)$/.exec(result);
    if (moved) {
      statusFrom = moved[1]!.trim();
      statusTo = moved[2]!.trim();
    } else if (left) {
      statusFrom = left[1]!.trim();
      statusTo = "";
    }
  }
  if (!nextDept && statusTo) {
    const key = stepFor(statusTo);
    if (key) nextDept = key === ALL_DONE ? "All steps complete" : stepLabel(key);
  }
  return { department, nextDept, statusFrom, statusTo };
}
