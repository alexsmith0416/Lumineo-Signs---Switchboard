import { describe, expect, it } from "vitest";
import { driveHours, milesBetween, nearestLocation, parseZipCentroids, zipCenter, LUMINEO_LOCATIONS } from "./geo";
import { classifyPlannerJob, estimateDays, nearbyJobs, radiusGroups, type PlannerJob } from "./install-planner";

const HUTCH = { lat: 37.9782, lng: -97.9265 };
const job = (jobNo: string, pos: { lat: number; lng: number } | null, o: Partial<PlannerJob> = {}): PlannerJob => ({
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
// About 1 mile of latitude.
const north = (p: { lat: number; lng: number }, miles: number) => ({ lat: p.lat + miles / 69.05, lng: p.lng });

describe("geo", () => {
  it("measures miles and estimates drive time", () => {
    const wichita = LUMINEO_LOCATIONS.find((l) => l.name === "Wichita")!;
    const mi = milesBetween(HUTCH, wichita);
    expect(mi).toBeGreaterThan(38);
    expect(mi).toBeLessThan(45);
    expect(driveHours(HUTCH, wichita)).toBeCloseTo((mi * 1.25) / 55, 5);
  });

  it("finds the nearest location, optionally within a region", () => {
    expect(nearestLocation(north(HUTCH, 5)).name).toBe("Hutchinson");
    const olathe = LUMINEO_LOCATIONS.find((l) => l.name === "Olathe")!;
    expect(nearestLocation(olathe, "WK").region).toBe("WK");
  });

  it("never starts a trip from a location without crews (Salina)", () => {
    const salina = LUMINEO_LOCATIONS.find((l) => l.name === "Salina")!;
    expect(salina.crewBase).toBe(false);
    expect(nearestLocation(salina).name).not.toBe("Salina");
  });

  it("parses the ZIP table and looks up ZIP+4", () => {
    const t = parseZipCentroids("\n67501,37.9782,-97.9265\n66061,38.8938,-94.8800\n");
    expect(zipCenter(t, "67501-1234")).toEqual({ lat: 37.9782, lng: -97.9265 });
    expect(zipCenter(t, "99999")).toBeNull();
  });
});

describe("trip sizing", () => {
  it("day trips lose the drive out and back; overnights only drive at the ends", () => {
    expect(estimateDays(16, 1, false)).toBe(2); // 8 h of work a day
    expect(estimateDays(8, 1, false)).toBe(1);
    expect(estimateDays(16, 4.5, true)).toBe(3); // 16 + 9 = 25 h
    expect(estimateDays(0, 2, false)).toBe(1);
  });
});

describe("radius groups", () => {
  it("groups jobs within R of a center, not chains of touching circles", () => {
    // A chain 10 mi apart: A(0) B(10) C(20) D(30). R = 12.
    const jobs = [0, 10, 20, 30].map((m, i) => job(`J${i}`, north(HUTCH, m)));
    const groups = radiusGroups(jobs, 12);
    // No group may hold two jobs more than 2R apart.
    for (const g of groups) {
      for (const a of g.jobs) for (const b of g.jobs) expect(milesBetween(a.pos!, b.pos!)).toBeLessThanOrEqual(24.01);
    }
    expect(groups.flatMap((g) => g.jobs).length).toBe(4);
  });

  it("only groups ready / must jobs with a position, by region unless crossing", () => {
    const jobs = [
      job("R1", north(HUTCH, 1)),
      job("M1", north(HUTCH, 2), { state: "must" }),
      job("L1", north(HUTCH, 3), { state: "locked" }),
      job("S1", north(HUTCH, 4), { state: "scheduled" }),
      job("N1", null),
      job("K1", north(HUTCH, 5), { region: "NEK" }),
    ];
    const separate = radiusGroups(jobs, 50);
    expect(separate.map((g) => g.jobs.map((j) => j.jobNo).sort())).toEqual([["M1", "R1"], ["K1"]]);
    expect(separate[0]!.mustCount).toBe(1);
    const crossed = radiusGroups(jobs, 50, true);
    expect(crossed).toHaveLength(1);
  });

  it("sizes the trip from the nearest home location and flags overnights over 4 h one-way", () => {
    const near = radiusGroups([job("A", north(HUTCH, 10), { crewHours: 6 })], 25)[0]!;
    expect(near.home.name).toBe("Hutchinson");
    expect(near.overnight).toBe(false);
    expect(near.estDays).toBe(1);
    // ~200 mi straight north of Hutchinson → ~4.5 h estimated one-way.
    const far = radiusGroups([job("B", north(HUTCH, 200), { crewHours: 12 })], 25)[0]!;
    expect(far.oneWayHours).toBeGreaterThan(4);
    expect(far.overnight).toBe(true);
  });
});

describe("what fits near this job", () => {
  it("lists other plannable jobs within R, nearest first", () => {
    const a = job("A", HUTCH);
    const jobs = [a, job("B", north(HUTCH, 8)), job("C", north(HUTCH, 3)), job("D", north(HUTCH, 40)), job("E", north(HUTCH, 2), { state: "scheduled" })];
    expect(nearbyJobs(a, jobs, 20).map((r) => r.job.jobNo)).toEqual(["C", "B"]);
  });
});


describe("which jobs go on the map", () => {
  const base = {
    tracked: true,
    inBc: true,
    status: "MFG - Paint",
    service: false,
    lockedThisWeek: false,
    onBoard: false,
    mustThisWeek: false,
  };
  const steps = (install: "completed" | "active" | "included", extra: Array<{ key: string; state: "completed" | "active" | "included" }> = []) => [
    { key: "P", state: "completed" as const },
    ...extra,
    { key: "I", state: install },
  ];

  it("skips untracked, complete and installed jobs", () => {
    expect(classifyPlannerJob({ ...base, tracked: false, steps: steps("active") })).toBeNull();
    expect(classifyPlannerJob({ ...base, steps: steps("completed") })).toBeNull();
    expect(classifyPlannerJob({ ...base, steps: [{ key: "P", state: "active" }] })).toBeNull(); // no install
  });

  it("orders the states: locked > scheduled > must > ready > production", () => {
    expect(classifyPlannerJob({ ...base, steps: steps("active") })).toEqual({ kind: "install", state: "ready" });
    expect(classifyPlannerJob({ ...base, steps: steps("included") })!.state).toBe("production");
    expect(classifyPlannerJob({ ...base, mustThisWeek: true, steps: steps("included") })!.state).toBe("must");
    expect(classifyPlannerJob({ ...base, mustThisWeek: true, onBoard: true, steps: steps("active") })!.state).toBe("scheduled");
    expect(classifyPlannerJob({ ...base, onBoard: true, lockedThisWeek: true, steps: steps("active") })!.state).toBe("locked");
  });

  it("treats a service job by its Service step", () => {
    const svc = [{ key: "SU", state: "completed" as const }, { key: "SE", state: "active" as const }];
    expect(classifyPlannerJob({ ...base, service: true, steps: svc })).toEqual({ kind: "service", state: "ready" });
    expect(classifyPlannerJob({ ...base, service: true, steps: [{ key: "SE", state: "completed" as const }] })).toBeNull();
  });
});
