import { describe, expect, it } from "vitest";
import { shiftTask, cloneContext } from "./cascade";
import { MOCK_DEPARTMENTS, MOCK_EMPLOYEES, MOCK_SCHEDULE, MOCK_WORK_HOURS, MOCK_OVERTIME } from "../data/mock-schedule";
import { calculateEndTime } from "./time-walker";
import { effectiveHours } from "./capacity";
import type { ScheduleContext, ScheduleLine } from "./types";

function buildMockContext(): ScheduleContext {
  const empMap = new Map(MOCK_EMPLOYEES.map((e) => [e.id, e]));
  const deptMap = new Map(MOCK_DEPARTMENTS.map((d) => [d.id, d]));
  // mirror schedule-store load normalization: seed preferredStart, recompute end
  const ctxForNormalize: ScheduleContext = {
    employees: empMap,
    departments: deptMap,
    schedule: MOCK_SCHEDULE.map((l) => ({ ...l })),
    workHours: [...MOCK_WORK_HOURS],
    overtime: [...MOCK_OVERTIME],
  };
  const normalized = ctxForNormalize.schedule.map((line) => {
    const emp = empMap.get(line.employeeId);
    const withPref = line.preferredStart instanceof Date ? line : { ...line, preferredStart: new Date(line.startDateTime) };
    if (!emp) return withPref;
    const end = calculateEndTime(withPref.startDateTime, effectiveHours(withPref, emp), emp, ctxForNormalize, withPref.id);
    return end.getTime() === withPref.endDateTime.getTime() ? withPref : { ...withPref, endDateTime: end };
  });
  return { ...ctxForNormalize, schedule: normalized };
}

describe("cascade — repro: moving J35899 should NOT touch other employees", () => {
  it("only Chris Owen's mf-5 changes when J35899 shifts one day", () => {
    const ctx = buildMockContext();
    const target = ctx.schedule.find((l) => l.id === "mf-5")!;
    expect(target).toBeDefined();
    const originalPos = new Map<string, { start: number; end: number }>();
    for (const l of ctx.schedule) {
      originalPos.set(l.id, { start: l.startDateTime.getTime(), end: l.endDateTime.getTime() });
    }

    const newStart = new Date(target.startDateTime);
    newStart.setDate(newStart.getDate() + 1); // bump 1 day forward

    const r = shiftTask(ctx, "mf-5", newStart, undefined, { cascade: true });

    const drifted: ScheduleLine[] = [];
    for (const l of r.context.schedule) {
      if (l.id === "mf-5") continue;
      const orig = originalPos.get(l.id)!;
      if (l.startDateTime.getTime() !== orig.start || l.endDateTime.getTime() !== orig.end) {
        drifted.push(l);
      }
    }

    if (drifted.length > 0) {
      console.log("Tasks that drifted unexpectedly:");
      for (const l of drifted) {
        const orig = originalPos.get(l.id)!;
        console.log(
          `  ${l.id} ${l.jobNo} ${l.employeeId} ${l.departmentId} :: ` +
            `start ${new Date(orig.start).toISOString()} → ${l.startDateTime.toISOString()} | ` +
            `end ${new Date(orig.end).toISOString()} → ${l.endDateTime.toISOString()}`,
        );
      }
    }

    expect(drifted.map((l) => l.id)).toEqual([]);
  });
});
