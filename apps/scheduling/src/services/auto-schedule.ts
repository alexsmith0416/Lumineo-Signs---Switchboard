import { addDays, addHours, startOfDay } from "date-fns";
import { calculateEndTime } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import type {
  DepartmentId,
  Employee,
  ScheduleContext,
  ScheduleLine,
} from "../engine/types";
import type { MappedPlanningLine } from "./planning-line-mapping";

const DAY_START_HOUR = 8;

export interface ProposedSlot {
  lineNo: number;
  description: string;
  estimatedHours: number;
  departmentId: DepartmentId | null;
  employeeId: string | null;
  start: Date;
  end: Date;
  reason: string;
}

function startOfNextWorkday(d: Date): Date {
  const next = startOfDay(addDays(d, 1));
  return addHours(next, DAY_START_HOUR);
}

function pickEmployeeForDept(
  departmentId: DepartmentId,
  ctx: ScheduleContext,
  preferred: string | null,
): Employee | null {
  if (preferred) {
    const e = ctx.employees.get(preferred);
    if (e && e.departmentId === departmentId) return e;
  }
  const candidates = [...ctx.employees.values()].filter(
    (e) => e.departmentId === departmentId,
  );
  if (candidates.length === 0) return null;

  let best: Employee | null = null;
  let bestEnd = Infinity;
  for (const e of candidates) {
    const lastEnd = ctx.schedule
      .filter((l) => l.employeeId === e.id)
      .reduce((acc, l) => (l.endDateTime.getTime() > acc ? l.endDateTime.getTime() : acc), 0);
    if (lastEnd < bestEnd) {
      bestEnd = lastEnd;
      best = e;
    }
  }
  return best;
}

export interface ProposeOptions {
  earliestStart?: Date;
  preferredEmployeeIds?: Record<DepartmentId, string>;
}

export function proposeSchedule(
  job: { jobNo: string; customerName: string; promisedDate: Date | null },
  lines: MappedPlanningLine[],
  ctx: ScheduleContext,
  options: ProposeOptions = {},
): ProposedSlot[] {
  const slots: ProposedSlot[] = [];
  const earliestStart = options.earliestStart ?? startOfNextWorkday(new Date());

  const sorted = [...lines].sort((a, b) => {
    const da = a.departmentId ? ctx.departments.get(a.departmentId)?.flowOrder ?? 99 : 99;
    const db = b.departmentId ? ctx.departments.get(b.departmentId)?.flowOrder ?? 99 : 99;
    return da - db;
  });

  let prevEnd: Date | null = null;

  for (const line of sorted) {
    if (!line.departmentId) {
      slots.push({
        ...line,
        employeeId: null,
        start: earliestStart,
        end: earliestStart,
        reason: "No department mapped — manual assignment required",
      });
      continue;
    }
    const preferred = options.preferredEmployeeIds?.[line.departmentId] ?? null;
    const emp = pickEmployeeForDept(line.departmentId, ctx, preferred);
    if (!emp) {
      slots.push({
        ...line,
        employeeId: null,
        start: earliestStart,
        end: earliestStart,
        reason: "No employee in this department",
      });
      continue;
    }

    const desiredStart = prevEnd && prevEnd > earliestStart ? prevEnd : earliestStart;
    const lastEnd = ctx.schedule
      .filter((l) => l.employeeId === emp.id)
      .reduce<Date>(
        (acc, l) => (l.endDateTime > acc ? l.endDateTime : acc),
        new Date(0),
      );
    const actualStart = lastEnd > desiredStart ? lastEnd : desiredStart;

    const tempLine: ScheduleLine = {
      id: `proposed-${line.lineNo}`,
      jobNo: job.jobNo,
      customerName: job.customerName,
      planningLineDescription: line.description,
      startDateTime: actualStart,
      endDateTime: actualStart,
      estimatedHours: line.estimatedHours,
      overrideHours: null,
      employeeId: emp.id,
      departmentId: line.departmentId,
      customerDueDate: job.promisedDate,
      isLocked: false,
      jobSequence: line.lineNo,
    };
    const end = calculateEndTime(actualStart, effectiveHours(tempLine, emp), emp, ctx);

    slots.push({
      ...line,
      employeeId: emp.id,
      start: actualStart,
      end,
      reason: `Earliest legal slot for ${emp.name}`,
    });
    prevEnd = end;
  }

  return slots;
}
