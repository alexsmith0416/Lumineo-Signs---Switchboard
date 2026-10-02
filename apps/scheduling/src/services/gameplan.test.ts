import { describe, expect, it } from "vitest";
import {
  autofill,
  bookedByWeek,
  buildPools,
  installWork,
  neededByOf,
  stageOf,
  type PlanCandidate,
  type PlanJob,
  type PlanStep,
} from "./gameplan";

const TODAY = new Date(2026, 9, 7, 10); // Wed Oct 7, 2026

const job = (o: Partial<PlanJob>): PlanJob => ({
  jobNo: "J1", name: "A", description: "", status: "MFG - Routing", installRegion: "WK", value: 10_000,
  redDate: "", scheduledInstall: "", installTarget: "", mfgFinalDate: "", inBc: true, tracked: true, ...o,
});
const steps = (...a: Array<[string, PlanStep["state"]]>) => a.map(([key, state]) => ({ key, state }));

describe("stages and dates", () => {
  it("needed-by is RED date, else Scheduled install, else Install Target", () => {
    expect(neededByOf({ redDate: "2026-10-01", scheduledInstall: "2026-10-05", installTarget: "2026-10-09" }).source).toBe("RED date");
    expect(neededByOf({ redDate: "", scheduledInstall: "2026-10-05", installTarget: "2026-10-09" }).date).toBe("2026-10-05");
    expect(neededByOf({ redDate: "", scheduledInstall: "", installTarget: "" }).date).toBe("");
  });
  it("ready = Install active; near = one production step left", () => {
    expect(stageOf(steps(["MF", "completed"], ["I", "active"]))).toBe("ready");
    expect(stageOf(steps(["MF", "completed"], ["P", "active"], ["I", "included"]))).toBe("near");
    expect(stageOf(steps(["MF", "active"], ["P", "included"], ["I", "included"]))).toBe("other");
  });
  it("install hours and crew size from the install lines", () => {
    expect(installWork([
      { description: "Install Labor", resourceNo: "WK 2 MAN - TBD", hours: 16 },
      { description: "Travel", resourceNo: "1141", hours: 4 },
    ])).toEqual({ hours: 20, crewPersons: 2 });
    // Two trips + travel, and a 4-man line that takes two crews.
    expect(installWork([
      { description: "Install Labor", resourceNo: "WK 2 MAN - TBD", hours: 8 },
      { description: "Install Labor - trip 2", resourceNo: "WK 2 MAN - TBD", hours: 8 },
      { description: "Travel", resourceNo: "WK 2 MAN - TBD", hours: 3 },
      { description: "Crane set", resourceNo: "WK 4 MAN - TBD", hours: 5 },
    ])).toEqual({ hours: 29, crewPersons: 4 });
  });
});

describe("buildPools", () => {
  const stepMap: Record<string, PlanStep[]> = {
    J1: steps(["MF", "completed"], ["I", "active"]),
    J2: steps(["MF", "completed"], ["P", "active"], ["I", "included"]),
    J3: steps(["MF", "active"], ["P", "included"], ["I", "included"]),
    J4: steps(["MF", "completed"], ["I", "completed"]),
    J5: steps(["MF", "completed"], ["I", "active"]),
  };
  const pools = buildPools({
    jobs: [
      job({ jobNo: "J1", redDate: "2026-10-01" }), // ready, past due
      job({ jobNo: "J2", installTarget: "2026-10-20" }), // near
      job({ jobNo: "J3", scheduledInstall: "2026-09-30" }), // early stage, past due
      job({ jobNo: "J4", redDate: "2026-09-01" }), // installed — out
      job({ jobNo: "J5", installTarget: "2026-10-30" }), // ready but already on the board
      job({ jobNo: "J6", status: "Complete Invoiced", redDate: "2026-09-01" }), // complete — out
    ],
    stepsFor: (j) => stepMap[j] ?? [],
    installLinesFor: () => [],
    onBoard: new Set(["J5"]),
    today: TODAY,
  });
  it("past due lists late, not-installed jobs, most late first", () => {
    expect(pools.pastDue.map((c) => [c.jobNo, c.daysLate])).toEqual([["J3", 7], ["J1", 6]]);
  });
  it("ready and near-complete leave out jobs already on an install board", () => {
    expect(pools.ready.map((c) => c.jobNo)).toEqual(["J1"]);
    expect(pools.near.map((c) => c.jobNo)).toEqual(["J2"]);
  });
});

describe("bookedByWeek", () => {
  const period = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 29) };
  it("bills each job once, in the week its install ends, at its value", () => {
    const slots = bookedByWeek([
      { jobNo: "J1", region: "WK", startDateTime: new Date(2026, 9, 5, 8), endDateTime: new Date(2026, 9, 5, 16), value: 5000, hours: 8 },
      { jobNo: "J1", region: "WK", startDateTime: new Date(2026, 9, 13, 8), endDateTime: new Date(2026, 9, 13, 16), value: 5000, hours: 8 },
      { jobNo: "J2", region: "NEK", startDateTime: new Date(2026, 9, 6, 8), endDateTime: new Date(2026, 9, 6, 12), value: 3000, hours: 4 },
    ], period);
    expect(slots.map((s) => s.total)).toEqual([0, 3000, 5000, 0, 0]); // weeks of Sep 28, Oct 5, 12, 19, 26
    expect(slots[1]).toMatchObject({ nek: 3000, hoursWK: 8, hoursNEK: 4 });
    expect(slots[2]).toMatchObject({ wk: 5000, hoursWK: 8 });
  });
});

describe("autofill", () => {
  const weeks = bookedByWeek([], { start: new Date(2026, 9, 1), end: new Date(2026, 9, 29) });
  const cand = (o: Partial<PlanCandidate>): PlanCandidate => ({
    jobNo: "J", name: "", description: "", status: "", region: "WK", value: 50_000, installHours: 16, crewPersons: 2,
    stage: "ready", neededBy: "", neededBySource: "", mfgFinalDate: "", onBoard: false, daysLate: 0, ...o,
  });
  it("puts past-due jobs first, from this week on, and stops at the goal", () => {
    const r = autofill({
      candidates: [cand({ jobNo: "A", neededBy: "2026-10-20" }), cand({ jobNo: "LATE", daysLate: 5, neededBy: "2026-10-02" }), cand({ jobNo: "B" })],
      weeks, goal: 100_000, crewHours: { WK: 80, NEK: 40 }, today: TODAY,
    });
    expect(r.placed.map((p) => p.candidate.jobNo)).toEqual(["LATE", "A"]);
    expect(r.placed[0]!.weekStart).toEqual(new Date(2026, 9, 5)); // this week, not the past week of Sep 28
    expect(r.skipped.map((s) => s.reason)).toEqual(["Goal already reached"]);
  });
  it("keeps a near-complete job until after its Mfg Final week, and respects crew hours", () => {
    const r = autofill({
      candidates: [cand({ jobNo: "N", stage: "near", mfgFinalDate: "2026-10-14" }), cand({ jobNo: "BIG", region: "NEK", installHours: 80 })],
      weeks, goal: 1_000_000, crewHours: { WK: 80, NEK: 40 }, today: TODAY,
    });
    expect(r.placed.map((p) => [p.candidate.jobNo, p.weekStart.getDate()])).toEqual([["N", 12]]);
    expect(r.skipped[0]!.reason).toMatch(/No NEK crew hours/);
  });
});
