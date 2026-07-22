import { describe, it, expect } from "vitest";
import { settleSchedule } from "./cascade";
import { buildContext, line, at } from "./__fixtures__/build";
import type { ScheduleContext, ScheduleLine } from "./types";

// Mirror the store's loadWeek seeding: preferredStart = authored start, so a
// settled task keeps the user-intended pull-back floor (the engine contract).
function seed(lines: ScheduleLine[]): ScheduleContext {
  const ctx = buildContext(lines);
  ctx.schedule = ctx.schedule.map((l) => ({ ...l, preferredStart: new Date(l.startDateTime) }));
  return ctx;
}

describe("settleSchedule", () => {
  it("resolves a pre-existing same-employee overlap into a sequential queue", () => {
    // Two tasks on Bob authored to overlap (both Mon 08:00, 8h each).
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const b = line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const settled = settleSchedule(seed([a, b]));
    const sa = settled.schedule.find((l) => l.id === "A")!;
    const sb = settled.schedule.find((l) => l.id === "B")!;
    expect(sb.startDateTime.getTime()).toBeGreaterThanOrEqual(sa.endDateTime.getTime());
  });

  it("is idempotent — settling an already-settled board changes nothing", () => {
    const a = line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const b = line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const once = settleSchedule(seed([a, b]));
    const twice = settleSchedule(once);
    for (const l of once.schedule) {
      const t = twice.schedule.find((x) => x.id === l.id)!;
      expect(t.startDateTime.getTime()).toBe(l.startDateTime.getTime());
    }
  });

  it("never moves a locked task", () => {
    const locked = line({ id: "L", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8, isLocked: true });
    const other = line({ id: "O", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const settled = settleSchedule(seed([locked, other]));
    const sl = settled.schedule.find((l) => l.id === "L")!;
    expect(sl.startDateTime.getTime()).toBe(at(0, 8).getTime());
  });

  it("never moves a custom card (group container / annotation), even on a busy lane", () => {
    // A group card (isCustom) placed at Mon 13:00 on Bob, who already has a
    // full-day BC task at Mon 08:00. Before the fix the cascade pushed the
    // custom card to after the BC task (and, on a full week, off the board).
    const bcTask = line({ id: "BC", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    const groupCard = line({ id: "G", jobNo: "Group", employeeId: "bob", departmentId: "metal", start: at(0, 13), estimatedHours: 8, isCustom: true });
    const settled = settleSchedule(seed([bcTask, groupCard]));
    const sg = settled.schedule.find((l) => l.id === "G")!;
    expect(sg.startDateTime.getTime()).toBe(at(0, 13).getTime());
  });
});
