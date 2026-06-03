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
  const key = dayKey(date);
  const override = ctx.workHours.find(
    (w) => w.employeeId === employee.id && w.date === key,
  );
  if (override) return override.hours;

  if (isWeekend(date) && !employee.worksWeekends) return 0;

  const ot = ctx.overtime
    .filter((o) => o.employeeId === employee.id && o.date === key)
    .reduce((sum, o) => sum + o.extraHours, 0);

  return employee.standardHoursPerDay + ot;
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

function effectiveHoursOnDay(line: ScheduleLine, _date: Date): number {
  return (line.overrideHours ?? line.estimatedHours);
}

export function effectiveHours(line: ScheduleLine, employee: Employee): number {
  const rate = employee.productivityRate === 0 ? 1 : employee.productivityRate;
  return (line.overrideHours ?? line.estimatedHours) / rate;
}
