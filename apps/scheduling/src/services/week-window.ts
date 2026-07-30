/**
 * Which schedule lines belong on the board for a visible week.
 *
 * The rule is OVERLAP, not "starts in the window". A task scheduled across a
 * week boundary (starts Thursday, 2 weeks of hours) is still running on the
 * following Monday, so it has to load on that week's board too — otherwise the
 * card silently disappears even though its end date says it should be there.
 *
 * The grid already draws a carried-over card clipped to Monday with a
 * left-overflow arrow (see `computeRowCards`), and the engine wants it in
 * context because its carried-over hours really do occupy that person's
 * early-week capacity.
 */

/** Just the two fields the window test needs. Widened past ScheduleLine's
 *  non-null `endDateTime` because a live row's end column can be empty (or
 *  unparseable), and such a card must still behave like a same-day one. */
interface Windowed {
  startDateTime: Date;
  endDateTime?: Date | null;
}

/** A line's last moment for windowing — its end, or its start when the end is
 *  missing / an Invalid Date (comparisons against those are always false, which
 *  would silently drop the row). */
const lineEnd = (line: Windowed): Date => {
  const end = line.endDateTime;
  return end && !Number.isNaN(end.getTime()) ? end : line.startDateTime;
};

/** True when the line overlaps [from, to] at all — starts on/before the window
 *  ends AND ends on/after the window starts. */
export function overlapsWindow(line: Windowed, from: Date, to: Date): boolean {
  return line.startDateTime <= to && lineEnd(line) >= from;
}

/**
 * The same overlap test as an OData filter for the schedule-line table.
 *
 * Written as two parenthesized clauses rather than the tighter
 * `start le {to} and end ge {from}` so that rows with a NULL end date still
 * match exactly as they did before (clause 1 is the old start-in-window test) —
 * a null end would drop out of the tighter form.
 */
export function scheduleLineWindowFilter(from: Date, to: Date): string {
  const f = from.toISOString();
  return (
    `(crfdf_startdatetime ge ${f} and crfdf_startdatetime le ${to.toISOString()})` +
    ` or (crfdf_startdatetime lt ${f} and crfdf_enddatetime ge ${f})`
  );
}
