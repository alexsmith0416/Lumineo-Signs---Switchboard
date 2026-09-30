import { describe, expect, it } from "vitest";
import type { ScheduleLine } from "../engine/types";
import { planFullSync, type FullSyncInput, type LastPush } from "./bc-full-sync";

const card = (o: Partial<ScheduleLine>): ScheduleLine =>
  ({
    id: "c", jobNo: "J1", customerName: "", planningLineDescription: "", estimatedHours: 8, overrideHours: null,
    employeeId: "e1", departmentId: "d-mf", customerDueDate: null, isLocked: false, jobSequence: 0,
    startDateTime: new Date("2026-10-05T13:00:00Z"), endDateTime: new Date("2026-10-05T21:00:00Z"), ...o,
  }) as ScheduleLine;

const base = (o: Partial<FullSyncInput> = {}): FullSyncInput => ({
  jobNos: ["J1"],
  stepsByJob: new Map([["J1", [{ key: "R", state: "completed" as const }, { key: "MF", state: "active" as const }, { key: "P", state: "included" as const }]]]),
  productionCards: [card({})],
  installCards: [],
  departmentName: (id) => ({ "d-mf": "Metal Fab", "d-p": "Paint" })[id],
  productionResourceNo: (e) => (e === "e1" ? "1030" : ""),
  installResourceNo: () => "",
  lastPushes: [],
  ...o,
});

const last = (o: Partial<LastPush>): LastPush => ({
  kind: "state", jobNo: "J1", planningStep: "Routing", started: true, complete: true,
  startDateTime: null, endDateTime: null, assignedTo: "", createdOn: "2026-09-28T00:00:00Z", ...o,
});

describe("planFullSync", () => {
  it("sends every step's state plus dates only for steps on the calendar", () => {
    const plan = planFullSync(base());
    const byStep = Object.fromEntries(plan.pushes.map((p) => [`${p.kind}:${p.planningStep}`, p]));
    expect(byStep["state:Routing"]).toMatchObject({ started: true, complete: true });
    expect(byStep["state:Fabrication"]).toMatchObject({ started: true, complete: false });
    expect(byStep["state:Painting"]).toMatchObject({ started: false, complete: false });
    expect(byStep["schedule:Fabrication"]).toMatchObject({ assignedTo: "1030", startDateTime: "2026-10-05T13:00:00.000Z" });
    expect(byStep["schedule:Painting"]).toBeUndefined(); // no Paint cards → no dates
    expect(plan).toMatchObject({ jobs: 1, stateChanges: 3, scheduleChanges: 1, unchanged: 0 });
  });

  it("skips anything identical to the last push for that step", () => {
    const plan = planFullSync(base({
      lastPushes: [
        last({}),
        last({ planningStep: "Fabrication", complete: false }),
        last({ kind: "schedule", planningStep: "Fabrication", startDateTime: "2026-10-05T13:00:00Z", endDateTime: "2026-10-05T21:00:00Z", assignedTo: "1030" }),
      ],
    }));
    expect(plan.pushes.map((p) => `${p.kind}:${p.planningStep}`)).toEqual(["state:Painting"]);
    expect(plan.unchanged).toBe(3);
  });

  it("compares against the NEWEST earlier push", () => {
    const plan = planFullSync(base({
      lastPushes: [
        last({ planningStep: "Routing", complete: true, createdOn: "2026-09-28T00:00:00Z" }),
        last({ planningStep: "Routing", complete: false, createdOn: "2026-09-29T00:00:00Z" }),
      ],
    }));
    expect(plan.pushes.some((p) => p.kind === "state" && p.planningStep === "Routing")).toBe(true);
  });

  it("only syncs the jobs asked for, and sends install dates from install cards", () => {
    const plan = planFullSync(base({
      jobNos: ["J1"],
      productionCards: [card({ jobNo: "J2" })],
      installCards: [card({ id: "i", employeeId: "crew", departmentId: "0" }), card({ id: "s", shipmentLoadId: "load1" })],
      stepsByJob: new Map(),
      installResourceNo: (e) => (e === "crew" ? "1141" : ""),
    }));
    expect(plan.pushes).toHaveLength(1);
    expect(plan.pushes[0]).toMatchObject({ kind: "schedule", planningStep: "Install", assignedTo: "1141" });
  });
});
