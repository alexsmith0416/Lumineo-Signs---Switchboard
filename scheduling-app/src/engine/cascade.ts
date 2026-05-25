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

export function shiftTask(
  ctx: ScheduleContext,
  lineId: ScheduleLineId,
  newStart: Date,
  newEmployeeId: string | undefined,
  options: ShiftOptions = {},
): ShiftResult {
  const { cascade = true, previewOnly = false } = options;
  const work = previewOnly ? cloneContext(ctx) : cloneContext(ctx);

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

  target.startDateTime = new Date(newStart);
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

  const moved = new Set<string>([target.id]);
  if (!cascade) {
    return { context: work, moved: [...moved], conflicts: detectConflicts(work) };
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let changedThisPass = false;

    const byEmployee = new Map<string, ScheduleLine[]>();
    for (const l of work.schedule) {
      const arr = byEmployee.get(l.employeeId) ?? [];
      arr.push(l);
      byEmployee.set(l.employeeId, arr);
    }

    for (const queue of byEmployee.values()) {
      queue.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
      let lastEnd: Date | null = null;
      for (const task of queue) {
        if (lastEnd && task.startDateTime < lastEnd) {
          if (task.id !== target.id && !task.isLocked) {
            task.startDateTime = new Date(lastEnd);
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
        }
        if (!lastEnd || task.endDateTime > lastEnd) {
          lastEnd = task.endDateTime;
        }
      }
    }

    for (const candidate of work.schedule) {
      if (candidate.isLocked || candidate.id === target.id) continue;
      const candDept = work.departments.get(candidate.departmentId);
      if (!candDept) continue;

      const predecessors = work.schedule.filter((l) => {
        if (l.jobNo !== candidate.jobNo || l.id === candidate.id) return false;
        const d = work.departments.get(l.departmentId);
        return d ? d.flowOrder < candDept.flowOrder : false;
      });

      const latestPredEnd = predecessors.reduce<Date | null>((acc, p) => {
        return !acc || p.endDateTime > acc ? p.endDateTime : acc;
      }, null);

      if (latestPredEnd && candidate.startDateTime < latestPredEnd) {
        candidate.startDateTime = new Date(latestPredEnd);
        const cEmp = work.employees.get(candidate.employeeId);
        if (cEmp) {
          candidate.endDateTime = calculateEndTime(
            candidate.startDateTime,
            effectiveHours(candidate, cEmp),
            cEmp,
            work,
            candidate.id,
          );
        }
        moved.add(candidate.id);
        changedThisPass = true;
      }
    }

    if (!changedThisPass) break;

    if (i === MAX_ITERATIONS - 1) {
      // Cap hit — pathological dependency chain. Bail with the partial result
      // so the UI can still show what we have, but flag it loudly for ops.
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

export const _internal = { findEarliestEmployeeSlot };

// Re-exported for explicit name parity with the engine contracts document.
// (`findEarliestStart` is a job-flow predecessor lookup, distinct from the
// employee-queue slot finder above.)
