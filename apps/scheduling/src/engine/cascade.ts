import { calculateEndTime } from "./time-walker";
import { effectiveHours } from "./capacity";
import { detectConflicts } from "./conflicts";
import type {
  Conflict,
  ScheduleContext,
  ScheduleLine,
  ScheduleLineId,
  ShiftResult,
} from "./types";

// Cascade is iterative — each pass may push tasks that then conflict with
// other tasks, requiring another pass. 200 iterations is enough for any
// reasonable schedule (Lumineo's largest single-job chains are <10 lines).
// If we ever hit the cap we log and bail with what we've got rather than
// running unbounded.
const MAX_ITERATIONS = 200;

export function cloneContext(ctx: ScheduleContext): ScheduleContext {
  return {
    employees: new Map(ctx.employees),
    departments: new Map(ctx.departments),
    schedule: ctx.schedule.map((l) => ({ ...l })),
    workHours: ctx.workHours.map((w) => ({ ...w })),
    overtime: ctx.overtime.map((o) => ({ ...o })),
  };
}

export function findEarliestEmployeeSlot(
  employeeId: string,
  desiredStart: Date,
  ignoreLineId: string,
  schedule: ScheduleLine[],
): Date {
  const tasks = schedule
    .filter((l) => l.employeeId === employeeId && l.id !== ignoreLineId)
    .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());

  let cursor = new Date(desiredStart);
  for (const t of tasks) {
    if (cursor.getTime() < t.startDateTime.getTime() && cursor.getTime() + 1 <= t.startDateTime.getTime()) {
      break;
    }
    if (cursor.getTime() < t.endDateTime.getTime() && cursor.getTime() >= t.startDateTime.getTime() - 0) {
      cursor = new Date(t.endDateTime);
    }
  }
  return cursor;
}

export function findEarliestStart(
  line: ScheduleLine,
  ctx: ScheduleContext,
): Date {
  const job = ctx.schedule.filter((l) => l.jobNo === line.jobNo && l.id !== line.id);
  const myDept = ctx.departments.get(line.departmentId);
  if (!myDept) return line.startDateTime;

  let earliest = new Date(line.startDateTime);
  for (const other of job) {
    const otherDept = ctx.departments.get(other.departmentId);
    if (!otherDept) continue;
    if (otherDept.flowOrder < myDept.flowOrder && other.endDateTime > earliest) {
      earliest = new Date(other.endDateTime);
    }
  }

  return earliest;
}

export interface ShiftOptions {
  cascade?: boolean;
  previewOnly?: boolean;
}

/** Each task's "preferred" start = the user's last explicit position for
 *  it. Falls back to its current startDateTime when the field is unset
 *  (legacy data, freshly-loaded rows). The cascade uses this as a floor
 *  so a pushed task pulls back to where the user wanted it once the
 *  cause of the push moves back. */
function preferredOf(task: ScheduleLine): Date {
  return task.preferredStart || task.startDateTime;
}

function computeDepFloor(task: ScheduleLine, schedule: ScheduleLine[], ctx: ScheduleContext): Date | null {
  const myDept = ctx.departments.get(task.departmentId);
  if (!myDept) return null;
  let latest: Date | null = null;
  for (const other of schedule) {
    if (other.id === task.id || other.jobNo !== task.jobNo) continue;
    const od = ctx.departments.get(other.departmentId);
    if (!od || od.flowOrder >= myDept.flowOrder) continue;
    if (!latest || other.endDateTime > latest) latest = other.endDateTime;
  }
  return latest;
}

export function shiftTask(
  ctx: ScheduleContext,
  lineId: ScheduleLineId,
  newStart: Date,
  newEmployeeId: string | undefined,
  options: ShiftOptions = {},
): ShiftResult {
  const { cascade = true, previewOnly = false } = options;
  const work = cloneContext(ctx);
  void previewOnly; // both branches clone — `previewOnly` is informational

  const target = work.schedule.find((l) => l.id === lineId);
  if (!target) {
    return { context: work, moved: [], conflicts: [] };
  }
  if (target.isLocked) {
    return { context: work, moved: [], conflicts: detectConflicts(work) };
  }

  if (newEmployeeId && newEmployeeId !== target.employeeId) {
    target.employeeId = newEmployeeId;
    const emp = work.employees.get(newEmployeeId);
    if (emp) target.departmentId = emp.departmentId;
  }

  const origStart = target.startDateTime.getTime();
  target.startDateTime = new Date(newStart);
  // User explicitly placed the target here, so it becomes the new preferred.
  target.preferredStart = new Date(newStart);

  const emp = work.employees.get(target.employeeId);
  if (emp) {
    target.endDateTime = calculateEndTime(
      target.startDateTime,
      effectiveHours(target, emp),
      emp,
      work,
      target.id,
    );
  }

  const moved = new Set<string>();
  if (origStart !== target.startDateTime.getTime() || newEmployeeId) {
    moved.add(target.id);
  }

  if (!cascade) {
    return { context: work, moved: [...moved], conflicts: detectConflicts(work) };
  }

  // Bidirectional cascade. For every non-target non-locked task, place it
  // at max(preferred, depFloor, queueFloor). Iterate per-employee queues in
  // preferred-ascending order so earlier-preferred tasks anchor the queue.
  // Convergence: stop when a pass makes no changes.
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let changedThisPass = false;

    // Build employee queues sorted by preferred (then id for ties)
    const byEmployee = new Map<string, ScheduleLine[]>();
    for (const l of work.schedule) {
      const arr = byEmployee.get(l.employeeId) ?? [];
      arr.push(l);
      byEmployee.set(l.employeeId, arr);
    }

    for (const queue of byEmployee.values()) {
      queue.sort((a, b) => {
        const ap = preferredOf(a).getTime();
        const bp = preferredOf(b).getTime();
        if (ap !== bp) return ap - bp;
        return a.id.localeCompare(b.id);
      });

      let lastEnd: Date | null = null;
      for (const task of queue) {
        const isImmutable = task.id === target.id || task.isLocked;
        const preferred = preferredOf(task);
        const depFloor = computeDepFloor(task, work.schedule, work);

        // Candidate = max(preferred, lastEnd, depFloor). For immutable
        // tasks we don't move them, but they still contribute to lastEnd.
        let candidate = preferred;
        if (lastEnd && lastEnd > candidate) candidate = lastEnd;
        if (depFloor && depFloor > candidate) candidate = depFloor;

        if (!isImmutable && candidate.getTime() !== task.startDateTime.getTime()) {
          task.startDateTime = new Date(candidate);
          const tEmp = work.employees.get(task.employeeId);
          if (tEmp) {
            task.endDateTime = calculateEndTime(
              task.startDateTime,
              effectiveHours(task, tEmp),
              tEmp,
              work,
              task.id,
            );
          }
          moved.add(task.id);
          changedThisPass = true;
        }

        if (!lastEnd || task.endDateTime > lastEnd) lastEnd = task.endDateTime;
      }
    }

    if (!changedThisPass) break;

    if (i === MAX_ITERATIONS - 1) {
      if (typeof console !== "undefined") {
        console.warn(
          `[cascade] hit MAX_ITERATIONS (${MAX_ITERATIONS}) for shift of line ${lineId}. ` +
            `Schedule may not have fully converged. Returning partial result with ${moved.size} moved tasks.`,
        );
      }
    }
  }

  return {
    context: work,
    moved: [...moved],
    conflicts: detectConflicts(work),
  };
}

export function updateDuration(
  ctx: ScheduleContext,
  lineId: ScheduleLineId,
  overrideHours: number,
  cascade: boolean = true,
): ShiftResult {
  const work = cloneContext(ctx);
  const target = work.schedule.find((l) => l.id === lineId);
  if (!target) return { context: work, moved: [], conflicts: [] };

  target.overrideHours = overrideHours;
  const emp = work.employees.get(target.employeeId);
  if (emp) {
    target.endDateTime = calculateEndTime(
      target.startDateTime,
      effectiveHours(target, emp),
      emp,
      work,
      target.id,
    );
  }

  if (!cascade) {
    return { context: work, moved: [target.id], conflicts: detectConflicts(work) };
  }

  return shiftTask(work, lineId, target.startDateTime, undefined, {
    cascade: true,
  });
}

// A start-time delta under a minute is engine book-keeping (date-object
// churn, capacity round-trips), not a perceivable move.
const MEANINGFUL_DELTA_MS = 60_000;

export interface DiffShiftResult {
  /** The board after the change, with ONLY genuinely-affected tasks applied
   *  on top of the pre-change positions. Every unaffected task keeps exactly
   *  where it was — no churn snap. */
  committed: ScheduleContext;
  /** Tasks (excluding the target) whose start changes *because* of this
   *  change rather than as ambient engine churn. This is what the confirm
   *  dialog should show and the store should persist. */
  changed: ScheduleLine[];
  /** The target line in its committed position (null if it no longer exists). */
  target: ScheduleLine | null;
  conflicts: Conflict[];
}

/**
 * Compute the *isolated* effect of a change by differencing two cascades that
 * start from the SAME board: `move` (the real change) and `noop` (the same
 * board cascaded with the target held at its current position). `shiftTask`
 * always returns a fully-cascaded board and is not perfectly idempotent on
 * loaded data, so comparing a single cascade against the raw board blames the
 * change for ambient normalization — cross-job / cross-resource phantom
 * "downstream" moves. Differencing move-vs-noop cancels any churn that would
 * happen regardless of the target's destination, leaving only the moves the
 * change actually causes. The committed board then applies just those genuine
 * moves on top of the pre-change positions, so unaffected tasks never snap.
 */
function buildDiff(
  ctx: ScheduleContext,
  lineId: ScheduleLineId,
  move: ShiftResult,
  noop: ShiftResult,
): DiffShiftResult {
  const noopById = new Map(noop.context.schedule.map((l) => [l.id, l]));
  const movedById = new Map(move.context.schedule.map((l) => [l.id, l]));

  const changed: ScheduleLine[] = [];
  for (const m of move.context.schedule) {
    if (m.id === lineId) continue;
    const n = noopById.get(m.id);
    if (!n) continue;
    if (Math.abs(m.startDateTime.getTime() - n.startDateTime.getTime()) >= MEANINGFUL_DELTA_MS) {
      changed.push(m);
    }
  }

  const changedIds = new Set(changed.map((c) => c.id));
  const committedSchedule = ctx.schedule.map((orig) => {
    if (orig.id === lineId || changedIds.has(orig.id)) {
      return { ...(movedById.get(orig.id) ?? orig) };
    }
    return { ...orig };
  });
  const committed: ScheduleContext = { ...cloneContext(ctx), schedule: committedSchedule };
  return {
    committed,
    changed,
    target: committed.schedule.find((l) => l.id === lineId) ?? null,
    conflicts: detectConflicts(committed),
  };
}

/** Differential move — see {@link buildDiff}. */
export function diffShift(
  ctx: ScheduleContext,
  lineId: ScheduleLineId,
  newStart: Date,
  newEmployeeId: string | undefined,
  options: ShiftOptions = {},
): DiffShiftResult {
  const { cascade = true } = options;
  const target = ctx.schedule.find((l) => l.id === lineId);
  if (!target) {
    const work = cloneContext(ctx);
    return { committed: work, changed: [], target: null, conflicts: detectConflicts(work) };
  }
  const move = shiftTask(ctx, lineId, newStart, newEmployeeId, { cascade, previewOnly: true });
  if (!cascade) {
    return {
      committed: move.context,
      changed: [],
      target: move.context.schedule.find((l) => l.id === lineId) ?? null,
      conflicts: move.conflicts,
    };
  }
  const noop = shiftTask(ctx, lineId, target.startDateTime, undefined, { cascade, previewOnly: true });
  return buildDiff(ctx, lineId, move, noop);
}

/** Differential duration change — same isolation as {@link diffShift}. */
export function diffResize(
  ctx: ScheduleContext,
  lineId: ScheduleLineId,
  overrideHours: number,
  cascade: boolean = true,
): DiffShiftResult {
  const target = ctx.schedule.find((l) => l.id === lineId);
  if (!target) {
    const work = cloneContext(ctx);
    return { committed: work, changed: [], target: null, conflicts: detectConflicts(work) };
  }
  const move = updateDuration(ctx, lineId, overrideHours, cascade);
  if (!cascade) {
    return {
      committed: move.context,
      changed: [],
      target: move.context.schedule.find((l) => l.id === lineId) ?? null,
      conflicts: move.conflicts,
    };
  }
  // Baseline: cascade the unchanged board with the target held in place.
  const noop = shiftTask(ctx, lineId, target.startDateTime, undefined, { cascade, previewOnly: true });
  return buildDiff(ctx, lineId, move, noop);
}

export const _internal = { findEarliestEmployeeSlot };
