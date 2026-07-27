import { describe, it, expect } from "vitest";
import { placeDraft } from "./schedule-draft";
import { differenceInCalendarDays } from "date-fns";
import { buildContext, line, at } from "../engine/__fixtures__/build";
import type { ScheduleLine } from "../engine/types";

// A 16h draft — enough to span two days at 8h/day.
const bigDraft = (): ScheduleLine =>
  line({ id: "draft", jobNo: "J1", employeeId: "", departmentId: "metal", start: at(0, 8), estimatedHours: 16 });

describe("placeDraft — singleDay (installation)", () => {
  it("clamps a placed card to its start day when singleDay", () => {
    const ctx = buildContext([]);
    const placed = placeDraft({ draft: bigDraft(), employeeId: "bob", start: at(0, 8), ctx, singleDay: true });
    expect(placed).not.toBeNull();
    // Start and end land on the same calendar day (no bleed into Tuesday).
    expect(differenceInCalendarDays(placed!.endDateTime, placed!.startDateTime)).toBe(0);
  });

  it("still spans across days when singleDay is off (production)", () => {
    const ctx = buildContext([]);
    const placed = placeDraft({ draft: bigDraft(), employeeId: "bob", start: at(0, 8), ctx, singleDay: false });
    expect(placed).not.toBeNull();
    // 16h at 8h/day → ends on a later day.
    expect(differenceInCalendarDays(placed!.endDateTime, placed!.startDateTime)).toBeGreaterThan(0);
  });
});

describe("placeDraft — earliestStart (future scheduling)", () => {
  it("auto-schedules from the earliestStart floor, not today", () => {
    const ctx = buildContext([]);
    const draft = line({ id: "d", jobNo: "J1", employeeId: "", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    // No employee start; floor the batch to the following week (day 7).
    const placed = placeDraft({ draft, employeeId: "bob", start: null, ctx, earliestStart: at(7, 8) });
    expect(placed).not.toBeNull();
    expect(placed!.startDateTime.getTime()).toBe(at(7, 8).getTime());
  });

  it("an explicit item start overrides the earliestStart floor", () => {
    const ctx = buildContext([]);
    const draft = line({ id: "d", jobNo: "J1", employeeId: "", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const placed = placeDraft({ draft, employeeId: "bob", start: at(2, 8), ctx, earliestStart: at(7, 8) });
    expect(placed!.startDateTime.getTime()).toBe(at(2, 8).getTime());
  });
});
