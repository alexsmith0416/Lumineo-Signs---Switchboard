import { describe, expect, it } from "vitest";
import { cloneContext, shiftTask, updateDuration } from "./cascade";
import { at, buildContext, line } from "./__fixtures__/build";

describe("cloneContext", () => {
  it("does not share schedule array reference", () => {
    const ctx = buildContext([
      line({ jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
    ]);
    const clone = cloneContext(ctx);
    expect(clone.schedule).not.toBe(ctx.schedule);
    expect(clone.schedule[0]).not.toBe(ctx.schedule[0]);
    expect(clone.employees).not.toBe(ctx.employees);
  });
});

describe("shiftTask — purity", () => {
  it("does not mutate the input context", () => {
    const original = line({
      id: "L1",
      jobNo: "J1",
      employeeId: "bob",
      departmentId: "metal",
      start: at(0, 8),
      estimatedHours: 4,
    });
    const ctx = buildContext([original]);
    const snapshot = ctx.schedule[0]!.startDateTime.getTime();

    shiftTask(ctx, "L1", at(1, 8), undefined, { cascade: true });

    expect(ctx.schedule[0]!.startDateTime.getTime()).toBe(snapshot);
  });
});

describe("shiftTask — same-employee queue cascade", () => {
  it("pushes Bob's later task when his earlier task moves forward into the overlap zone", () => {
    const ctx = buildContext([
      line({ id: "early", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 6 }),
      line({ id: "late", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 14), estimatedHours: 2 }),
    ]);

    const r = shiftTask(ctx, "early", at(0, 10), undefined, { cascade: true });

    const late = r.context.schedule.find((l) => l.id === "late")!;
    expect(late.startDateTime.getTime()).toBeGreaterThan(at(0, 14).getTime());
    expect(r.moved).toContain("late");
  });

  it("does not push tasks earlier than the target", () => {
    const ctx = buildContext([
      line({ id: "A", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 2 }),
      line({ id: "B", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(1, 8), estimatedHours: 4 }),
    ]);
    const r = shiftTask(ctx, "B", at(2, 8), undefined, { cascade: true });
    const A = r.context.schedule.find((l) => l.id === "A")!;
    expect(A.startDateTime.getTime()).toBe(at(0, 8).getTime());
  });
});

describe("shiftTask — department flow cascade", () => {
  it("pushes the later-flow Paint task when Metal task moves forward in the same job", () => {
    const ctx = buildContext([
      line({ id: "metal", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
      line({ id: "paint", jobNo: "J1", employeeId: "tom", departmentId: "paint", start: at(0, 13), estimatedHours: 3 }),
    ]);

    const r = shiftTask(ctx, "metal", at(0, 11), undefined, { cascade: true });

    const paint = r.context.schedule.find((l) => l.id === "paint")!;
    expect(paint.startDateTime.getTime()).toBeGreaterThanOrEqual(at(0, 15).getTime());
    expect(r.moved).toContain("paint");
  });

  it("does not push later-flow task in a different job", () => {
    const ctx = buildContext([
      line({ id: "metalJ1", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
      line({ id: "paintJ2", jobNo: "J2", employeeId: "tom", departmentId: "paint", start: at(0, 13), estimatedHours: 3 }),
    ]);

    const r = shiftTask(ctx, "metalJ1", at(0, 11), undefined, { cascade: true });

    const paintJ2 = r.context.schedule.find((l) => l.id === "paintJ2")!;
    expect(paintJ2.startDateTime.getTime()).toBe(at(0, 13).getTime());
  });
});

describe("shiftTask — locked tasks", () => {
  it("does not move a locked target", () => {
    const ctx = buildContext([
      line({ id: "locked", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4, isLocked: true }),
    ]);
    const r = shiftTask(ctx, "locked", at(1, 8), undefined, { cascade: true });
    const locked = r.context.schedule.find((l) => l.id === "locked")!;
    expect(locked.startDateTime.getTime()).toBe(at(0, 8).getTime());
  });

  it("does not push a locked downstream task", () => {
    const ctx = buildContext([
      line({ id: "metal", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
      line({ id: "paint", jobNo: "J1", employeeId: "tom", departmentId: "paint", start: at(0, 13), estimatedHours: 3, isLocked: true }),
    ]);
    const r = shiftTask(ctx, "metal", at(0, 11), undefined, { cascade: true });
    const paint = r.context.schedule.find((l) => l.id === "paint")!;
    expect(paint.startDateTime.getTime()).toBe(at(0, 13).getTime());
  });
});

describe("shiftTask — cascade=false", () => {
  it("moves only the target, leaving downstream alone", () => {
    const ctx = buildContext([
      line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
      line({ id: "b", jobNo: "J2", employeeId: "bob", departmentId: "metal", start: at(0, 14), estimatedHours: 2 }),
    ]);
    const r = shiftTask(ctx, "a", at(0, 10), undefined, { cascade: false });
    const b = r.context.schedule.find((l) => l.id === "b")!;
    expect(b.startDateTime.getTime()).toBe(at(0, 14).getTime());
  });
});

describe("updateDuration", () => {
  it("sets overrideHours and recomputes end time", () => {
    const ctx = buildContext([
      line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
    ]);
    const r = updateDuration(ctx, "a", 6, false);
    const a = r.context.schedule.find((l) => l.id === "a")!;
    expect(a.overrideHours).toBe(6);
    expect(a.endDateTime.getTime()).toBeGreaterThan(at(0, 12).getTime());
  });
});

describe("cascade — locked custom cards", () => {
  it("flows around a locked PTO card on the same employee", () => {
    const ctx = buildContext([
      line({
        id: "pto",
        jobNo: "PTO",
        employeeId: "bob",
        departmentId: "metal",
        start: at(2, 8),
        estimatedHours: 8,
        isLocked: true,
      }),
      line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 4 }),
    ]);
    // Move A forward so it would naturally collide with the locked PTO
    const r = shiftTask(ctx, "a", at(2, 8), undefined, { cascade: true });
    const pto = r.context.schedule.find((l) => l.id === "pto")!;
    expect(pto.startDateTime.getTime()).toBe(at(2, 8).getTime());
    expect(pto.isLocked).toBe(true);
  });
});
