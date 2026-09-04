/**
 * Lending a production employee to Installation ("assist"), and showing that
 * work on BOTH boards.
 *
 * Why: most of the company reads the Installation board to see what's going out
 * this week, but a production employee reads the Production board to see their
 * own week. A lent person's install jobs used to exist only on Installation, so
 * their production row showed a grey "Installation" block with no idea what the
 * work actually was. Their install cards are now mirrored onto their production
 * row — read-only, badged Day / AM / PM — so one board really does show their
 * whole week.
 *
 * Two rules hold this together:
 *  - A mirror is render-only. It is never persisted and never goes into an
 *    engine context. The assist day already blocks that person's capacity, so
 *    counting the mirrored card again would double-book the day.
 *  - Mirroring is one-way. An install-native employee (no `sourceEmpId`) never
 *    appears on Production; only a lent production employee does.
 *
 * Pure — no React, no store, no I/O.
 */

import type { AssistAssignment, AssistHalf } from "./dataverse-live";
import type { ScheduleLine } from "../engine/types";
import { overlapsWindow } from "./week-window";

/** Weekday indices an assist covers when the row lists none — Mon..Fri. */
const ALL_WEEKDAYS = [0, 1, 2, 3, 4];

/** The weekday indices an assist row covers (empty `days` means the whole week). */
export function assistDayIndices(row: AssistAssignment): number[] {
  return row.days.length ? row.days : ALL_WEEKDAYS;
}

/**
 * How much of `dayIndex` this row lends to Installation, or null if that day
 * isn't lent at all. Days not listed in `halves` are full days.
 */
export function assistHalfForDay(row: AssistAssignment, dayIndex: number): AssistHalf | null {
  if (!assistDayIndices(row).includes(dayIndex)) return null;
  return row.halves[dayIndex] ?? "full";
}

/** Assist rows lent for the week beginning `weekMonday` (yyyy-mm-dd). */
export function assistRowsForWeek(
  rows: AssistAssignment[],
  weekMonday: string,
): AssistAssignment[] {
  return rows.filter((r) => r.weekStart === weekMonday);
}

/**
 * Which install-roster rows should be VISIBLE on the install board this week.
 *
 * An assist row is a temporary, week-specific loan, but it's stored as an
 * ordinary installation-employee row — so without this it sits on the roster
 * for every future week (the bug this fixes). Non-assist rows are permanent
 * crew and always show.
 *
 * A row lent for a *different* week still shows if it has cards on this one,
 * so pre-existing work can never be orphaned into an invisible row.
 */
export function visibleInstallEmployeeIds<E extends { id: string; isAssist?: boolean }>(
  employees: E[],
  assistRows: AssistAssignment[],
  weekMonday: string,
  cards: ScheduleLine[],
  from: Date,
  to: Date,
): Set<string> {
  const lentThisWeek = new Set(assistRowsForWeek(assistRows, weekMonday).map((r) => r.id));
  const hasCardsThisWeek = new Set(
    cards.filter((c) => overlapsWindow(c, from, to)).map((c) => c.employeeId),
  );
  const out = new Set<string>();
  for (const e of employees) {
    if (!e.isAssist || lentThisWeek.has(e.id) || hasCardsThisWeek.has(e.id)) out.add(e.id);
  }
  return out;
}

/** The install-roster rows to HIDE this week — the inverse of the above. */
export function hiddenInstallEmployeeIds<E extends { id: string; isAssist?: boolean }>(
  employees: E[],
  assistRows: AssistAssignment[],
  weekMonday: string,
  cards: ScheduleLine[],
  from: Date,
  to: Date,
): Set<string> {
  const visible = visibleInstallEmployeeIds(employees, assistRows, weekMonday, cards, from, to);
  return new Set(employees.filter((e) => !visible.has(e.id)).map((e) => e.id));
}

/** Monday-based weekday index of a date, 0=Mon … 6=Sun. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Install cards to draw on production rows this week, keyed by the PRODUCTION
 * employee id.
 *
 * Each card is re-homed onto the lent person's production row and flagged
 * `mirrorOf`, which makes it read-only and badges it with the half of the day
 * they're lent for. The card's own id is kept: it is the same card, shown twice,
 * and reusing the id keeps React keys and click-to-open pointing at the real
 * record.
 */
export function mirroredLinesByEmployee(
  assistRows: AssistAssignment[],
  installCards: ScheduleLine[],
  weekMonday: string,
  from: Date,
  to: Date,
): Map<string, ScheduleLine[]> {
  const out = new Map<string, ScheduleLine[]>();
  const inWeek = installCards.filter((c) => overlapsWindow(c, from, to));
  for (const row of assistRowsForWeek(assistRows, weekMonday)) {
    const mine = inWeek.filter((c) => c.employeeId === row.id);
    if (!mine.length) continue;
    const mirrored = mine.map((c) => ({
      ...c,
      employeeId: row.sourceEmpId,
      mirrorOf: "installation" as const,
      // Badge the half they're lent for on the day the card starts; a card that
      // starts outside the lent days still reads as a full day rather than
      // claiming a half it wasn't lent for.
      mirrorHalf: assistHalfForDay(row, weekdayIndex(c.startDateTime)) ?? "full",
    }));
    out.set(row.sourceEmpId, [...(out.get(row.sourceEmpId) ?? []), ...mirrored]);
  }
  return out;
}

/** Short badge text for a mirrored card: "Install", "Install AM", "Install PM". */
export function mirrorBadgeLabel(half: ScheduleLine["mirrorHalf"]): string {
  if (half === "am") return "Install AM";
  if (half === "pm") return "Install PM";
  return "Install";
}
