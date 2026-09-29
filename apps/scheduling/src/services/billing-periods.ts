/**
 * Billing periods (fiscal months) — pure.
 *
 * Each month has a BILLING CUT-OFF date, set per month in Settings → Billing
 * periods (crfdf_billingperiod). A job counts toward the billing month its
 * install ENDS in, and an install must end the day BEFORE the cut-off so the
 * order can be turned in for billing — so the cut-off day itself belongs to
 * the NEXT month:
 *
 *   October (cut-off Oct 24) = installs ending [September's cut-off, Oct 24)
 *
 * i.e. from September's cut-off day through Oct 23. A month with no cut-off
 * set behaves as a calendar month (its "cut-off" is the 1st of the next
 * month), so nothing changes until someone enters dates. Each month also
 * carries its billing goal (default $1.1M).
 */
import { addMonths, format } from "date-fns";

export const DEFAULT_MONTHLY_GOAL = 1_100_000;

/** A stored period row. `month` is "YYYY-MM"; `cutoff` is "YYYY-MM-DD". */
export interface BillingPeriodRow {
  month: string;
  cutoff: string | null;
  goal: number | null;
}

export interface BillingPeriod {
  month: string;
  /** First instant that counts (the previous month's cut-off day, 00:00 local). */
  start: Date;
  /** Exclusive: this month's cut-off day, 00:00 local. */
  end: Date;
  /** The last day an install can END and still count (cut-off − 1 day). */
  lastInstallDay: Date;
  /** This month's cut-off day. */
  cutoff: Date;
  /** True when the cut-off was set, false when it's the calendar default. */
  cutoffSet: boolean;
  goal: number;
}

const monthKey = (d: Date): string => format(d, "yyyy-MM");

const parseMonth = (month: string): Date => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1);
};

/** "YYYY-MM-DD" → local midnight, or null when malformed. */
export function parseDay(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatDay = (d: Date): string => format(d, "yyyy-MM-dd");

function rowFor(month: string, rows: readonly BillingPeriodRow[]): BillingPeriodRow | undefined {
  return rows.find((r) => r.month === month);
}

/** A month's cut-off: the stored date, or the 1st of the next month. */
function cutoffOf(month: string, rows: readonly BillingPeriodRow[]): { day: Date; set: boolean } {
  const stored = parseDay(rowFor(month, rows)?.cutoff);
  return stored ? { day: stored, set: true } : { day: addMonths(parseMonth(month), 1), set: false };
}

export function billingPeriod(month: string, rows: readonly BillingPeriodRow[]): BillingPeriod {
  const prev = monthKey(addMonths(parseMonth(month), -1));
  const { day: cutoff, set } = cutoffOf(month, rows);
  const lastInstallDay = new Date(cutoff);
  lastInstallDay.setDate(lastInstallDay.getDate() - 1);
  const goal = rowFor(month, rows)?.goal;
  return {
    month,
    start: cutoffOf(prev, rows).day,
    end: cutoff,
    lastInstallDay,
    cutoff,
    cutoffSet: set,
    goal: goal != null && goal > 0 ? goal : DEFAULT_MONTHLY_GOAL,
  };
}

/** The billing month ("YYYY-MM") an instant falls in. */
export function billingMonthOf(date: Date, rows: readonly BillingPeriodRow[]): string {
  const cal = new Date(date.getFullYear(), date.getMonth(), 1);
  for (const offset of [0, 1, -1, 2, -2]) {
    const p = billingPeriod(monthKey(addMonths(cal, offset)), rows);
    if (date >= p.start && date < p.end) return p.month;
  }
  return monthKey(cal);
}

/** The billing period an instant falls in. */
export function billingPeriodFor(date: Date, rows: readonly BillingPeriodRow[]): BillingPeriod {
  return billingPeriod(billingMonthOf(date, rows), rows);
}

/**
 * Why a cut-off can't be saved, or null when it's fine. It must fall after the
 * previous month's cut-off and before the next month's, so periods never
 * overlap or leave a gap, and within a sensible reach of its own month.
 */
export function cutoffProblem(month: string, cutoff: string, rows: readonly BillingPeriodRow[]): string | null {
  const day = parseDay(cutoff);
  if (!day) return "Enter a date.";
  const m = parseMonth(month);
  const earliest = new Date(m.getFullYear(), m.getMonth(), 10);
  const latest = new Date(m.getFullYear(), m.getMonth() + 1, 10);
  if (day < earliest || day > latest)
    return `Pick a date between ${format(earliest, "MMM d")} and ${format(latest, "MMM d")}.`;
  const prev = cutoffOf(monthKey(addMonths(m, -1)), rows).day;
  if (day <= prev) return `Must be after the previous cut-off (${format(prev, "MMM d")}).`;
  const next = rowFor(monthKey(addMonths(m, 1)), rows);
  const nextDay = parseDay(next?.cutoff);
  if (nextDay && day >= nextDay) return `Must be before the next cut-off (${format(nextDay, "MMM d")}).`;
  return null;
}

/** Months to show in Settings: `back` months before `today`'s month through `ahead` after. */
export function monthsAround(today: Date, back = 3, ahead = 12): string[] {
  const base = new Date(today.getFullYear(), today.getMonth(), 1);
  return Array.from({ length: back + ahead + 1 }, (_, i) => monthKey(addMonths(base, i - back)));
}

/** The billing period whose (explicitly set) cut-off falls on `day`, or null.
 *  Drives the "Billing cut-off" label on the calendars' day headers. */
export function cutoffOnDay(day: Date, rows: readonly BillingPeriodRow[]): BillingPeriod | null {
  const key = formatDay(day);
  const row = rows.find((r) => r.cutoff === key && parseDay(r.cutoff));
  return row ? billingPeriod(row.month, rows) : null;
}
