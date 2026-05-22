import { addDays, startOfDay } from "date-fns";
import { effectiveHours, getDayCapacity, getHoursUsedOnDay } from "./capacity";
import type { Employee, ScheduleContext, ScheduleLine } from "./types";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 16;
const MAX_DAYS_LOOKAHEAD = 365;

function rollToNextWorkday(cursor: Date): Date {
  const next = startOfDay(addDays(cursor, 1));
  next.setHours(DAY_START_HOUR, 0, 0, 0);
  return next;
}

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

  // Snap a pre-shift-start cursor up to the business-day start.
  if (cursor.getHours() < DAY_START_HOUR) {
    cursor.setHours(DAY_START_HOUR, 0, 0, 0);
  }

  while (remaining > 0 && dayCount < MAX_DAYS_LOOKAHEAD) {
    const hoursOfDay = cursor.getHours() + cursor.getMinutes() / 60;
    if (hoursOfDay >= DAY_END_HOUR) {
      cursor = rollToNextWorkday(cursor);
      dayCount++;
      continue;
    }

    const dayCapacity = getDayCapacity(employee, cursor, ctx);
    if (dayCapacity <= 0) {
      cursor = rollToNextWorkday(cursor);
      dayCount++;
      continue;
    }

    const used = getHoursUsedOnDay(employee.id, cursor, ctx.schedule, ignoreLineId);
    const freeCapacity = Math.max(0, dayCapacity - used);
    const hoursUntilDayEnd = DAY_END_HOUR - hoursOfDay;
    const available = Math.min(freeCapacity, hoursUntilDayEnd);

    if (available <= 0) {
      cursor = rollToNextWorkday(cursor);
      dayCount++;
      continue;
    }

    if (remaining <= available) {
      const endHours = hoursOfDay + remaining;
      const endHour = Math.floor(endHours);
      const endMinute = Math.round((endHours - endHour) * 60);
      const result = new Date(cursor);
      result.setHours(endHour, endMinute, 0, 0);
      return result;
    }

    remaining -= available;
    cursor = rollToNextWorkday(cursor);
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
