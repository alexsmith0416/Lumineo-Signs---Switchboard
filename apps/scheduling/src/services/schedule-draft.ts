/**
 * Places an unscheduled "draft" job card onto the board — the single scheduling
 * step shared by the unified Add flow (and, later, batch scheduling / the queue).
 *
 * Three cases:
 *  - **Schedule** (employee + start both chosen): place it exactly there.
 *  - **Auto-schedule, employee chosen, no start**: put it on that employee's
 *    NEXT open day.
 *  - **Auto-schedule, no employee**: pick the least-loaded person in the task's
 *    department and place it on their next open slot (via proposeSchedule).
 *
 * Returns a fully-placed ScheduleLine (fresh id, employee, dept, start, end) or
 * null if nothing could be resolved. The caller persists it via addScheduleLine.
 */
import { proposeSchedule } from "./auto-schedule";
import type { MappedPlanningLine } from "./planning-line-mapping";
import { calculateEndTime, firstOpenSlot } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import type { ScheduleContext, ScheduleLine } from "../engine/types";

const DAY_START_HOUR = 8;

/** Today (or `from`) snapped to this morning's 08:00 — the desired earliest start. */
function morning(from?: Date): Date {
  const d = from ? new Date(from) : new Date();
  if (d.getHours() < DAY_START_HOUR) d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d;
}

export interface PlaceDraftInput {
  /** The unscheduled card: jobNo, customer, task text, hours, dept hint, etc. */
  draft: ScheduleLine;
  /** Chosen employee, or null to auto-pick. */
  employeeId: string | null;
  /** Chosen start day, or null to auto-find the next open day. */
  start: Date | null;
  ctx: ScheduleContext;
  /** Installation: a placed card completes on its scheduled DAY regardless of
   *  hours — clamp the end to the start's calendar day so it never bleeds into
   *  the next day. (Manual drag-resize can still span it afterwards.) */
  singleDay?: boolean;
  /** Auto-schedule floor: don't place before this date (search for the first
   *  open slot from here forward). Used to schedule a batch into a future week.
   *  Ignored when an explicit `start` is given. */
  earliestStart?: Date | null;
}

const DAY_END_HOUR = 16;
function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function placeDraft({ draft, employeeId, start, ctx, singleDay, earliestStart }: PlaceDraftInput): ScheduleLine | null {
  const id = `line-${draft.jobNo || "job"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  // Floor for auto-search: the chosen batch "schedule from" date, else today.
  const autoFrom = morning(earliestStart ?? undefined);

  const finalize = (empId: string, deptId: string, s: Date): ScheduleLine | null => {
    const emp = ctx.employees.get(empId);
    if (!emp) return null;
    const line: ScheduleLine = { ...draft, id, employeeId: empId, departmentId: deptId, startDateTime: s };
    let end = calculateEndTime(s, effectiveHours(line, emp), emp, ctx, id);
    // Installation completes its scheduled day — keep the card on one day even if
    // its hours would otherwise spill into the next.
    if (singleDay && !sameCalendarDay(end, s)) {
      end = new Date(s);
      end.setHours(DAY_END_HOUR, 0, 0, 0);
    }
    return { ...line, endDateTime: end, preferredStart: s };
  };

  // Case A — explicit employee + start.
  if (employeeId && start) {
    const emp = ctx.employees.get(employeeId);
    if (!emp) return null;
    return finalize(employeeId, emp.departmentId, morning(start));
  }

  // Case B — employee chosen, no start: their FIRST OPEN slot (fills the first
  // day under capacity, then bleeds into later days). Appends after existing
  // work rather than stacking onto the same morning.
  if (employeeId) {
    const emp = ctx.employees.get(employeeId);
    if (!emp) return null;
    return finalize(employeeId, emp.departmentId, firstOpenSlot(start ? morning(start) : autoFrom, emp, ctx, id));
  }

  // Case C — no employee: least-loaded person in the task's department.
  const mapped: MappedPlanningLine = {
    lineNo: draft.jobSequence || 0,
    description: draft.planningLineDescription,
    estimatedHours: draft.estimatedHours,
    departmentId: draft.departmentId || null,
  };
  const slots = proposeSchedule(
    { jobNo: draft.jobNo, customerName: draft.customerName, promisedDate: draft.customerDueDate },
    [mapped],
    ctx,
    { earliestStart: start ? morning(start) : autoFrom },
  );
  const slot = slots.find((s) => s.employeeId);
  if (slot?.employeeId) {
    const emp = ctx.employees.get(slot.employeeId);
    const deptId = slot.departmentId ?? emp?.departmentId ?? draft.departmentId;
    // proposeSchedule picked the least-loaded person; place at THAT person's
    // first open slot so the card appends after their existing work.
    const s = emp ? firstOpenSlot(start ? morning(start) : autoFrom, emp, ctx, id) : slot.start;
    return finalize(slot.employeeId, deptId, s);
  }

  // Fallback — no one in the department (or unmapped): first available person.
  const fallback =
    [...ctx.employees.values()].find((e) => !draft.departmentId || e.departmentId === draft.departmentId) ??
    [...ctx.employees.values()][0];
  if (!fallback) return null;
  return finalize(fallback.id, fallback.departmentId, firstOpenSlot(start ? morning(start) : autoFrom, fallback, ctx, id));
}
