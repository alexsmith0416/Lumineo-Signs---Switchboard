import { describe, expect, it } from "vitest";
import { commitScenario, computeImpact, runScenario } from "./scenarios";
import { at, buildContext, line } from "./__fixtures__/build";

describe("runScenario — shift-task", () => {
  it("applies a shift change without mutating the base", () => {
    const ctx = buildContext([
      line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
    ]);
    const baseSnapshot = ctx.schedule[0]!.startDateTime.getTime();
    const r = runScenario(ctx, [{ type: "shift-task", lineId: "a", newStart: at(2, 8) }]);

    expect(r.base.schedule[0]!.startDateTime.getTime()).toBe(baseSnapshot);
    const moved = r.scenario.schedule.find((l) => l.id === "a")!;
    expect(moved.startDateTime.getTime()).toBe(at(2, 8).getTime());
  });
});

describe("runScenario — insert-rush-job", () => {
  it("appends new lines and tracks them in newLineIds", () => {
    const ctx = buildContext([]);
    const r = runScenario(ctx, [
      {
        type: "insert-rush-job",
        jobNo: "J999",
        customerName: "Rush Co",
        customerDueDate: at(5, 17),
        earliestStart: at(0, 8),
        tasks: [
          { planningLineDescription: "fab", estimatedHours: 4, departmentId: "metal", employeeId: "bob" },
          { planningLineDescription: "paint", estimatedHours: 2, departmentId: "paint", employeeId: "tom" },
        ],
      },
    ]);
    expect(r.scenario.schedule.filter((l) => l.jobNo === "J999")).toHaveLength(2);
    expect(r.newLineIds.size).toBe(2);
  });
});

describe("runScenario — enable-weekends", () => {
  it("flips worksWeekends on the targeted employee", () => {
    const ctx = buildContext([]);
    expect(ctx.employees.get("bob")!.worksWeekends).toBe(false);
    const r = runScenario(ctx, [{ type: "enable-weekends", employeeId: "bob" }]);
    expect(r.scenario.employees.get("bob")!.worksWeekends).toBe(true);
  });
});

describe("commitScenario", () => {
  it("emits update patches for moved lines and insert patches for new lines", () => {
    const ctx = buildContext([
      line({ id: "exist", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
    ]);
    const r = runScenario(ctx, [
      { type: "shift-task", lineId: "exist", newStart: at(2, 8) },
      {
        type: "insert-rush-job",
        jobNo: "J999",
        customerName: "Rush",
        customerDueDate: at(5, 17),
        earliestStart: at(0, 8),
        tasks: [{ planningLineDescription: "fab", estimatedHours: 2, departmentId: "metal", employeeId: "bob" }],
      },
    ]);
    const { patches } = commitScenario(ctx, r);
    expect(patches.some((p) => p.lineId === "exist" && !p.isInsert)).toBe(true);
    expect(patches.some((p) => p.isInsert)).toBe(true);
  });

  it("emits no patches when nothing changed", () => {
    const ctx = buildContext([
      line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
    ]);
    const r = runScenario(ctx, []);
    const { patches } = commitScenario(ctx, r);
    expect(patches).toHaveLength(0);
  });
});

describe("computeImpact", () => {
  it("counts rescued and newly past-due jobs", () => {
    const ctx = buildContext([
      line({
        id: "late",
        jobNo: "J-late",
        employeeId: "bob",
        departmentId: "metal",
        start: at(3, 8),
        estimatedHours: 4,
        customerDueDate: at(2, 17),
      }),
    ]);
    const r = runScenario(ctx, [{ type: "shift-task", lineId: "late", newStart: at(0, 8) }]);
    const impact = computeImpact(r);
    expect(impact.rescuedJobs).toContain("J-late");
  });
});
