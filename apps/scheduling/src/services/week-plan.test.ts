import { describe, expect, it } from "vitest";
import { LUMINEO_LOCATIONS } from "./geo";
import { cardsFor, planWeek, type PlanCrew, type WeekPlanInput } from "./week-plan";
import type { PlannerJob } from "./install-planner";

const HUTCH = LUMINEO_LOCATIONS.find((l) => l.name === "Hutchinson")!;
const away = (miles: number, east = 0) => ({ lat: HUTCH.lat + miles / 69.05, lng: HUTCH.lng + east / 54.5 });
const job = (jobNo: string, pos: { lat: number; lng: number }, o: Partial<PlannerJob> = {}): PlannerJob => ({
  jobNo,
  name: jobNo,
  kind: "install",
  region: "WK",
  state: "ready",
  pos,
  approx: false,
  address: "",
  zip: "",
  crewHours: 4,
  scheduledDate: "",
  ...o,
});
const crew = (id: string, base = "Hutchinson"): PlanCrew => ({ id, name: id, base, region: "WK" });
const input = (o: Partial<WeekPlanInput>): WeekPlanInput => ({
  jobs: [],
  crews: [crew("c1")],
  busy: new Map(),
  radiusMi: 30,
  combineService: false,
  allowOvernight: true,
  maxNights: 2,
  crossRegions: false,
  ...o,
});

describe("auto-plan the week", () => {
  it("puts nearby ready jobs on one crew's trip from its location", () => {
    const p = planWeek(input({ jobs: [job("A", away(5)), job("B", away(6)), job("C", away(7))] }));
    expect(p.assignments).toHaveLength(1);
    expect(p.assignments[0]!.trip.home.name).toBe("Hutchinson");
    expect(p.assignments[0]!.crewId).toBe("c1");
    expect(p.stats.jobs).toBe(3);
    expect(p.unplaced).toEqual([]);
  });

  it("keeps busy days free and says why a job didn't fit", () => {
    const busy = new Map([["c1", new Set([0, 1, 2, 3, 4])]]);
    const p = planWeek(input({ jobs: [job("A", away(5))], busy }));
    expect(p.assignments).toEqual([]);
    expect(p.unplaced[0]!.reason).toMatch(/No crew free/);
    const partly = planWeek(input({ jobs: [job("A", away(5))], busy: new Map([["c1", new Set([0, 1])]]) }));
    expect(partly.assignments[0]!.startDay).toBe(2);
  });

  it("plans Must this week before ready jobs when crews run short", () => {
    // Two far-apart jobs, each a full day; one crew with one free day.
    const busy = new Map([["c1", new Set([1, 2, 3, 4])]]);
    const p = planWeek(
      input({ jobs: [job("R", away(5), { crewHours: 8 }), job("M", away(-60, 40), { crewHours: 5, state: "must" })], busy }),
    );
    expect(p.assignments.map((a) => a.trip.stops[0]!.jobNo)).toEqual(["M"]);
    expect(p.stats.mustJobs).toBe(1);
    expect(p.unplaced.map((u) => u.job.jobNo)).toEqual(["R"]);
  });

  it("keeps install and service apart unless combining", () => {
    const jobs = [job("I", away(5)), job("S", away(6), { kind: "service" })];
    expect(planWeek(input({ jobs, crews: [crew("c1"), crew("c2")] })).assignments).toHaveLength(2);
    expect(planWeek(input({ jobs, crews: [crew("c1"), crew("c2")], combineService: true })).assignments).toHaveLength(1);
  });

  it("can't reach far jobs without overnights — and can with them", () => {
    const far = [job("F", away(260), { crewHours: 6 })]; // ~5.9 h one-way
    const day = planWeek(input({ jobs: far, allowOvernight: false }));
    expect(day.assignments).toEqual([]);
    expect(day.unplaced[0]!.reason).toMatch(/allow overnights/);
    const night = planWeek(input({ jobs: far, allowOvernight: true }));
    expect(night.assignments).toHaveLength(1);
    expect(night.stats.nights).toBeGreaterThan(0);
  });

  it("spreads trips over the location's crews so they start early", () => {
    // Two far-apart day-long trips, two crews: both start Monday on different crews.
    const p = planWeek(
      input({ jobs: [job("A", away(5), { crewHours: 8 }), job("B", away(-60, 40), { crewHours: 5 })], crews: [crew("c1"), crew("c2")] }),
    );
    expect(p.assignments.map((a) => a.startDay)).toEqual([0, 0]);
    expect(new Set(p.assignments.map((a) => a.crewId)).size).toBe(2);
  });

  it("only starts trips where there are crews", () => {
    const p = planWeek(input({ jobs: [job("A", away(5))], crews: [crew("w1", "Wichita")] }));
    expect(p.assignments[0]!.trip.home.name).toBe("Wichita");
    const none = planWeek(input({ jobs: [job("A", away(5))], crews: [] }));
    expect(none.unplaced[0]!.reason).toMatch(/No WK crews/);
  });

  it("turns a trip into board cards at the times the crew gets there", () => {
    const p = planWeek(input({ jobs: [job("A", away(5), { crewHours: 3 })] }));
    const cards = cardsFor(p.assignments[0]!, 7);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.day).toBe(0);
    expect(cards[0]!.start).toBeGreaterThan(7); // after the drive out
    expect(cards[0]!.hours).toBe(3);
  });
});
