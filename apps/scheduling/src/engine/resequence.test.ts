import { describe, it, expect } from "vitest";
import { differenceInCalendarDays } from "date-fns";
import { diffResequence, settleSchedule } from "./cascade";
import { buildContext, line, at } from "./__fixtures__/build";
import type { ScheduleContext, ScheduleLine } from "./types";

// Mirror the store: a loaded board is settled with preferredStart = start.
function board(lines: ScheduleLine[]): ScheduleContext {
  const ctx = buildContext(lines);
  ctx.schedule = ctx.schedule.map((l) => ({ ...l, preferredStart: new Date(l.startDateTime) }));
  return settleSchedule(ctx);
}

const get = (ctx: ScheduleContext, id: string) => ctx.schedule.find((l) => l.id === id)!;

describe("diffResequence", () => {
  it("swaps start times when two same-day cards are reordered", () => {
    // Bob works two 4h jobs Monday: A at 08:00, B at 12:00.
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 });
    const b = line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 12), estimatedHours: 4 });
    const ctx = board([a, b]);

    // Drag B above A → B should now start first (08:00), A second (12:00).
    const diff = diffResequence(ctx, ["B", "A"]);
    const sa = get(diff.committed, "A");
    const sb = get(diff.committed, "B");
    expect(sb.startDateTime.getTime()).toBe(at(0, 8).getTime());
    expect(sa.startDateTime.getTime()).toBeGreaterThanOrEqual(sb.endDateTime.getTime());
    // Both cards genuinely moved, so both are persisted.
    expect(new Set(diff.changed.map((l) => l.id))).toEqual(new Set(["A", "B"]));
  });

  it("is a no-op when the order is unchanged", () => {
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 });
    const b = line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 12), estimatedHours: 4 });
    const ctx = board([a, b]);
    const diff = diffResequence(ctx, ["A", "B"]);
    expect(diff.changed).toHaveLength(0);
  });

  it("leaves unrelated people and days untouched", () => {
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 });
    const b = line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 12), estimatedHours: 4 });
    const c = line({ id: "C", jobNo: "J3", employeeId: "carol", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const ctx = board([a, b, c]);
    const before = get(ctx, "C").startDateTime.getTime();
    const diff = diffResequence(ctx, ["B", "A"]);
    expect(diff.changed.some((l) => l.id === "C")).toBe(false);
    expect(get(diff.committed, "C").startDateTime.getTime()).toBe(before);
  });

  it("changes which card spills to the next day when the day is over capacity", () => {
    // Three 4h jobs on Bob Monday: only two fit (08:00-16:00), the third spills
    // to Tuesday. Originally C spilled; reorder to [C, A, B] so B spills instead.
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 });
    const b = line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 12), estimatedHours: 4 });
    const c = line({ id: "C", jobNo: "J3", employeeId: "bob", departmentId: "metal", start: at(1, 8), estimatedHours: 4 });
    const ctx = board([a, b, c]);

    const diff = diffResequence(ctx, ["C", "A", "B"]);
    const sc = get(diff.committed, "C");
    const sb = get(diff.committed, "B");
    // C now leads Monday; B is pushed to a later day than Monday (and renders
    // on that day — its start is a real work slot, not Monday 16:00).
    expect(sc.startDateTime.getTime()).toBe(at(0, 8).getTime());
    expect(differenceInCalendarDays(sb.startDateTime, at(0, 8))).toBeGreaterThan(0);
  });

  it("does NOT move the person's jobs on other days (no whole-chain reshuffle)", () => {
    // The reported bug: reordering Monday's cards shoved unrelated later jobs
    // weeks out. A downstream job on Thursday must stay exactly put.
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 });
    const b = line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 12), estimatedHours: 4 });
    const later = line({ id: "L", jobNo: "J3", employeeId: "bob", departmentId: "metal", start: at(3, 8), estimatedHours: 8 });
    const ctx = board([a, b, later]);
    const before = get(ctx, "L").startDateTime.getTime();
    const diff = diffResequence(ctx, ["B", "A"]);
    expect(diff.changed.some((l) => l.id === "L")).toBe(false);
    expect(get(diff.committed, "L").startDateTime.getTime()).toBe(before);
  });
});
