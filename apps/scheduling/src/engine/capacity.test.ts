import { describe, expect, it } from "vitest";
import { effectiveHours, getDayCapacity, getHoursUsedOnDay, isWeekend } from "./capacity";
import { at, buildContext, line } from "./__fixtures__/build";

describe("isWeekend", () => {
  it("returns true for saturday and sunday", () => {
    expect(isWeekend(new Date("2026-06-06"))).toBe(true); // Sat
    expect(isWeekend(new Date("2026-06-07"))).toBe(true); // Sun
  });

  it("returns false for weekdays", () => {
    expect(isWeekend(new Date("2026-06-01"))).toBe(false); // Mon
  });
});

describe("getDayCapacity", () => {
  it("returns standard hours on a weekday", () => {
    const ctx = buildContext([]);
    const bob = ctx.employees.get("bob")!;
    expect(getDayCapacity(bob, at(0, 8), ctx)).toBe(8);
  });

  it("returns zero on weekend when worksWeekends is false", () => {
    const ctx = buildContext([]);
    const bob = ctx.employees.get("bob")!;
    expect(getDayCapacity(bob, at(5, 8), ctx)).toBe(0);
  });

  it("respects worksWeekends flag", () => {
    const ctx = buildContext([]);
    ctx.employees.set("bob", { ...ctx.employees.get("bob")!, worksWeekends: true });
    const bob = ctx.employees.get("bob")!;
    expect(getDayCapacity(bob, at(5, 8), ctx)).toBe(8);
  });

  it("adds overtime overrides", () => {
    const ctx = buildContext([]);
    ctx.overtime.push({ employeeId: "bob", date: "2026-06-01", extraHours: 3, costMultiplier: 1.5 });
    const bob = ctx.employees.get("bob")!;
    expect(getDayCapacity(bob, at(0, 8), ctx)).toBe(11);
  });

  it("scales available hours by time-efficiency", () => {
    const ctx = buildContext([]);
    // 8h/day at 80% efficiency = 6.4 usable hours.
    ctx.employees.set("bob", { ...ctx.employees.get("bob")!, productivityRate: 0.8 });
    const bob = ctx.employees.get("bob")!;
    expect(getDayCapacity(bob, at(0, 8), ctx)).toBeCloseTo(6.4, 5);
  });

  it("scales overtime by efficiency too", () => {
    const ctx = buildContext([]);
    ctx.employees.set("bob", { ...ctx.employees.get("bob")!, productivityRate: 0.5 });
    ctx.overtime.push({ employeeId: "bob", date: "2026-06-01", extraHours: 2, costMultiplier: 1.5 });
    const bob = ctx.employees.get("bob")!;
    expect(getDayCapacity(bob, at(0, 8), ctx)).toBe(5); // (8 + 2) * 0.5
  });

  it("treats efficiency 0 as 100% (legacy/blank, never zero capacity)", () => {
    const ctx = buildContext([]);
    ctx.employees.set("bob", { ...ctx.employees.get("bob")!, productivityRate: 0 });
    const bob = ctx.employees.get("bob")!;
    expect(getDayCapacity(bob, at(0, 8), ctx)).toBe(8);
  });
});

describe("effectiveHours", () => {
  it("returns raw hours — efficiency lives on the capacity side now", () => {
    const ctx = buildContext([]);
    const bob = { ...ctx.employees.get("bob")!, productivityRate: 0.8 };
    const l = line({ jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8 });
    expect(effectiveHours(l, bob)).toBe(8);
  });

  it("uses overrideHours when set", () => {
    const ctx = buildContext([]);
    const bob = { ...ctx.employees.get("bob")!, productivityRate: 1 };
    const l = line({ jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 8, overrideHours: 5 });
    expect(effectiveHours(l, bob)).toBe(5);
  });
});

describe("getHoursUsedOnDay", () => {
  it("sums hours from lines spanning the day", () => {
    const l1 = line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 6 });
    const used = getHoursUsedOnDay("bob", at(0, 12), [l1]);
    expect(used).toBe(6);
  });

  it("ignores given ignoreLineId", () => {
    const l1 = line({ id: "a", jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8), estimatedHours: 6 });
    expect(getHoursUsedOnDay("bob", at(0, 12), [l1], "a")).toBe(0);
  });
});
