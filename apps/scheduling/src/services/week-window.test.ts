import { describe, it, expect } from "vitest";
import { overlapsWindow, scheduleLineWindowFilter } from "./week-window";

// Visible week: Mon Jul 27 2026 00:00 → Sun Aug 2 2026 23:59:59.
const from = new Date(2026, 6, 27, 0, 0, 0);
const to = new Date(2026, 7, 2, 23, 59, 59);

const span = (start: Date, end: Date | null) => ({ startDateTime: start, endDateTime: end });

describe("overlapsWindow", () => {
  it("keeps a line that starts inside the week", () => {
    expect(overlapsWindow(span(new Date(2026, 6, 29, 8), new Date(2026, 6, 30, 16)), from, to)).toBe(
      true,
    );
  });

  it("keeps a line that STARTED the week before and runs into this one", () => {
    // The reported bug: a 2-week task starting Thu Jul 23 and ending Wed Jul 29
    // rendered through Friday, then vanished on the following week's board.
    expect(overlapsWindow(span(new Date(2026, 6, 23, 8), new Date(2026, 6, 29, 16)), from, to)).toBe(
      true,
    );
  });

  it("keeps a line that spans the whole week end to end", () => {
    expect(overlapsWindow(span(new Date(2026, 6, 20, 8), new Date(2026, 7, 12, 16)), from, to)).toBe(
      true,
    );
  });

  it("drops a line that ended before the week started", () => {
    expect(overlapsWindow(span(new Date(2026, 6, 20, 8), new Date(2026, 6, 24, 16)), from, to)).toBe(
      false,
    );
  });

  it("drops a line that starts after the week ends", () => {
    expect(overlapsWindow(span(new Date(2026, 7, 3, 8), new Date(2026, 7, 4, 16)), from, to)).toBe(
      false,
    );
  });

  it("falls back to the start date when a line has no end date", () => {
    expect(overlapsWindow(span(new Date(2026, 6, 28, 8), null), from, to)).toBe(true);
    expect(overlapsWindow(span(new Date(2026, 6, 20, 8), null), from, to)).toBe(false);
  });

  it("falls back to the start date when the end date is unparseable", () => {
    // A live row with an empty end column maps to an Invalid Date; comparing
    // against it is always false, which would drop the card entirely.
    const bad = new Date("not a date");
    expect(overlapsWindow(span(new Date(2026, 6, 28, 8), bad), from, to)).toBe(true);
  });
});

describe("scheduleLineWindowFilter", () => {
  const filter = scheduleLineWindowFilter(from, to);

  it("keeps both clauses parenthesized so `or` can't swallow an `and`", () => {
    // Unparenthesized, OData binds `and` tighter and the second clause would
    // widen the query to every row ever scheduled.
    expect(filter).toBe(
      `(crfdf_startdatetime ge ${from.toISOString()} and crfdf_startdatetime le ${to.toISOString()})` +
        ` or (crfdf_startdatetime lt ${from.toISOString()} and crfdf_enddatetime ge ${from.toISOString()})`,
    );
  });

  it("still matches the plain start-in-window rows (null end dates included)", () => {
    expect(filter).toContain(
      `crfdf_startdatetime ge ${from.toISOString()} and crfdf_startdatetime le ${to.toISOString()}`,
    );
  });

  it("pulls in rows that started before the window but end inside it", () => {
    expect(filter).toContain(
      `crfdf_startdatetime lt ${from.toISOString()} and crfdf_enddatetime ge ${from.toISOString()}`,
    );
  });
});
