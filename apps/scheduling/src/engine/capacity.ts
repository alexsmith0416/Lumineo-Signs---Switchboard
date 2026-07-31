import { addDays, format } from "date-fns";
import type { Employee, ScheduleContext, ScheduleLine } from "./types";

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// A "block-out" card (PTO / OFF / Holiday / Maintenance) removes a person's
// availability for every day it covers. It is a custom card that is NOT a group
// container ("grp:v1:") or a shipment load — those keep normal hours-based
// counting. Blocking a huge per-day figure makes the day unavailable to the
// capacity walker regardless of the day's (efficiency-scaled) capacity.
const BLOCKOUT_PER_DAY = 1e6;
function isBlockoutCard(line: ScheduleLine): boolean {
  return (
    !!line.isCustom &&
    !line.shipmentLoadId &&
    !line.planningLineDescription?.startsWith("grp:v1:")
  );
}
/** The last calendar day a card occupies for CAPACITY — its real end, extended
 *  by a block-out card's visual span (a PTO card stretched across the week via
 *  spanDays must block all those days, not just its hours-derived end). */
function coverageEndKey(line: ScheduleLine): string {
  let endKey = dayKey(line.endDateTime);
  if (isBlockoutCard(line) && line.spanDays && line.spanDays > 1) {
    const spanEnd = dayKey(addDays(line.startDateTime, line.spanDays - 1));
    if (spanEnd > endKey) endKey = spanEnd;
  }
  return endKey;
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * True when someone has deliberately put work on this day — i.e. a card that
 * STARTS here. This is what turns a weekend into a working day: the schedule
 * itself records the decision, so it survives a reload with no extra column.
 *
 * A block-out card (PTO / Holiday) never opens a day — the whole point of one
 * is to take the day away.
 */
export function hasManualWorkOn(
  employeeId: string,
  date: Date,
  schedule: ScheduleLine[],
): boolean {
  const key = dayKey(date);
  return schedule.some(
    (l) => l.employeeId === employeeId && !isBlockoutCard(l) && dayKey(l.startDateTime) === key,
  );
}

export interface DayCapacityOptions {
  /** Force the day to count as a working day even if it's a weekend this person
   *  doesn't normally work. Set by the walker for a card's OWN start day, which
   *  is manual by definition and may not be in `ctx.schedule` yet (a draft being
   *  placed, or a live preview). */
  manual?: boolean;
}

export function getDayCapacity(
  employee: Employee,
  date: Date,
  ctx: ScheduleContext,
  opts?: DayCapacityOptions,
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

  // Weekends are off by default — AUTO placement must never choose one (that's
  // enforced in firstOpenSlot, which ignores the manual escape below). But a
  // weekend day the user has explicitly dropped a card on IS a working day:
  // otherwise the card's hours silently roll to Monday and the readouts show
  // "4h of 0h". Scanning the schedule is the last check so it only ever runs
  // for a weekend day of someone who doesn't normally work weekends.
  if (
    isWeekend(date) &&
    !employee.worksWeekends &&
    !opts?.manual &&
    !hasManualWorkOn(employee.id, date, ctx.schedule)
  ) {
    return 0;
  }

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
        coverageEndKey(line) >= key,
    )
    .reduce((sum, line) => sum + effectiveHoursOnDay(line, date), 0);
}

// Business day window — mirrors the walker in time-walker.ts, which only ever
// schedules work between 08:00 and 16:00.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 16;

function effectiveHoursOnDay(line: ScheduleLine, date: Date): number {
  // A block-out card (PTO/OFF/holiday) makes each day it covers unavailable.
  if (isBlockoutCard(line)) return BLOCKOUT_PER_DAY;
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

export interface DayLoad {
  /** Real job hours scheduled on the day (excludes block-out cards). */
  scheduled: number;
  /** The day's available capacity (efficiency-scaled; 0 on a non-working day). */
  capacity: number;
  /** True when a PTO / holiday / block-out card covers the day. */
  blocked: boolean;
  /** The block-out card's title (jobNo), if any — e.g. "PTO". */
  blockLabel?: string;
}

/** Per-employee, per-day load for the hover readout: real scheduled job hours,
 *  the day's capacity, and whether a block-out (PTO/holiday) covers it. */
export function dayLoad(employee: Employee, date: Date, ctx: ScheduleContext): DayLoad {
  const key = dayKey(date);
  let scheduled = 0;
  let blocked = false;
  let blockLabel: string | undefined;
  for (const line of ctx.schedule) {
    if (line.employeeId !== employee.id) continue;
    if (dayKey(line.startDateTime) > key || coverageEndKey(line) < key) continue;
    if (isBlockoutCard(line)) {
      blocked = true;
      blockLabel = blockLabel ?? line.jobNo;
      continue;
    }
    scheduled += effectiveHoursOnDay(line, date);
  }
  return { scheduled, capacity: getDayCapacity(employee, date, ctx), blocked, blockLabel };
}

// A card consumes its raw hours of capacity. Time-efficiency is applied on the
// CAPACITY side now (see getDayCapacity), so it must NOT be applied here too —
// the `employee` arg is kept for call-site compatibility.
export function effectiveHours(line: ScheduleLine, _employee: Employee): number {
  return line.overrideHours ?? line.estimatedHours;
}
