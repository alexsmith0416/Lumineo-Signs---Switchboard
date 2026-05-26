import type { HistoryRange } from "../types";

export function rangeBounds(range: HistoryRange, anchor: Date = new Date()): {
  start: Date;
  end: Date;
  label: string;
} {
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  if (range === "Today") {
    return { start: startOfDay(anchor), end: endOfDay(anchor), label: "Today" };
  }

  if (range === "ThisWeek") {
    const d = startOfDay(anchor);
    const dow = d.getDay(); // 0 Sun
    const monOffset = (dow + 6) % 7; // days since Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() - monOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: endOfDay(sunday), label: "This Week" };
  }

  if (range === "LastWeek") {
    const thisWeek = rangeBounds("ThisWeek", anchor);
    const start = new Date(thisWeek.start);
    start.setDate(start.getDate() - 7);
    const end = new Date(thisWeek.end);
    end.setDate(end.getDate() - 7);
    return { start, end, label: "Last Week" };
  }

  if (range === "PayPeriod") {
    // Bi-weekly pay period anchored to a Monday start; demo: current 2-week block ending today's week
    const thisWeek = rangeBounds("ThisWeek", anchor);
    const start = new Date(thisWeek.start);
    start.setDate(start.getDate() - 7);
    return { start, end: thisWeek.end, label: "Pay Period" };
  }

  // Custom = last 30 days as a default
  const start = startOfDay(anchor);
  start.setDate(start.getDate() - 29);
  return { start, end: endOfDay(anchor), label: "Custom" };
}

export function formatRangeDates(start: Date, end: Date): string {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const monthName = (d: Date) => d.toLocaleString(undefined, { month: "short" });
  if (sameMonth) {
    return `${monthName(start)} ${start.getDate()} – ${end.getDate()}`;
  }
  return `${monthName(start)} ${start.getDate()} – ${monthName(end)} ${end.getDate()}`;
}
