import { addDays, startOfDay } from "date-fns";
import { effectiveHours, getDayCapacity, getHoursUsedOnDay } from "./capacity";
import type { Employee, ScheduleContext, ScheduleLine } from "./types";

const DAY_START_HOUR = 8;
const MAX_DAYS_LOOKAHEAD = 365;

export function calculateEndTime(
  start: Date,
  hoursNeeded: number,
  employee: Employee,
  ctx: ScheduleContext,
  ignoreLineId?: string,
): Date {
  if (hoursNeeded <= 0) return new Date(start);

  let remaining = hoursNeeded;
  let cursor = new Date(start);
  let dayCount = 0;

  while (remaining > 0 && dayCount < MAX_DAYS_LOOKAHEAD) {
    const dayCapacity = getDayCapacity(employee, cursor, ctx);
    if (dayCapacity <= 0) {
      cursor = startOfDay(addDays(cursor, 1));
      cursor.setHours(DAY_START_HOUR, 0, 0, 0);
      dayCount++;
      continue;
    }

    const used = getHoursUsedOnDay(employee.id, cursor, ctx.schedule, ignoreLineId);
    const free = Math.max(0, dayCapacity - used);

    if (free <= 0) {
      cursor = startOfDay(addDays(cursor, 1));
      cursor.setHours(DAY_START_HOUR, 0, 0, 0);
      dayCount++;
      continue;
    }

    if (remaining <= free) {
      const hoursToday = remaining;
      const endHour = cursor.getHours() + Math.floor(hoursToday);
      const endMinute = cursor.getMinutes() + Math.round((hoursToday % 1) * 60);
      const result = new Date(cursor);
      result.setHours(endHour, endMinute, 0, 0);
      return result;
    }

    remaining -= free;
    cursor = startOfDay(addDays(cursor, 1));
    cursor.setHours(DAY_START_HOUR, 0, 0, 0);
    dayCount++;
  }

  return cursor;
}

export function recalcEnd(
  line: ScheduleLine,
  employee: Employee,
  ctx: ScheduleContext,
): Date {
  return calculateEndTime(line.startDateTime, effectiveHours(line, employee), employee, ctx, line.id);
}
