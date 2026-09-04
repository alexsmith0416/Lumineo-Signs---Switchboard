import { describe, expect, it } from "vitest";
import {
  assistDayIndices,
  assistHalfForDay,
  assistRowsForWeek,
  hiddenInstallEmployeeIds,
  mirrorBadgeLabel,
  mirroredLinesByEmployee,
  visibleInstallEmployeeIds,
  weekdayIndex,
} from "./assist-mirror";
import type { AssistAssignment } from "./dataverse-live";
import type { ScheduleLine } from "../engine/types";

const WEEK = "2026-09-07"; // Mon
const MON = new Date(2026, 8, 7, 8, 0);
const TUE = new Date(2026, 8, 8, 8, 0);
const WED = new Date(2026, 8, 9, 8, 0);
const FROM = new Date(2026, 8, 7, 0, 0);
const TO = new Date(2026, 8, 13, 23, 59);

const assist = (over: Partial<AssistAssignment> = {}): AssistAssignment => ({
  id: "inst-1",
  name: "Chris Owen",
  regionIsNek: false,
  sourceEmpId: "prod-1",
  weekStart: WEEK,
  days: [],
  halves: {},
  ...over,
});

const card = (over: Partial<ScheduleLine> = {}): ScheduleLine =>
  ({
    id: "c1",
    jobNo: "J35887",
    customerName: "RTS Accounting",
    planningLineDescription: "Wall pan install",
    startDateTime: MON,
    endDateTime: MON,
    estimatedHours: 8,
    overrideHours: null,
    employeeId: "inst-1",
    departmentId: "0",
    customerDueDate: null,
    isLocked: false,
    jobSequence: 0,
    ...over,
  }) as ScheduleLine;

describe("weekdayIndex", () => {
  it("is Monday-based", () => {
    expect(weekdayIndex(MON)).toBe(0);
    expect(weekdayIndex(TUE)).toBe(1);
    expect(weekdayIndex(new Date(2026, 8, 13))).toBe(6); // Sunday
  });
});

describe("assistDayIndices", () => {
  it("treats an empty day list as the whole working week", () => {
    expect(assistDayIndices(assist({ days: [] }))).toEqual([0, 1, 2, 3, 4]);
  });

  it("uses the listed days when given", () => {
    expect(assistDayIndices(assist({ days: [1, 3] }))).toEqual([1, 3]);
  });
});

describe("assistHalfForDay", () => {
  it("is null on a day that isn't lent", () => {
    expect(assistHalfForDay(assist({ days: [1] }), 0)).toBeNull();
  });

  it("is full on a lent day with no half recorded", () => {
    expect(assistHalfForDay(assist({ days: [1] }), 1)).toBe("full");
  });

  it("returns the recorded half", () => {
    const row = assist({ days: [1, 2], halves: { 1: "am", 2: "pm" } });
    expect(assistHalfForDay(row, 1)).toBe("am");
    expect(assistHalfForDay(row, 2)).toBe("pm");
  });

  it("ignores a half recorded for a day that isn't lent", () => {
    expect(assistHalfForDay(assist({ days: [1], halves: { 3: "am" } }), 3)).toBeNull();
  });
});

describe("assistRowsForWeek", () => {
  it("keeps only rows lent for that week", () => {
    const rows = [assist({ id: "a" }), assist({ id: "b", weekStart: "2026-09-14" })];
    expect(assistRowsForWeek(rows, WEEK).map((r) => r.id)).toEqual(["a"]);
  });
});

// The bug this fixes: an assist row is a one-week loan stored as an ordinary
// install-employee row, so without filtering it sat on the roster forever.
describe("visibleInstallEmployeeIds", () => {
  const crew = { id: "crew-1" };
  const lent = { id: "inst-1", isAssist: true };
  const lentOther = { id: "inst-2", isAssist: true };

  it("always shows permanent crew", () => {
    const v = visibleInstallEmployeeIds([crew], [], WEEK, [], FROM, TO);
    expect(v.has("crew-1")).toBe(true);
  });

  it("shows an assist row on the week it was lent for", () => {
    const v = visibleInstallEmployeeIds([lent], [assist()], WEEK, [], FROM, TO);
    expect(v.has("inst-1")).toBe(true);
  });

  it("hides an assist row on a week it was NOT lent for", () => {
    const rows = [assist({ weekStart: "2026-08-31" })];
    const v = visibleInstallEmployeeIds([lent], rows, WEEK, [], FROM, TO);
    expect(v.has("inst-1")).toBe(false);
  });

  it("hides an assist row with no assist record at all", () => {
    const v = visibleInstallEmployeeIds([lentOther], [], WEEK, [], FROM, TO);
    expect(v.has("inst-2")).toBe(false);
  });

  // Never orphan work: a card with no row to render on would just vanish.
  it("still shows a wrong-week assist row that has cards this week", () => {
    const rows = [assist({ weekStart: "2026-08-31" })];
    const v = visibleInstallEmployeeIds([lent], rows, WEEK, [card()], FROM, TO);
    expect(v.has("inst-1")).toBe(true);
  });

  it("ignores cards that fall outside the week", () => {
    const rows = [assist({ weekStart: "2026-08-31" })];
    const far = card({ startDateTime: new Date(2026, 9, 20), endDateTime: new Date(2026, 9, 20) });
    const v = visibleInstallEmployeeIds([lent], rows, WEEK, [far], FROM, TO);
    expect(v.has("inst-1")).toBe(false);
  });

  it("hiddenInstallEmployeeIds is the exact inverse", () => {
    const emps = [crew, lent, lentOther];
    const rows = [assist()];
    const hidden = hiddenInstallEmployeeIds(emps, rows, WEEK, [], FROM, TO);
    expect([...hidden]).toEqual(["inst-2"]);
  });
});

describe("mirroredLinesByEmployee", () => {
  it("re-homes an install card onto the lent production employee's row", () => {
    const m = mirroredLinesByEmployee([assist()], [card()], WEEK, FROM, TO);
    const lines = m.get("prod-1")!;
    expect(lines).toHaveLength(1);
    expect(lines[0]!.employeeId).toBe("prod-1");
    expect(lines[0]!.mirrorOf).toBe("installation");
    expect(lines[0]!.id).toBe("c1"); // same card, shown twice
  });

  it("badges the half of the day they're lent for", () => {
    const row = assist({ days: [0, 1], halves: { 0: "am", 1: "pm" } });
    const m = mirroredLinesByEmployee([row], [card(), card({ id: "c2", startDateTime: TUE, endDateTime: TUE })], WEEK, FROM, TO);
    const lines = m.get("prod-1")!;
    expect(lines.find((l) => l.id === "c1")!.mirrorHalf).toBe("am");
    expect(lines.find((l) => l.id === "c2")!.mirrorHalf).toBe("pm");
  });

  it("falls back to a full-day badge for a card outside the lent days", () => {
    const row = assist({ days: [0], halves: { 0: "am" } });
    const m = mirroredLinesByEmployee([row], [card({ startDateTime: WED, endDateTime: WED })], WEEK, FROM, TO);
    expect(m.get("prod-1")![0]!.mirrorHalf).toBe("full");
  });

  it("ignores cards belonging to other install employees", () => {
    const m = mirroredLinesByEmployee([assist()], [card({ employeeId: "someone-else" })], WEEK, FROM, TO);
    expect(m.size).toBe(0);
  });

  it("ignores assists lent for another week", () => {
    const m = mirroredLinesByEmployee([assist({ weekStart: "2026-08-31" })], [card()], WEEK, FROM, TO);
    expect(m.size).toBe(0);
  });

  it("ignores cards outside the visible week", () => {
    const far = card({ startDateTime: new Date(2026, 9, 20), endDateTime: new Date(2026, 9, 20) });
    const m = mirroredLinesByEmployee([assist()], [far], WEEK, FROM, TO);
    expect(m.size).toBe(0);
  });

  it("merges two assist rows that point at the same production employee", () => {
    const wk = assist({ id: "inst-1" });
    const nek = assist({ id: "inst-9", regionIsNek: true });
    const cards = [card(), card({ id: "c2", employeeId: "inst-9" })];
    const m = mirroredLinesByEmployee([wk, nek], cards, WEEK, FROM, TO);
    expect(m.get("prod-1")!.map((l) => l.id).sort()).toEqual(["c1", "c2"]);
  });

  it("does not mutate the source card", () => {
    const original = card();
    mirroredLinesByEmployee([assist()], [original], WEEK, FROM, TO);
    expect(original.employeeId).toBe("inst-1");
    expect(original.mirrorOf).toBeUndefined();
  });
});

describe("mirrorBadgeLabel", () => {
  it("names the half", () => {
    expect(mirrorBadgeLabel("full")).toBe("Install");
    expect(mirrorBadgeLabel("am")).toBe("Install AM");
    expect(mirrorBadgeLabel("pm")).toBe("Install PM");
    expect(mirrorBadgeLabel(undefined)).toBe("Install");
  });
});
