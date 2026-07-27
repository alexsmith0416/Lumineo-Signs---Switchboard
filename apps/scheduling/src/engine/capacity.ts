import { format } from "date-fns";
import type { Employee, ScheduleContext, ScheduleLine } from "./types";

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function getDayCapacity(
  employee: Employee,
  date: Date,
  ctx: ScheduleContext,
): number {
  // Time-efficiency scales an employee's AVAILABLE hours: someone at 80%
  // efficiency has 0.8× their clock hours of usable capacity. (Rate 0 is
  // treated as 100% — a legacy/blank value, never "no capacity".)
  const rate = employee.productivityRate > 0 ? employee.productivityRate : 1;
  const key = dayKey(date);
  const override = ctx.workHours.find(
    (w) => w.employeeId === employee.id && w.date === key,
  );
  if (override) return override.hours * rate;

  if (isWeekend(date) && !employee.worksWeekends) return 0;

  const ot = ctx.overtime
    .filter((o) => o.employeeId === employee.id && o.date === key)
    .reduce((sum, o) => sum + o.extraHours, 0);

  return (employee.standardHoursPerDay + ot) * rate;
}

export function getHoursUsedOnDay(
  employeeId: string,
  date: Date,
  schedule: ScheduleLine[],
  ignoreLineId?: string,
): number {
  const key = dayKey(date);
  return schedule
    .filter(
      (line) =>
        line.employeeId === employeeId &&
        line.id !== ignoreLineId &&
        dayKey(line.startDateTime) <= key &&
        dayKey(line.endDateTime) >= key,
    )
    .reduce((sum, line) => sum + effectiveHoursOnDay(line, date), 0);
}

// Business day window — mirrors the walker in time-walker.ts, which only ever
// schedules work between 08:00 and 16:00.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 16;

function effectiveHoursOnDay(line: ScheduleLine, date: Date): number {
  const total = line.overrideHours ?? line.estimatedHours;
  // Single business-day task: all its hours land on that one day. Keeps the
  // common case exact (the getHoursUsedOnDay contract the tests pin).
  if (dayKey(line.startDateTime) === dayKey(line.endDateTime)) {
    return total;
  }
  // Multi-day task: charge only the business-hour overlap with THIS day's
  // 08:00–16:00 window. The old code charged every spanned day the task's
  // FULL hours, so a task settled to a day boundary (e.g. start 16:00) was
  // counted as consuming a whole day on a day it merely touches. That
  // over-count made calculateEndTime non-idempotent — re-running the cascade
  // re-pushed neighbours that never actually competed for capacity.
  const dayStart = new Date(date);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
  const from = Math.max(line.startDateTime.getTime(), dayStart.getTime());
  const to = Math.min(line.endDateTime.getTime(), dayEnd.getTime());
  return Math.max(0, (to - from) / 3_600_000);
}

// A card consumes its raw hours of capacity. Time-efficiency is applied on the
// CAPACITY side now (see getDayCapacity), so it must NOT be applied here too —
// the `employee` arg is kept for call-site compatibility.
export function effectiveHours(line: ScheduleLine, _employee: Employee): number {
  return line.overrideHours ?? line.estimatedHours;
}
