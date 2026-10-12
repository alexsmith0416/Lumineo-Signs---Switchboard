import { describe, expect, it } from "vitest";
import { comparePlans } from "./saved-plans";
import type { Assignment, WeekStats } from "./week-plan";

const stats = (o: Partial<WeekStats>): WeekStats => ({
  jobs: 0,
  value: 0,
  mustJobs: 0,
  mustTotal: 0,
  crewHours: 0,
  driveHours: 0,
  miles: 0,
  nights: 0,
  crewDays: 0,
  unplaced: 0,
  ...o,
});
const withJobs = (...jobNos: string[]) =>
  [{ trip: { stops: jobNos.map((jobNo) => ({ jobNo })) } }] as unknown as Assignment[];

describe("comparing two plans", () => {
  it("picks the better plan per row (more jobs, less driving) and lists the differences", () => {
    const a = { assignments: withJobs("J1", "J2", "J3"), stats: stats({ jobs: 3, driveHours: 9, nights: 1 }) };
    const b = { assignments: withJobs("J1", "J4"), stats: stats({ jobs: 2, driveHours: 5, nights: 1 }) };
    const c = comparePlans(a, b);
    expect(c.rows.find((r) => r.label === "Jobs planned")!.winner).toBe("a");
    expect(c.rows.find((r) => r.label === "Drive hours")!.winner).toBe("b");
    expect(c.rows.find((r) => r.label === "Nights away")!.winner).toBe("");
    expect(c.onlyA).toEqual(["J2", "J3"]);
    expect(c.onlyB).toEqual(["J4"]);
  });
});
