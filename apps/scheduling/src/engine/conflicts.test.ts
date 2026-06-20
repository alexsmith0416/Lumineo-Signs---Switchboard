import { describe, expect, it } from "vitest";
import { detectConflicts } from "./conflicts";
import { at, buildContext, line } from "./__fixtures__/build";

describe("detectConflicts — past-due", () => {
  it("flags a line that ends after its customer due date", () => {
    const ctx = buildContext([
      line({
        id: "late",
        jobNo: "J1",
        employeeId: "bob",
        departmentId: "metal",
        start: at(0, 8),
        estimatedHours: 4,
        customerDueDate: at(-1, 8),
      }),
    ]);
    const conflicts = detectConflicts(ctx);
    expect(conflicts.find((c) => c.type === "past-due" && c.lineId === "late")).toBeTruthy();
  });

  it("does not flag a line that ends before its due date", () => {
    const ctx = buildContext([
      line({
        id: "ontime",
        jobNo: "J1",
        employeeId: "bob",
        departmentId: "metal",
        start: at(0, 8),
        estimatedHours: 4,
        customerDueDate: at(5, 17),
      }),
    ]);
    expect(detectConflicts(ctx).filter((c) => c.type === "past-due")).toHaveLength(0);
  });
});

describe("detectConflicts — employee-overlap", () => {
  it("flags two tasks that overlap on the same employee", () => {
    const ctx = buildContext([
      line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 6 }),
      line({ id: "b", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 12), estimatedHours: 2 }),
    ]);
    const conflicts = detectConflicts(ctx);
    expect(conflicts.find((c) => c.type === "employee-overlap")).toBeTruthy();
  });

  it("does not flag adjacent (non-overlapping) tasks", () => {
    const ctx = buildContext([
      line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 2 }),
      line({ id: "b", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 10), estimatedHours: 2 }),
    ]);
    expect(detectConflicts(ctx).filter((c) => c.type === "employee-overlap")).toHaveLength(0);
  });
});

describe("detectConflicts — department-order", () => {
  it("flags Paint starting before Metal ends within the same job", () => {
    const ctx = buildContext([
      line({ id: "metal", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 6 }),
      line({ id: "paint", jobNo: "J1", employeeId: "tom", departmentId: "paint", start: at(0, 12), estimatedHours: 2 }),
    ]);
    const conflicts = detectConflicts(ctx);
    expect(conflicts.find((c) => c.type === "department-order" && c.lineId === "paint")).toBeTruthy();
  });

  it("does not flag flow order across different jobs", () => {
    const ctx = buildContext([
      line({ id: "metalJ1", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 6 }),
      line({ id: "paintJ2", jobNo: "J2", employeeId: "tom", departmentId: "paint", start: at(0, 8), estimatedHours: 2 }),
    ]);
    expect(detectConflicts(ctx).filter((c) => c.type === "department-order")).toHaveLength(0);
  });
});
