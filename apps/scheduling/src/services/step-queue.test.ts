import { describe, expect, it } from "vitest";
import { buildStepQueue, PRODUCTION_QUEUE_STEPS, type StepQueueJob } from "./step-queue";

const job = (jobNo: string, o: Partial<StepQueueJob> = {}): StepQueueJob =>
  ({ jobNo, name: `Cust ${jobNo}`, description: "Pylon", installRegion: "WK", value: 1000, ...o });

type St = "completed" | "active" | "included";
const steps = (...a: Array<[string, St]>) => a.map(([key, state]) => ({ key, state }));

const lines = new Map([
  ["J1", [
    { departmentName: "Metal Fab", isInstall: false, description: "Cabinet Metal Labor", hours: 12 },
    { departmentName: "Paint", isInstall: false, description: "Paint Cabinet Labor", hours: 6 },
    { departmentName: "", isInstall: true, description: "Install Labor", hours: 16 },
  ]],
]);

describe("buildStepQueue", () => {
  it("has a group per production BC step, in flow order", () => {
    expect(PRODUCTION_QUEUE_STEPS).toEqual(["Fabrication", "Routing", "Painting", "Vinyl", "Final Assembly"]);
  });

  it("lists a job under each step it's ACTIVE in, with that step's tasks and hours", () => {
    const groups = buildStepQueue({
      kind: "production",
      jobs: [job("J1")],
      stepsByJob: new Map([["J1", steps(["MF", "active"], ["P", "included"])]]),
      linesByJob: lines,
      scheduled: new Set(),
      departmentIdFor: (n) => `dept-${n}`,
    });
    const fab = groups.find((g) => g.step === "Fabrication")!;
    expect(fab.items).toHaveLength(1);
    expect(fab.items[0]).toMatchObject({
      jobNo: "J1", planningLineDescription: "Cabinet Metal Labor", estimatedHours: 12, departmentId: "dept-Metal Fab", scheduled: false,
    });
    expect(groups.find((g) => g.step === "Painting")!.items).toHaveLength(0);
  });

  it("tags jobs already on the calendar for that step, and lists them last", () => {
    const groups = buildStepQueue({
      kind: "production",
      jobs: [job("J1"), job("J0")],
      stepsByJob: new Map([["J1", steps(["MF", "active"])], ["J0", steps(["MF", "active"])]]),
      linesByJob: lines,
      scheduled: new Set(["J0|Fabrication"]),
      departmentIdFor: () => "",
    });
    expect(groups[0]!.items.map((i) => [i.jobNo, i.scheduled])).toEqual([["J1", false], ["J0", true]]);
  });

  it("puts jobs whose Install stage is active in their region's Ready for Install", () => {
    const input = {
      jobs: [job("J1"), job("J2", { installRegion: "NEK" })],
      stepsByJob: new Map([["J1", steps(["MF", "completed"], ["I", "active"])], ["J2", steps(["I", "active"])]]),
      linesByJob: lines,
      scheduled: new Set<string>(),
      departmentIdFor: () => "",
    };
    const wk = buildStepQueue({ ...input, kind: "install-wk" });
    expect(wk).toHaveLength(1);
    expect(wk[0]!.items.map((i) => i.jobNo)).toEqual(["J1"]);
    expect(wk[0]!.items[0]).toMatchObject({ planningLineDescription: "Install Labor", estimatedHours: 16 });
    expect(buildStepQueue({ ...input, kind: "install-nek" })[0]!.items.map((i) => i.jobNo)).toEqual(["J2"]);
  });

  it("gives a job with no planning lines a default 8h card", () => {
    const groups = buildStepQueue({
      kind: "production", jobs: [job("J9")], stepsByJob: new Map([["J9", steps(["R", "active"])]]),
      linesByJob: new Map(), scheduled: new Set(), departmentIdFor: () => "",
    });
    expect(groups.find((g) => g.step === "Routing")!.items[0]!.estimatedHours).toBe(8);
  });
});
