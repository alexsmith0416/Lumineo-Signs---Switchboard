import { calculateEndTime } from "./time-walker";
import { effectiveHours } from "./capacity";
import { detectConflicts } from "./conflicts";
import type {
  ScheduleContext,
  ScheduleLine,
  ScheduleLineId,
  ShiftResult,
} from "./types";

// Safety cap on BFS push propagation iterations. Realistic Lumineo schedules
// have a few hundred lines per region; the chain length for a single move
// should never come close to this.
const MAX_ITERATIONS = 1000;

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
 *  it. Falls back to its current startDateTime when the field is unset. The
 *  cascade uses this as the pull-back floor — once whatever caused a task
 *  to be pushed moves out of the way, the task returns to its preferred. */
function preferredOf(task: ScheduleLine): Date {
  return task.preferredStart || task.startDateTime;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function recomputeEnd(line: ScheduleLine, ctx: ScheduleContext): Date {
  const emp = ctx.employees.get(line.employeeId);
  if (!emp) return line.endDateTime;
  return calculateEndTime(
    line.startDateTime,
    effectiveHours(line, emp),
    emp,
    ctx,
    line.id,
  );
}

/** Forward BFS push: starting from the just-moved target, push any task
 *  that the target (or transitively pushed task) now collides with — but
 *  ONLY for the two relationships the user reasons about:
 *    (a) same-employee overlap with the pusher's new range, or
 *    (b) same-job task in a downstream department whose start falls
 *        before the pusher's new end (dept-flow violation introduced by
 *        the move).
 *  Crucially, pre-existing violations involving tasks unrelated to the
 *  target are left alone — the user's mental model is that one drag
 *  should only ripple to things directly downstream of it. */
function pushPropagate(work: ScheduleContext, target: ScheduleLine, moved: Set<string>): void {
  const stack: ScheduleLine[] = [target];
  let safety = 0;
  while (stack.length > 0 && safety < MAX_ITERATIONS) {
    safety++;
    const pusher = stack.pop()!;
    const pusherDept = work.departments.get(pusher.departmentId);

    for (const other of work.schedule) {
      if (other.id === pusher.id || other.isLocked) continue;

      let mustStartAt: Date | null = null;

      // (a) Same employee overlap
      if (other.employeeId === pusher.employeeId) {
        if (rangesOverlap(pusher.startDateTime, pusher.endDateTime, other.startDateTime, other.endDateTime)) {
          mustStartAt = new Date(pusher.endDateTime);
        }
      }

      // (b) Same-job downstream dep-flow
      if (other.jobNo && other.jobNo === pusher.jobNo && pusherDept) {
        const otherDept = work.departments.get(other.departmentId);
        if (otherDept && otherDept.flowOrder > pusherDept.flowOrder) {
          if (other.startDateTime.getTime() < pusher.endDateTime.getTime()) {
            const cand = new Date(pusher.endDateTime);
            if (!mustStartAt || cand.getTime() > mustStartAt.getTime()) {
              mustStartAt = cand;
            }
          }
        }
      }

      if (mustStartAt && mustStartAt.getTime() > other.startDateTime.getTime()) {
        other.startDateTime = mustStartAt;
        other.endDateTime = recomputeEnd(other, work);
        moved.add(other.id);
        stack.push(other);
      }
    }
  }
  if (safety >= MAX_ITERATIONS && typeof console !== "undefined") {
    console.warn(`[cascade] push propagation hit MAX_ITERATIONS (${MAX_ITERATIONS}); returning partial result`);
  }
}

/** Pull-back: any task whose current start is later than its preferred
 *  is a candidate to return — but only if the slot at its preferred is
 *  actually free now (no same-employee overlap, no same-job upstream
 *  ending later). Processed in preferred-ASC order so earlier tasks
 *  settle first. */
function pullBack(work: ScheduleContext, moved: Set<string>): void {
  const candidates = work.schedule
    .filter(
      (t) =>
        !t.isLocked &&
        t.preferredStart instanceof Date &&
        t.startDateTime.getTime() > t.preferredStart.getTime(),
    )
    .sort((a, b) => preferredOf(a).getTime() - preferredOf(b).getTime());

  for (const task of candidates) {
    const preferred = preferredOf(task);

    // depFloor against current schedule (after pushes)
    let earliest = new Date(preferred);
    const myDept = work.departments.get(task.departmentId);
    if (myDept) {
      for (const other of work.schedule) {
        if (other.id === task.id || other.jobNo !== task.jobNo || !task.jobNo) continue;
        const od = work.departments.get(other.departmentId);
        if (!od || od.flowOrder >= myDept.flowOrder) continue;
        if (other.endDateTime.getTime() > earliest.getTime()) earliest = new Date(other.endDateTime);
      }
    }

    if (earliest.getTime() >= task.startDateTime.getTime()) continue;

    // Build a hypothetical placement and check same-employee overlap
    const emp = work.employees.get(task.employeeId);
    if (!emp) continue;
    const candidateLine: ScheduleLine = { ...task, startDateTime: earliest };
    const candidateEnd = recomputeEnd(candidateLine, work);

    let conflicts = false;
    for (const other of work.schedule) {
      if (other.id === task.id || other.employeeId !== task.employeeId) continue;
      if (rangesOverlap(earliest, candidateEnd, other.startDateTime, other.endDateTime)) {
        conflicts = true;
        break;
      }
    }
    if (conflicts) continue;

    task.startDateTime = earliest;
    task.endDateTime = candidateEnd;
    moved.add(task.id);
  }
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
  void previewOnly;

  const target = work.schedule.find((l) => l.id === lineId);
  if (!target) {
    return { context: work, moved: [], conflicts: [] };
  }
  if (target.isLocked) {
    return { context: work, moved: [], conflicts: detectConflicts(work) };
  }

  const origStart = target.startDateTime.getTime();

  if (newEmployeeId && newEmployeeId !== target.employeeId) {
    target.employeeId = newEmployeeId;
    const emp = work.employees.get(newEmployeeId);
    if (emp) target.departmentId = emp.departmentId;
  }

  target.startDateTime = new Date(newStart);
  // User explicitly placed the target here, so it becomes the new preferred.
  target.preferredStart = new Date(newStart);
  target.endDateTime = recomputeEnd(target, work);

  const moved = new Set<string>();
  const targetActuallyMoved = origStart !== target.startDateTime.getTime() || !!newEmployeeId;
  if (targetActuallyMoved) {
    moved.add(target.id);
  }

  if (!cascade || !targetActuallyMoved) {
    return { context: work, moved: [...moved], conflicts: detectConflicts(work) };
  }

  pushPropagate(work, target, moved);
  pullBack(work, moved);

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
  target.endDateTime = recomputeEnd(target, work);

  const moved = new Set<string>([target.id]);
  if (!cascade) {
    return { context: work, moved: [...moved], conflicts: detectConflicts(work) };
  }

  // Resize keeps the start fixed but extends the end, so we run push
  // propagation directly from the resized target — going through
  // shiftTask's no-op guard would skip cascade since the start didn't move.
  pushPropagate(work, target, moved);
  pullBack(work, moved);

  return { context: work, moved: [...moved], conflicts: detectConflicts(work) };
}

export const _internal = { findEarliestEmployeeSlot };
