import { describe, expect, it } from "vitest";
import { buildDepartmentSteps } from "./production-steps";
import { buildServiceSteps, isServiceOrderType } from "./service-steps";
import { bcStepStates, buildStepStatePush, jobCompleteForBc, type BcStepState } from "./bc-planning-sync";
import { planStatusBackfill, statusDates, stepsToComplete, stepsToReopen } from "./job-status";
import { adjustForStatus, BC_LIFECYCLE, lifecycleBcStates, statusRank } from "./status-lifecycle";
import { planFullSync } from "./bc-full-sync";

const keys = (s: ReadonlyArray<{ key: string }>) => s.map((x) => x.key);
const st = (key: string, state: "completed" | "active" | "included") => ({ key, state });
const byStep = (xs: readonly BcStepState[]) => new Map(xs.map((s) => [s.step, { started: s.started, complete: s.complete }]));

describe("the stepper is departments + Install only (Oct 7)", () => {
  it("has no lifecycle stages", () => {
    expect(keys(buildDepartmentSteps(["Routing", "Paint"], new Set(), true))).toEqual(["R", "P", "I"]);
    expect(buildDepartmentSteps(["Routing"], new Set(), true)[0]!.state).toBe("active");
  });
});

describe("Current Status → BC lifecycle steps", () => {
  it("ranks the lifecycle statuses; holds and specials don't move it", () => {
    expect(statusRank("New Order this week")).toBe(0);
    expect(statusRank("Upcoming Mfg.")).toBe(1);
    expect(statusRank("Mfg. Ready for Planning")).toBe(2);
    expect(statusRank("MFG - Routing")).toBe(3);
    expect(statusRank("Manufacturing")).toBe(3);
    expect(statusRank("Install - Ready for Planning")).toBe(4);
    expect(statusRank("install - ready for planning ")).toBe(4);
    expect(statusRank("Installation")).toBe(5);
    expect(statusRank("Complete-need paperwork")).toBe(6);
    expect(statusRank("Complete to Admin")).toBe(7);
    expect(statusRank("Complete Invoiced")).toBe(8);
    for (const s of ["Hold - Customer", "Service or Contract Order", "Needs Shipped", ""]) expect(statusRank(s)).toBeNull();
  });

  it("each status Starts its own step and completes the ones before it", () => {
    const up = byStep(lifecycleBcStates("Upcoming Mfg."));
    expect(up.get(BC_LIFECYCLE.newOrder)).toEqual({ started: true, complete: true });
    expect(up.get(BC_LIFECYCLE.upcoming)).toEqual({ started: true, complete: false });
    expect(up.get(BC_LIFECYCLE.readyForPlanning)).toEqual({ started: false, complete: false });
    const prod = byStep(lifecycleBcStates("MFG - Paint Prep / Paint"));
    for (const s of [BC_LIFECYCLE.newOrder, BC_LIFECYCLE.upcoming, BC_LIFECYCLE.readyForPlanning]) {
      expect(prod.get(s)).toEqual({ started: true, complete: true });
    }
    expect(prod.get(BC_LIFECYCLE.installReady)).toEqual({ started: false, complete: false });
  });

  it("Install - Ready for Planning starts Product Ready for Install Scheduling; Installation completes it", () => {
    expect(byStep(lifecycleBcStates("Install - Ready for Planning")).get(BC_LIFECYCLE.installReady)).toEqual({ started: true, complete: false });
    expect(byStep(lifecycleBcStates("Installation")).get(BC_LIFECYCLE.installReady)).toEqual({ started: true, complete: true });
  });

  it("Install - waiting on product starts its own step, and completes it once the job moves on from it", () => {
    expect(byStep(lifecycleBcStates("Install - waiting on product")).get(BC_LIFECYCLE.installWaiting)).toEqual({ started: true, complete: false });
    expect(byStep(lifecycleBcStates("Installation", "Install - waiting on product")).get(BC_LIFECYCLE.installWaiting)).toEqual({ started: true, complete: true });
    // A job that never waited on product doesn't get the step created.
    expect(byStep(lifecycleBcStates("Installation", "Install - Ready for Planning")).has(BC_LIFECYCLE.installWaiting)).toBe(false);
  });

  it("MFG - Vinyl Install starts Vinyl Install Only and completes BC Vinyl", () => {
    expect(byStep(lifecycleBcStates("MFG - Vinyl Install")).get(BC_LIFECYCLE.vinylInstallOnly)).toEqual({ started: true, complete: false });
    expect(byStep(lifecycleBcStates("Complete-need paperwork", "MFG - Vinyl Install")).get(BC_LIFECYCLE.vinylInstallOnly)).toEqual({ started: true, complete: true });
    const adjusted = byStep(adjustForStatus(bcStepStates([st("V", "active"), st("I", "active")]), "MFG - Vinyl Install"));
    expect(adjusted.get("Vinyl")).toEqual({ started: true, complete: true });
    expect(adjusted.get("Install")).toEqual({ started: false, complete: false });
  });

  it("BC Install isn't Started before Installation, even with Install active on the stepper", () => {
    const steps = [st("R", "completed"), st("I", "active")];
    expect(byStep(adjustForStatus(bcStepStates(steps), "Install - Ready for Planning")).get("Install")).toEqual({ started: false, complete: false });
    expect(byStep(adjustForStatus(bcStepStates(steps), "Installation")).get("Install")).toEqual({ started: true, complete: false });
    // A status outside the lifecycle leaves the stepper's state alone.
    expect(byStep(adjustForStatus(bcStepStates(steps), "Hold - Customer")).get("Install")).toEqual({ started: true, complete: false });
  });

  it("Complete-need paperwork starts it; Complete to Admin completes it", () => {
    expect(byStep(lifecycleBcStates("Complete-need paperwork")).get(BC_LIFECYCLE.needPaperwork)).toEqual({ started: true, complete: false });
    expect(byStep(lifecycleBcStates("Complete to Admin")).get(BC_LIFECYCLE.needPaperwork)).toEqual({ started: true, complete: true });
  });

  it("moving BACK re-opens the later steps", () => {
    const back = byStep(lifecycleBcStates("Upcoming Mfg.", "MFG - Routing"));
    expect(back.get(BC_LIFECYCLE.readyForPlanning)).toEqual({ started: false, complete: false });
    expect(back.get(BC_LIFECYCLE.needPaperwork)).toEqual({ started: false, complete: false });
  });

  it("a hold changes nothing in BC", () => {
    expect(lifecycleBcStates("Hold - Customer")).toEqual([]);
  });

  it("stamps the mover's Resource No. as Completed By — only on a Complete row", () => {
    const done = buildStepStatePush({ jobNo: "J1", state: { step: "Upcoming Manufacturing", started: true, complete: true, keys: [] }, completedBy: "1143" });
    const open = buildStepStatePush({ jobNo: "J1", state: { step: "Upcoming Manufacturing", started: true, complete: false, keys: [] }, completedBy: "1143" });
    expect(done!.assignedTo).toBe("1143");
    expect(open!.assignedTo).toBe("");
  });
});

describe("Current Status → the stepper", () => {
  const job = [st("S", "completed"), st("R", "active"), st("V", "included"), st("I", "included")];

  it("install statuses complete every step before Install; complete statuses everything", () => {
    for (const s of ["Install - Ready for Planning", "Install - waiting on product", "Installation"]) {
      expect(stepsToComplete(s, job)).toEqual(["R", "V"]);
    }
    expect(stepsToComplete("Complete to Admin", job)).toEqual(["R", "V", "I"]);
    expect(stepsToComplete("MFG - Routing", job)).toEqual([]);
  });

  it("MFG - Vinyl Install completes the steps before Vinyl", () => {
    expect(stepsToComplete("MFG - Vinyl Install", job)).toEqual(["R"]);
  });

  it("moving back from a complete status re-opens Install", () => {
    const done = [st("R", "completed"), st("I", "completed")];
    expect(stepsToReopen("Complete-need paperwork", "Installation", done)).toEqual(["I"]);
    expect(stepsToReopen("Installation", "MFG - Routing", done)).toEqual([]);
    expect(stepsToReopen("Complete to Admin", "Complete-need paperwork", done)).toEqual([]);
  });

  it("fills Date Installed at Complete-need paperwork or later (once), Date to Admin at Complete to Admin", () => {
    expect(statusDates("Complete-need paperwork", { dateInstalled: "", dateToAdmin: "" }, "2026-10-07")).toEqual({ dateInstalled: "2026-10-07" });
    expect(statusDates("Complete-need paperwork", { dateInstalled: "2026-10-01", dateToAdmin: "" }, "2026-10-07")).toEqual({});
    // Installation → Complete to Admin directly: both dates.
    expect(statusDates("Complete to Admin", { dateInstalled: "", dateToAdmin: "" }, "2026-10-07")).toEqual({ dateInstalled: "2026-10-07", dateToAdmin: "2026-10-07" });
    expect(statusDates("Installation", { dateInstalled: "", dateToAdmin: "" }, "2026-10-07")).toEqual({});
  });

  it("Match steppers plans complete / install / vinyl jobs", () => {
    const plan = planStatusBackfill(
      [{ jobNo: "J1", status: "Installation" }, { jobNo: "J2", status: "MFG - Vinyl Install" }, { jobNo: "J3", status: "MFG - Routing" }],
      () => job,
    );
    expect(plan.map((p) => [p.jobNo, p.kind, p.keys])).toEqual([["J1", "install", ["R", "V"]], ["J2", "vinyl", ["R"]]]);
  });
});

describe("Sync to BC covers the lifecycle", () => {
  it("adds the status's lifecycle steps and skips resets for steps never pushed", () => {
    const plan = planFullSync({
      jobNos: ["J1"],
      stepsByJob: new Map([["J1", [st("R", "active")]]]),
      productionCards: [],
      installCards: [],
      departmentName: () => undefined,
      productionResourceNo: () => "",
      installResourceNo: () => "",
      lastPushes: [],
      statusByJob: new Map([["J1", "MFG - Routing"]]),
    });
    const steps = plan.pushes.map((p) => p.planningStep);
    expect(steps).toContain("New Order This Week");
    expect(steps).toContain("Manufacturing Ready for Planning");
    expect(steps).not.toContain("Complete-Need Paperwork"); // a reset for a step BC never got
  });
});

describe("the Service stepper", () => {
  it("is for SERVICE, SIGNCONT and MNTCCONT jobs", () => {
    for (const t of ["SERVICE", "SIGNCONT", "mntccont", " SERVICE "]) expect(isServiceOrderType(t)).toBe(true);
    for (const t of ["SALES", "GRAPHICS", "", undefined]) expect(isServiceOrderType(t)).toBe(false);
  });

  it("runs Survey → Service → Complete to Admin → Complete Invoiced", () => {
    expect(keys(buildServiceSteps(new Set(["SU"])))).toEqual(["SU", "SE", "SA", "SI"]);
  });

  it("only a service job's own Complete to Admin completes the BC job from the stepper", () => {
    expect(jobCompleteForBc(["SU", "SE", "SA", "SI"], new Set(["SU", "SE", "SA"]))).toBe(true);
    expect(jobCompleteForBc(["R", "I"], new Set(["R", "I"]))).toBe(false); // production: the status decides
  });
});
