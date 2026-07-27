import { describe, it, expect } from "vitest";
import { firstOpenSlot, calculateEndTime } from "./time-walker";
import { effectiveHours } from "./capacity";
import { buildContext, line, at } from "./__fixtures__/build";
import type { ScheduleContext, ScheduleLine } from "./types";

const bobOf = (ctx: ScheduleContext) => ctx.employees.get("bob")!;

describe("firstOpenSlot", () => {
  it("empty schedule → the given morning", () => {
    const ctx = buildContext([]);
    expect(firstOpenSlot(at(0, 8), bobOf(ctx), ctx).getTime()).toBe(at(0, 8).getTime());
  });

  it("fills a partial day after existing work", () => {
    // Bob has a 4h job Mon 08:00–12:00 → next open slot is Mon 12:00.
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 });
    const ctx = buildContext([a]);
    expect(firstOpenSlot(at(0, 8), bobOf(ctx), ctx).getTime()).toBe(at(0, 12).getTime());
  });

  it("rolls to the next day when the first day is full", () => {
    // Bob's Monday is full (8h) → next open slot is Tue 08:00.
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const ctx = buildContext([a]);
    expect(firstOpenSlot(at(0, 8), bobOf(ctx), ctx).getTime()).toBe(at(1, 8).getTime());
  });

  it("finds the first partial day when earlier days are full", () => {
    // Mon full, Tue full, Wed half (4h) → next open slot is Wed 12:00.
    const mon = line({ id: "M", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const tue = line({ id: "T", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(1, 8), estimatedHours: 8 });
    const wed = line({ id: "W", jobNo: "J3", employeeId: "bob", departmentId: "metal", start: at(2, 8), estimatedHours: 4 });
    const ctx = buildContext([mon, tue, wed]);
    expect(firstOpenSlot(at(0, 8), bobOf(ctx), ctx).getTime()).toBe(at(2, 12).getTime());
  });

  it("skips the weekend", () => {
    // Mon–Fri all full → next open slot is the following Monday.
    const days = [0, 1, 2, 3, 4].map((d) =>
      line({ id: `D${d}`, jobNo: `J${d}`, employeeId: "bob", departmentId: "metal", start: at(d, 8), estimatedHours: 8 }),
    );
    const ctx = buildContext(days);
    expect(firstOpenSlot(at(0, 8), bobOf(ctx), ctx).getTime()).toBe(at(7, 8).getTime());
  });

  it("does NOT overlap when placing several jobs in sequence (batch)", () => {
    // Simulate the batch loop: place a job at its first open slot, add it to the
    // schedule (with a real capacity-walked end), then place the next.
    const ctx = buildContext([]);
    const bob = bobOf(ctx);
    const placed: ScheduleLine[] = [];
    for (let i = 0; i < 3; i++) {
      const start = firstOpenSlot(at(0, 8), bob, ctx);
      const draft = line({
        id: `P${i}`, jobNo: `J${i}`, employeeId: "bob", departmentId: "metal",
        start, estimatedHours: 6,
      });
      const end = calculateEndTime(start, effectiveHours(draft, bob), bob, ctx, draft.id);
      const full = { ...draft, endDateTime: end };
      ctx.schedule.push(full);
      placed.push(full);
    }
    // No two placements share a start (they append, not stack).
    const starts = placed.map((p) => p.startDateTime.getTime());
    expect(new Set(starts).size).toBe(3);
    // Each starts at/after the previous one's end.
    expect(placed[1]!.startDateTime.getTime()).toBeGreaterThanOrEqual(placed[0]!.endDateTime.getTime());
    expect(placed[2]!.startDateTime.getTime()).toBeGreaterThanOrEqual(placed[1]!.endDateTime.getTime());
  });
});
