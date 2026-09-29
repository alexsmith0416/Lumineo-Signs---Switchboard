import { describe, expect, it } from "vitest";
import {
  billingMonthOf,
  billingPeriod,
  billingPeriodFor,
  cutoffOnDay,
  cutoffProblem,
  DEFAULT_MONTHLY_GOAL,
  monthsAround,
  type BillingPeriodRow,
} from "./billing-periods";

const d = (s: string) => new Date(`${s}T00:00:00`);
const at = (s: string) => new Date(s); // local date-time
const rows: BillingPeriodRow[] = [
  { month: "2026-09", cutoff: "2026-09-25", goal: 900_000 },
  { month: "2026-10", cutoff: "2026-10-24", goal: null },
];

describe("billingPeriod", () => {
  it("runs from the previous cut-off day up to (not including) its own", () => {
    const oct = billingPeriod("2026-10", rows);
    expect(oct.start).toEqual(d("2026-09-25"));
    expect(oct.end).toEqual(d("2026-10-24"));
    expect(oct.lastInstallDay).toEqual(d("2026-10-23"));
    expect(oct.cutoffSet).toBe(true);
  });

  it("falls back to calendar months where no cut-off is set", () => {
    const aug = billingPeriod("2026-08", rows);
    expect(aug.start).toEqual(d("2026-08-01"));
    expect(aug.end).toEqual(d("2026-09-01"));
    expect(aug.cutoffSet).toBe(false);
    // November has no cut-off: starts at October's, ends at Dec 1.
    const nov = billingPeriod("2026-11", rows);
    expect(nov.start).toEqual(d("2026-10-24"));
    expect(nov.end).toEqual(d("2026-12-01"));
  });

  it("uses the month's goal, or the $1.1M default", () => {
    expect(billingPeriod("2026-09", rows).goal).toBe(900_000);
    expect(billingPeriod("2026-10", rows).goal).toBe(DEFAULT_MONTHLY_GOAL);
  });

  it("with no rows at all is exactly the calendar month", () => {
    const p = billingPeriod("2026-02", []);
    expect(p.start).toEqual(d("2026-02-01"));
    expect(p.end).toEqual(d("2026-03-01"));
  });
});

describe("billingMonthOf — the install END date decides", () => {
  it("counts an install ending the day before the cut-off in that month", () => {
    expect(billingMonthOf(at("2026-10-23T16:00:00"), rows)).toBe("2026-10");
  });
  it("rolls an install ending ON the cut-off day into the next month", () => {
    expect(billingMonthOf(at("2026-10-24T12:00:00"), rows)).toBe("2026-11");
  });
  it("puts late-September installs after September's cut-off into October", () => {
    expect(billingMonthOf(at("2026-09-28T16:00:00"), rows)).toBe("2026-10");
    expect(billingMonthOf(at("2026-09-24T16:00:00"), rows)).toBe("2026-09");
  });
  it("uses calendar months where nothing is set", () => {
    expect(billingMonthOf(at("2026-05-31T16:00:00"), [])).toBe("2026-05");
    expect(billingMonthOf(at("2026-06-01T08:00:00"), [])).toBe("2026-06");
  });
  it("billingPeriodFor returns the matching period", () => {
    expect(billingPeriodFor(at("2026-10-02T16:00:00"), rows).month).toBe("2026-10");
  });
});

describe("cutoffProblem", () => {
  it("accepts a date between the neighbouring cut-offs", () => {
    expect(cutoffProblem("2026-11", "2026-11-23", rows)).toBeNull();
  });
  it("rejects a date on or before the previous month's cut-off", () => {
    // October's cut-off may run as late as Nov 10, which is also November's earliest.
    const r = [{ month: "2026-10", cutoff: "2026-11-10", goal: null }];
    expect(cutoffProblem("2026-11", "2026-11-10", r)).toMatch(/after the previous cut-off/);
  });
  it("rejects a date on or after the next month's cut-off", () => {
    const r = [{ month: "2026-10", cutoff: "2026-10-10", goal: null }];
    expect(cutoffProblem("2026-09", "2026-10-10", r)).toMatch(/before the next cut-off/);
  });
  it("rejects dates far from the month, and malformed input", () => {
    expect(cutoffProblem("2026-10", "2026-12-20", rows)).toMatch(/Pick a date between/);
    expect(cutoffProblem("2026-10", "", rows)).toBe("Enter a date.");
  });
});

describe("monthsAround", () => {
  it("lists months from 3 back to 12 ahead", () => {
    const m = monthsAround(new Date(2026, 8, 28));
    expect(m[0]).toBe("2026-06");
    expect(m[3]).toBe("2026-09");
    expect(m.at(-1)).toBe("2027-09");
    expect(m).toHaveLength(16);
  });
});

describe("cutoffOnDay", () => {
  it("finds the month whose cut-off is that day", () => {
    const p = cutoffOnDay(new Date(2026, 9, 24, 13, 30), rows);
    expect(p?.month).toBe("2026-10");
    expect(p?.lastInstallDay).toEqual(d("2026-10-23"));
  });
  it("is null on other days, and for calendar-default months", () => {
    expect(cutoffOnDay(new Date(2026, 9, 23), rows)).toBeNull();
    expect(cutoffOnDay(new Date(2026, 11, 1), rows)).toBeNull(); // Dec 1 is only November's default end
  });
});
