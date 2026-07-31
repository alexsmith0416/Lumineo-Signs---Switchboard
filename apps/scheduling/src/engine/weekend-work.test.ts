import { describe, it, expect } from "vitest";
import { getDayCapacity, hasManualWorkOn, dayLoad } from "./capacity";
import { calculateEndTime, firstOpenSlot } from "./time-walker";
import { buildContext, line, at } from "./__fixtures__/build";
import type { ScheduleContext } from "./types";

// Fixture week starts Mon 2026-06-01, so index 5 = Saturday, 6 = Sunday.
const SAT = 5;
const SUN = 6;
const bobOf = (ctx: ScheduleContext) => ctx.employees.get("bob")!;

const satJob = (hours: number, id = "SAT") =>
  line({
    id,
    jobNo: "J1",
    employeeId: "bob",
    departmentId: "metal",
    start: at(SAT, 8),
    estimatedHours: hours,
  });

describe("a weekend day someone is manually scheduled on becomes a working day", () => {
  it("has no capacity when nothing is scheduled there", () => {
    const ctx = buildContext([]);
    expect(getDayCapacity(bobOf(ctx), at(SAT, 8), ctx)).toBe(0);
  });

  it("has full capacity once a card starts that day", () => {
    const ctx = buildContext([satJob(4)]);
    expect(getDayCapacity(bobOf(ctx), at(SAT, 8), ctx)).toBe(8);
  });

  it("opens only the day worked, not the whole weekend", () => {
    const ctx = buildContext([satJob(4)]);
    expect(getDayCapacity(bobOf(ctx), at(SUN, 8), ctx)).toBe(0);
  });

  it("does not open a day for another employee", () => {
    const ctx = buildContext([satJob(4)]);
    expect(getDayCapacity(ctx.employees.get("tom")!, at(SAT, 8), ctx)).toBe(0);
  });

  it("a PTO / block-out card never opens a weekend", () => {
    // The point of a block-out is to take the day away — it must not be read as
    // "someone chose to work here".
    const pto = line({
      id: "PTO",
      jobNo: "PTO",
      employeeId: "bob",
      departmentId: "metal",
      start: at(SAT, 8),
      estimatedHours: 8,
      isCustom: true,
    });
    const ctx = buildContext([pto]);
    expect(hasManualWorkOn("bob", at(SAT, 8), ctx.schedule)).toBe(false);
    expect(getDayCapacity(bobOf(ctx), at(SAT, 8), ctx)).toBe(0);
  });

  it("the manual opt-in works before the card is on the board (drafts/previews)", () => {
    const ctx = buildContext([]);
    expect(getDayCapacity(bobOf(ctx), at(SAT, 8), ctx, { manual: true })).toBe(8);
  });

  it("the hover readout shows real capacity, not '4h of 0h'", () => {
    const ctx = buildContext([satJob(4)]);
    const load = dayLoad(bobOf(ctx), at(SAT, 8), ctx);
    expect(load.scheduled).toBe(4);
    expect(load.capacity).toBe(8);
    expect(load.blocked).toBe(false);
  });
});

describe("calculateEndTime honours a start the user chose", () => {
  it("finishes a Saturday job on Saturday (was rolling to Monday)", () => {
    // The reported bug: a 4h job placed on Sat Aug 1 reported End = Mon Aug 3.
    const ctx = buildContext([]);
    const end = calculateEndTime(at(SAT, 8), 4, bobOf(ctx), ctx);
    expect(end.getTime()).toBe(at(SAT, 12).getTime());
  });

  it("a long Saturday job resumes Monday, skipping Sunday", () => {
    // Only the start day gets the pass — a weekend job that runs over shouldn't
    // quietly eat Sunday too.
    const ctx = buildContext([]);
    const end = calculateEndTime(at(SAT, 8), 12, bobOf(ctx), ctx);
    expect(end.getTime()).toBe(at(SUN + 1, 12).getTime()); // Monday 12:00
  });

  it("still skips the weekend for a job that starts on a weekday", () => {
    // Friday 08:00 + 12h = 8h Friday, then Monday — never Saturday.
    const ctx = buildContext([]);
    const end = calculateEndTime(at(4, 8), 12, bobOf(ctx), ctx);
    expect(end.getTime()).toBe(at(SUN + 1, 12).getTime());
  });

  it("respects an existing Saturday card's hours when packing another onto it", () => {
    const ctx = buildContext([satJob(6)]);
    // 6h already used of Saturday's 8h → a second 2h card fits, ending at 16:00.
    const end = calculateEndTime(at(SAT, 14), 2, bobOf(ctx), ctx, "OTHER");
    expect(end.getTime()).toBe(at(SAT, 16).getTime());
  });
});

describe("auto-scheduling still refuses the weekend", () => {
  it("never lands on a Saturday, even one the person is working", () => {
    // Someone coming in on a Saturday is a deliberate call — not an invitation
    // for the scheduler to pile more on. Mon–Fri full, Sat has a 2h card.
    const week = [0, 1, 2, 3, 4].map((d) =>
      line({
        id: `D${d}`,
        jobNo: "J9",
        employeeId: "bob",
        departmentId: "metal",
        start: at(d, 8),
        estimatedHours: 8,
      }),
    );
    const ctx = buildContext([...week, satJob(2, "SATCARD")]);
    const slot = firstOpenSlot(at(0, 8), bobOf(ctx), ctx);
    expect(slot.getDay()).not.toBe(6); // not Saturday
    expect(slot.getDay()).not.toBe(0); // not Sunday
    expect(slot.getTime()).toBe(at(7, 8).getTime()); // the following Monday
  });
});
