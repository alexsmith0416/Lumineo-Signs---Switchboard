/**
 * $ scheduled per day, for the day-header popover (Settings → Display → Day
 * value on hover). A job counts on every day one of its cards covers, ONCE per
 * day, at the calendar's value (BC remaining balance, else the invoice amount —
 * cardMoneyValue). Split by region (WK / NEK) and combined; a job on both
 * regions' boards the same day counts once in the combined figure.
 */
import { addDays, startOfDay } from "date-fns";
import type { ScheduleLine } from "../engine/types";

export interface RegionDayValue {
  total: number;
  jobs: number;
}

export interface DayValue {
  /** Each job once, whatever region. */
  combined: RegionDayValue;
  byRegion: Record<string, RegionDayValue>;
}

/** The days a card covers on the board: start day → its manual span, else its end day. */
export function lineDays(line: Pick<ScheduleLine, "startDateTime" | "endDateTime" | "spanDays">): [Date, Date] {
  const first = startOfDay(line.startDateTime);
  const last =
    line.spanDays && line.spanDays >= 1 ? addDays(first, line.spanDays - 1) : startOfDay(line.endDateTime);
  return [first, last < first ? first : last];
}

export function dayValue(
  lines: readonly ScheduleLine[],
  day: Date,
  regionOf: (line: ScheduleLine) => string | null,
  valueOf: (line: ScheduleLine) => number | null,
): DayValue {
  const d = startOfDay(day).getTime();
  const all = new Map<string, number>();
  const regions = new Map<string, Map<string, number>>();
  for (const l of lines) {
    if (!l.jobNo || l.isCustom || l.mirrorOf) continue;
    const v = valueOf(l);
    if (!v || v <= 0) continue;
    const [first, last] = lineDays(l);
    if (d < first.getTime() || d > last.getTime()) continue;
    if (!all.has(l.jobNo)) all.set(l.jobNo, v);
    const r = regionOf(l) || "Other";
    let m = regions.get(r);
    if (!m) regions.set(r, (m = new Map()));
    if (!m.has(l.jobNo)) m.set(l.jobNo, v);
  }
  const sum = (m: Map<string, number>): RegionDayValue => ({
    total: [...m.values()].reduce((a, b) => a + b, 0),
    jobs: m.size,
  });
  return {
    combined: sum(all),
    byRegion: Object.fromEntries([...regions].map(([r, m]) => [r, sum(m)])),
  };
}
