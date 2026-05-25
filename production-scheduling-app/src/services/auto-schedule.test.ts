import { describe, expect, it } from "vitest";
import { addHours, addDays } from "date-fns";
import { proposeSchedule } from "./auto-schedule";
import { at, buildContext, line } from "../engine/__fixtures__/build";
import type { MappedPlanningLine } from "./planning-line-mapping";

const fakeJob = {
  jobNo: "J999",
  customerName: "Test Co",
  promisedDate: addDays(at(0, 8), 14),
};

describe("proposeSchedule", () => {
  it("orders proposals by department flow order", () => {
    const lines: MappedPlanningLine[] = [
      { lineNo: 30, description: "Assembly", estimatedHours: 4, departmentId: "asm" },
      { lineNo: 10, description: "Metal", estimatedHours: 4, departmentId: "metal" },
      { lineNo: 20, description: "Paint", estimatedHours: 2, departmentId: "paint" },
    ];
    const slots = proposeSchedule(fakeJob, lines, buildContext([]), { earliestStart: at(0, 8) });

    const order = slots.map((s) => s.departmentId);
    expect(order).toEqual(["metal", "paint", "asm"]);
  });

  it("chains slots so each starts at or after the previous end", () => {
    const lines: MappedPlanningLine[] = [
      { lineNo: 10, description: "Metal", estimatedHours: 4, departmentId: "metal" },
      { lineNo: 20, description: "Paint", estimatedHours: 2, departmentId: "paint" },
    ];
    const slots = proposeSchedule(fakeJob, lines, buildContext([]), { earliestStart: at(0, 8) });
    expect(slots[1]!.start.getTime()).toBeGreaterThanOrEqual(slots[0]!.end.getTime());
  });

  it("respects earliest start", () => {
    const lines: MappedPlanningLine[] = [
      { lineNo: 10, description: "Metal", estimatedHours: 4, departmentId: "metal" },
    ];
    const slots = proposeSchedule(fakeJob, lines, buildContext([]), { earliestStart: at(2, 9) });
    expect(slots[0]!.start.getTime()).toBe(at(2, 9).getTime());
  });

  it("places later lines after the picked employee's existing workload", () => {
    const ctx = buildContext([
      line({ id: "existing", jobNo: "J1", employeeId: "tom", departmentId: "paint", start: at(0, 8), estimatedHours: 5 }),
    ]);
    const lines: MappedPlanningLine[] = [
      { lineNo: 10, description: "Paint", estimatedHours: 2, departmentId: "paint" },
    ];
    const slots = proposeSchedule(fakeJob, lines, ctx, { earliestStart: at(0, 8) });
    const tomEnd = ctx.schedule[0]!.endDateTime;
    expect(slots[0]!.start.getTime()).toBeGreaterThanOrEqual(tomEnd.getTime());
  });

  it("emits unassignable slot when no employee maps to the department", () => {
    const lines: MappedPlanningLine[] = [
      { lineNo: 10, description: "Mystery", estimatedHours: 4, departmentId: null },
    ];
    const slots = proposeSchedule(fakeJob, lines, buildContext([]), { earliestStart: at(0, 8) });
    expect(slots[0]!.employeeId).toBeNull();
    expect(slots[0]!.reason).toMatch(/manual/i);
  });

  it("uses a preferred employee when provided", () => {
    const lines: MappedPlanningLine[] = [
      { lineNo: 10, description: "Metal", estimatedHours: 2, departmentId: "metal" },
    ];
    const slots = proposeSchedule(fakeJob, lines, buildContext([]), {
      earliestStart: at(0, 8),
      preferredEmployeeIds: { metal: "bob" },
    });
    expect(slots[0]!.employeeId).toBe("bob");
  });

  it("ignores noise: simple sanity that scheduled end is after start", () => {
    const lines: MappedPlanningLine[] = [
      { lineNo: 10, description: "Metal", estimatedHours: 6, departmentId: "metal" },
    ];
    const slots = proposeSchedule(fakeJob, lines, buildContext([]), { earliestStart: at(0, 8) });
    expect(slots[0]!.end.getTime()).toBeGreaterThan(slots[0]!.start.getTime());
    expect(slots[0]!.end.getTime()).toBeGreaterThanOrEqual(addHours(slots[0]!.start, 6).getTime());
  });
});
