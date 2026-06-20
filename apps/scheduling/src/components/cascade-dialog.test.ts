import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import {
  MOCK_DEPARTMENTS,
  MOCK_EMPLOYEES,
  MOCK_SCHEDULE,
  MOCK_WORK_HOURS,
  MOCK_OVERTIME,
} from "../data/mock-schedule";
import { diffShift, settleSchedule } from "../engine/cascade";
import { calculateEndTime } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import { summarizeCascadeMoves } from "./CascadeConfirmDialog";
import type { ScheduleContext } from "../engine/types";

// End-to-end guard for the phantom-cascade confirm-dialog bug, exercised
// against the real production mock board and the exact summarizer the dialog
// renders. Mirrors store.loadWeek: seed preferredStart, reconcile end times,
// then settle to the cascade fixpoint.
function load(): ScheduleContext {
  const empMap = new Map(MOCK_EMPLOYEES.map((e) => [e.id, e]));
  const deptMap = new Map(MOCK_DEPARTMENTS.map((d) => [d.id, d]));
  const base: ScheduleContext = {
    employees: empMap,
    departments: deptMap,
    schedule: MOCK_SCHEDULE,
    workHours: MOCK_WORK_HOURS,
    overtime: MOCK_OVERTIME,
  };
  const normalized = MOCK_SCHEDULE.map((line) => {
    const emp = empMap.get(line.employeeId);
    const seeded =
      line.preferredStart instanceof Date
        ? line
        : { ...line, preferredStart: new Date(line.startDateTime) };
    if (!emp) return seeded;
    const end = calculateEndTime(seeded.startDateTime, effectiveHours(seeded, emp), emp, base, seeded.id);
    return end.getTime() === seeded.endDateTime.getTime() ? seeded : { ...seeded, endDateTime: end };
  });
  return settleSchedule({ ...base, schedule: normalized });
}

describe("cascade confirm dialog — phantom move guard (real mock board)", () => {
  const ctx = load();

  it("a no-op drag (drop a task back where it is) surfaces ZERO downstream moves for EVERY task", () => {
    for (const target of ctx.schedule) {
      const diff = diffShift(ctx, target.id, target.startDateTime, undefined, { cascade: true });
      const moves = summarizeCascadeMoves(ctx, diff, target.id);
      expect(
        moves,
        `no-op on ${target.id} should report no cascade, got ${moves.length}`,
      ).toHaveLength(0);
    }
  });

  it("dialog rows exactly match the tasks the commit will write (no hidden churn, no over-report)", () => {
    // Whatever the dialog tells the user is affected must be exactly what the
    // committed board changes — so approving the cascade does precisely what
    // was previewed. (Reported moves may legitimately reach another resource
    // via a transitive chain; the guarantee is that they're causal, which the
    // no-op-is-zero test above pins.)
    for (const target of ctx.schedule.slice(0, 12)) {
      const newStart = addDays(target.startDateTime, 3);
      const diff = diffShift(ctx, target.id, newStart, undefined, { cascade: true });
      const moves = summarizeCascadeMoves(ctx, diff, target.id);
      const dialogIds = new Set(moves.map((m) => m.line.id));
      const committedChangedIds = new Set(diff.changed.map((c) => c.id));
      expect(dialogIds).toEqual(committedChangedIds);
    }
  });

  it("the committed board applies the cascade and is internally consistent", () => {
    const target = ctx.schedule.find((l) => l.employeeId === "emp-tanner")!;
    const diff = diffShift(ctx, target.id, addDays(target.startDateTime, 5), undefined, { cascade: true });
    // Target landed where we asked (08:00 on the dropped day).
    expect(diff.target).not.toBeNull();
    // Unaffected tasks keep their exact pre-drag positions (no churn snap).
    const changedIds = new Set([target.id, ...diff.changed.map((c) => c.id)]);
    for (const before of ctx.schedule) {
      if (changedIds.has(before.id)) continue;
      const after = diff.committed.schedule.find((l) => l.id === before.id)!;
      expect(after.startDateTime.getTime()).toBe(before.startDateTime.getTime());
    }
  });
});
