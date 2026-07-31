import { addDays, startOfDay } from "date-fns";
import { effectiveHours, getDayCapacity, getHoursUsedOnDay, isWeekend } from "./capacity";
import type { Employee, ScheduleContext, ScheduleLine } from "./types";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 16;
const MAX_DAYS_LOOKAHEAD = 365;

function rollToNextWorkday(cursor: Date): Date {
  const next = startOfDay(addDays(cursor, 1));
  next.setHours(DAY_START_HOUR, 0, 0, 0);
  return next;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function calculateEndTime(
  start: Date,
  hoursNeeded: number,
  employee: Employee,
  ctx: ScheduleContext,
  ignoreLineId?: string,
  /** When true, ignore other tasks' hours on each day — the task spans purely
   *  its own hours over the workday window (weekends still skipped). Used for
   *  MANUAL resize / end-set so the user can pin a duration even on a full day;
   *  the resulting overlap is surfaced as a conflict rather than pushing the end. */
  ignoreOccupancy = false,
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

    // The card's OWN start day always counts as a working day: the user put it
    // there on purpose. Without this a job placed on a Saturday has its hours
    // silently rolled to Monday (the card draws across the weekend but the end
    // date lands on Monday). Later days get no such pass — a Saturday job that
    // runs long resumes Monday rather than quietly eating Sunday.
    const dayCapacity = getDayCapacity(employee, cursor, ctx, {
      manual: sameCalendarDay(cursor, start),
    });
    if (dayCapacity <= 0) {
      cursor = rollToNextWorkday(cursor);
      dayCount++;
      continue;
    }

    const used = ignoreOccupancy
      ? 0
      : getHoursUsedOnDay(employee.id, cursor, ctx.schedule, ignoreLineId);
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

/** Advance a start time to the next valid working slot: snap up to the
 *  business-day start, and roll past end-of-day and non-working days (weekends /
 *  zero-capacity). Used to normalize a chained start so a card that would begin
 *  at end-of-day (e.g. 16:00) renders on the next working day, not the current. */
export function nextWorkStart(
  start: Date,
  employee: Employee,
  ctx: ScheduleContext,
): Date {
  let cursor = new Date(start);
  if (cursor.getHours() < DAY_START_HOUR) cursor.setHours(DAY_START_HOUR, 0, 0, 0);
  for (let i = 0; i < MAX_DAYS_LOOKAHEAD; i++) {
    const hoursOfDay = cursor.getHours() + cursor.getMinutes() / 60;
    if (hoursOfDay >= DAY_END_HOUR || getDayCapacity(employee, cursor, ctx) <= 0) {
      cursor = rollToNextWorkday(cursor);
      continue;
    }
    return cursor;
  }
  return cursor;
}

/**
 * The first slot an employee has FREE CAPACITY, at or after `from` — where an
 * auto-scheduled job should start. Walks working days: on the first day whose
 * used hours are below capacity, returns that day positioned right after the
 * used hours (so a new job fills a partial day, then bleeds into later days via
 * calculateEndTime). If every day up to `from`'s week is full, it lands on the
 * first day with room. Unlike a raw time-gap search this respects the 8h/day
 * (efficiency-scaled) capacity, so jobs append after existing work instead of
 * stacking onto the same morning.
 */
export function firstOpenSlot(
  from: Date,
  employee: Employee,
  ctx: ScheduleContext,
  ignoreLineId?: string,
): Date {
  let cursor = new Date(from);
  if (cursor.getHours() < DAY_START_HOUR) cursor.setHours(DAY_START_HOUR, 0, 0, 0);
  cursor.setMinutes(0, 0, 0);
  for (let i = 0; i < MAX_DAYS_LOOKAHEAD; i++) {
    // AUTO placement never chooses a weekend, even one the person is already
    // working: someone coming in on a Saturday is a deliberate call, not an
    // invitation for the scheduler to pack more onto it. (getDayCapacity opens
    // such a day for MANUAL placement — this guard deliberately ignores that.)
    if (isWeekend(cursor) && !employee.worksWeekends) {
      cursor = rollToNextWorkday(cursor);
      continue;
    }
    const cap = getDayCapacity(employee, cursor, ctx);
    if (cap <= 0) {
      cursor = rollToNextWorkday(cursor);
      continue;
    }
    const used = getHoursUsedOnDay(employee.id, cursor, ctx.schedule, ignoreLineId);
    // Where the day's committed work ends, in clock hours from 08:00. On the
    // first pass we honor the caller's start time-of-day if it's later.
    const usedEndHour = DAY_START_HOUR + used;
    const cursorHour = cursor.getHours() + cursor.getMinutes() / 60;
    const startHour = Math.max(usedEndHour, i === 0 ? cursorHour : DAY_START_HOUR);
    // A day is "open" only if there's real room left after existing work AND the
    // slot begins before the business-day close.
    if (cap - used >= 0.05 && startHour < DAY_END_HOUR - 0.05) {
      const res = new Date(cursor);
      res.setHours(Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
      return res;
    }
    cursor = rollToNextWorkday(cursor);
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
