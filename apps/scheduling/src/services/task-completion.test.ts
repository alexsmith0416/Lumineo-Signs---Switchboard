import { describe, expect, it } from "vitest";
import { deptForCompletion, tickOutcome } from "./task-completion";
import { flowFromRules, stepForStatus } from "./job-flow";
import { DEFAULT_STATUS_RULES, isAutoMovable, nextStatus } from "./status-rules";

const none = new Set<string>();

describe("which department a shop-floor tick completes", () => {
  it("uses the task's planning lines when they name one department", () => {
    const r = deptForCompletion({ taskLines: [{ resourceNo: "2110", description: "Paint labor" }], employeeDept: "", taskDescription: "", completed: none });
    expect(r.key).toBe("P");
  });

  it("prefers the employee's department when the task covers several", () => {
    const r = deptForCompletion({
      taskLines: [{ resourceNo: "2011", description: "Metal" }, { resourceNo: "2110", description: "Paint" }],
      employeeDept: "Paint", taskDescription: "", completed: none,
    });
    expect(r.key).toBe("P");
  });

  it("else the first department in flow order that isn't complete", () => {
    const r = deptForCompletion({
      taskLines: [{ resourceNo: "2110", description: "Paint" }, { resourceNo: "2011", description: "Metal" }],
      employeeDept: "", taskDescription: "", completed: new Set(["MF"]),
    });
    expect(r.key).toBe("P");
  });

  it("falls back to the employee's department, then the task description", () => {
    expect(deptForCompletion({ taskLines: [], employeeDept: "Routing", taskDescription: "", completed: none }).key).toBe("R");
    expect(deptForCompletion({ taskLines: [], employeeDept: "", taskDescription: "Vinyl application", completed: none }).key).toBe("V");
    expect(deptForCompletion({ taskLines: [], employeeDept: "", taskDescription: "Misc", completed: none }).key).toBeNull();
  });
});

const step = (key: string, state: "completed" | "active" | "included") => ({ key, state });

describe("the status a job moves to", () => {
  it("follows the new active step", () => {
    expect(nextStatus([step("MF", "completed"), step("P", "active"), step("A", "included")], "MFG - Len Metal Fab", DEFAULT_STATUS_RULES))
      .toBe("MFG - Paint Prep / Paint");
  });

  it("moves to the done status when every step is complete", () => {
    expect(nextStatus([step("P", "completed"), step("I", "completed")], "Installation", DEFAULT_STATUS_RULES)).toBe("Complete-need paperwork");
  });

  it("never moves a hold or a special status", () => {
    const steps = [step("MF", "completed"), step("P", "active")];
    for (const s of ["Hold - Customer", "Service or Contract Order", "Morton - National", "Billboards", "Complete Invoiced"]) {
      expect(isAutoMovable(s, DEFAULT_STATUS_RULES)).toBe(false);
      expect(nextStatus(steps, s, DEFAULT_STATUS_RULES)).toBeNull();
    }
  });

  it("leaves it when it's already right", () => {
    expect(nextStatus([step("P", "active")], "MFG - Paint Prep / Paint", DEFAULT_STATUS_RULES)).toBeNull();
  });

  it("uses an edited rule", () => {
    expect(nextStatus([step("V", "active")], "MFG - Paint Prep / Paint", { ...DEFAULT_STATUS_RULES, V: "MFG - Vinyl Application" }))
      .toBe("MFG - Vinyl Application");
  });
});

describe("a tick's History columns", () => {
  const blank = { department: "", nextDept: "", statusFrom: "", statusTo: "" };
  const flow = flowFromRules(DEFAULT_STATUS_RULES);
  const stepFor = (status: string) => stepForStatus(flow.stages, flow.doneStatus, status);

  it("reads an older tick's sentence into department + status, and the step from the rules", () => {
    const r = tickOutcome(
      { ...blank, result: "Completed Routing (the task's description) · status NEK - Production → MFG - Len Metal Fab" },
      stepFor,
    );
    expect(r).toEqual({ department: "Routing", nextDept: "Metal Fab", statusFrom: "NEK - Production", statusTo: "MFG - Len Metal Fab" });
  });

  it("handles a department name with a slash and an unchanged status", () => {
    const r = tickOutcome({ ...blank, result: "Completed Vinyl / Graphics (the task's planning lines) · status left as Hold - Customer" }, stepFor);
    expect(r).toEqual({ department: "Vinyl / Graphics", nextDept: "", statusFrom: "Hold - Customer", statusTo: "" });
  });

  it("reads 'already complete' and the all-done rule", () => {
    const r = tickOutcome({ ...blank, result: "Assembly was already complete · status MFG - Assembly → Complete-need paperwork" }, stepFor);
    expect(r.department).toBe("Assembly");
    expect(r.nextDept).toBe("All steps complete");
  });

  it("keeps the columns a newer tick already has", () => {
    const t = { department: "Paint", nextDept: "Vinyl / Graphics", statusFrom: "A", statusTo: "B", result: "Completed Routing · status X → Y" };
    expect(tickOutcome(t, stepFor)).toEqual({ department: "Paint", nextDept: "Vinyl / Graphics", statusFrom: "A", statusTo: "B" });
  });
});

it("reads a stage-only tick's department (History)", () => {
  const r = tickOutcome(
    { department: "", nextDept: "", statusFrom: "", statusTo: "", result: "Completed the MFG - Vinyl Cut stage of Vinyl / Graphics — Vinyl / Graphics stays open (the task's planning lines) · status MFG - Vinyl Cut → MFG - Vinyl Application" },
    () => "V",
  );
  expect(r.department).toBe("Vinyl / Graphics");
  expect(r.statusTo).toBe("MFG - Vinyl Application");
});
