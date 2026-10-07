import { describe, expect, it } from "vitest";
import { buildDepartmentSteps } from "./production-steps";
import { buildServiceSteps, isServiceOrderType } from "./service-steps";
import { bcStepStates, jobCompleteForBc } from "./bc-planning-sync";
import { passedLifecycleSteps, planStatusBackfill, stepsToComplete } from "./job-status";
import { companyFlow, effectiveFlow, flowFromRules, stepOrder } from "./job-flow";
import { DEFAULT_STATUS_RULES } from "./status-rules";

const keys = (s: ReadonlyArray<{ key: string }>) => s.map((x) => x.key);
const st = (key: string, state: "completed" | "active" | "included") => ({ key, state });
const FLOW = { stages: flowFromRules(DEFAULT_STATUS_RULES).stages, doneStatus: "Complete Invoiced" };

describe("the production lifecycle stepper", () => {
  it("puts the lifecycle stages around a production job's departments", () => {
    const steps = buildDepartmentSteps(["Routing", "Paint"], new Set(), true);
    expect(keys(steps)).toEqual(["NO", "UM", "PU", "R", "P", "RI", "I", "CP", "CA", "CI"]);
    expect(steps[0]!.state).toBe("active"); // a new job starts at New Order
    expect(steps.find((s) => s.key === "NO")!.lifecycle).toBe(true);
    expect(steps.find((s) => s.key === "R")!.lifecycle).toBeUndefined();
  });

  it("leaves out Ready for Install when there's no install work", () => {
    expect(keys(buildDepartmentSteps(["Vinyl"], new Set(), false))).toEqual(["NO", "UM", "PU", "V", "CP", "CA", "CI"]);
  });

  it("gives a service-only job no lifecycle stages; a service job with departments keeps them", () => {
    expect(keys(buildDepartmentSteps([], new Set(), true, {}, undefined, true))).toEqual(["I"]);
    expect(keys(buildDepartmentSteps(["Paint"], new Set(), false, {}, undefined, true))).toContain("NO");
  });

  it("lets an editor remove a lifecycle stage", () => {
    const steps = buildDepartmentSteps(["Paint"], new Set(), false, { PU: { included: false, active: false } });
    expect(keys(steps)).not.toContain("PU");
  });
});

describe("the Service stepper", () => {
  it("is for SERVICE, SIGNCONT and MNTCCONT jobs", () => {
    for (const t of ["SERVICE", "SIGNCONT", "mntccont", " SERVICE "]) expect(isServiceOrderType(t)).toBe(true);
    for (const t of ["SALES", "GRAPHICS", "", undefined]) expect(isServiceOrderType(t)).toBe(false);
  });

  it("runs Survey → Service → Complete to Admin → Complete Invoiced", () => {
    const steps = buildServiceSteps(new Set(["SU"]));
    expect(keys(steps)).toEqual(["SU", "SE", "SA", "SI"]);
    expect(steps.map((s) => s.state)).toEqual(["completed", "active", "included", "included"]);
    expect(keys(buildServiceSteps(new Set(), { SU: { included: false, active: false } }))).toEqual(["SE", "SA", "SI"]);
  });
});

describe("BC write-back for the new stages", () => {
  it("pushes the stages with a known BC step; the main Production step heads departments only", () => {
    const states = bcStepStates([st("NO", "completed"), st("UM", "active"), st("R", "included"), st("CA", "included"), st("SE", "active")]);
    const by = new Map(states.map((s) => [s.step, s]));
    expect(by.get("New Order This Week")).toMatchObject({ started: true, complete: true });
    expect(by.get("Upcoming Manufacturing")).toMatchObject({ started: true, complete: false });
    expect(by.get("Service")).toMatchObject({ started: true, complete: false });
    expect(by.get("Production")).toMatchObject({ started: false, complete: false, keys: ["R"] });
    expect([...by.keys()]).not.toContain("Complete to Admin"); // not mapped yet
  });

  it("completes the BC job at Complete to Admin, not at Complete Invoiced", () => {
    const all = ["NO", "R", "I", "CP", "CA", "CI"];
    expect(jobCompleteForBc(all, new Set(["NO", "R", "I", "CP", "CA"]))).toBe(true);
    expect(jobCompleteForBc(all, new Set(["NO", "R", "I", "CP"]))).toBe(false);
    // A service-only job: its own Complete to Admin.
    expect(jobCompleteForBc(["SU", "SE", "SA", "SI"], new Set(["SU", "SE", "SA"]))).toBe(true);
    // Both steppers: both Complete to Admins.
    expect(jobCompleteForBc(["CA", "SA"], new Set(["CA"]))).toBe(false);
    // No Complete to Admin on the stepper: every step, as before.
    expect(jobCompleteForBc(["R", "I"], new Set(["R", "I"]))).toBe(true);
  });
});

describe("picking a Current Status", () => {
  const job = [st("NO", "active"), st("UM", "included"), st("PU", "included"), st("S", "included"), st("R", "included"), st("RI", "included"), st("I", "included"), st("CP", "included"), st("CA", "included"), st("CI", "included")];

  it("a department status completes the lifecycle stages before it — never other departments", () => {
    expect(stepsToComplete("MFG - Routing", job, FLOW)).toEqual(["NO", "UM", "PU"]);
  });

  it("a status past production completes everything before it", () => {
    expect(stepsToComplete("Ready for Install", job, FLOW)).toEqual(["NO", "UM", "PU", "S", "R"]);
    // Complete to Admin = with Admin: everything up to and including Complete to Admin.
    expect(stepsToComplete("Complete to Admin", job, FLOW)).toEqual(["NO", "UM", "PU", "S", "R", "RI", "I", "CP", "CA"]);
    expect(stepsToComplete("Complete Invoiced", job, FLOW)).toHaveLength(10);
  });

  it("Upcoming Mfg. completes New Order", () => {
    expect(stepsToComplete("Upcoming Mfg.", job, FLOW)).toEqual(["NO"]);
  });

  it("service statuses move the Service stepper", () => {
    const svc = [...job, st("SU", "active"), st("SE", "included"), st("SA", "included"), st("SI", "included")];
    expect(stepsToComplete("Service Complete to Admin", svc, FLOW)).toEqual(["SU", "SE", "SA"]);
  });

  it("statuses outside the flow keep the older rules", () => {
    expect(stepsToComplete("Installation", job)).toEqual(["NO", "UM", "PU", "S", "R", "RI"]);
  });
});

describe("the lifecycle backfill", () => {
  it("ticks the lifecycle stages before a completed step", () => {
    expect(passedLifecycleSteps([st("NO", "active"), st("UM", "included"), st("R", "completed"), st("P", "included")])).toEqual(["NO", "UM"]);
    expect(passedLifecycleSteps([st("NO", "active"), st("R", "included")])).toEqual([]);
  });

  it("plans from the status and from completed steps together", () => {
    const steps = [st("NO", "active"), st("UM", "included"), st("PU", "included"), st("R", "included"), st("P", "included")];
    const plan = planStatusBackfill([{ jobNo: "J1", status: "MFG - Paint Prep / Paint" }, { jobNo: "J2", status: "New Order this week" }], () => steps, () => FLOW);
    expect(plan).toEqual([{ jobNo: "J1", status: "MFG - Paint Prep / Paint", keys: ["NO", "UM", "PU"], allKeys: keys(steps), kind: "lifecycle" }]);
  });
});

describe("a company flow saved before the lifecycle stages", () => {
  const saved = {
    stages: [
      { step: "R", status: "MFG - Routing" },
      { step: "P", status: "MFG - Paint Prep / Paint" },
      { step: "I", status: "Install - waiting on product" },
    ],
    doneStatus: "Complete-need paperwork",
  };

  it("gets the lifecycle stages in their default places — New Order first, Complete Invoiced last", () => {
    const company = companyFlow(saved);
    const flow = effectiveFlow(company, null, ["NO", "UM", "PU", "R", "P", "RI", "I", "CP", "CA", "CI"]);
    expect(stepOrder(flow)).toEqual(["NO", "UM", "PU", "R", "P", "RI", "I", "CP", "CA", "CI"]);
  });

  it("moves the old done status to Complete Invoiced", () => {
    expect(companyFlow(saved).doneStatus).toBe("Complete Invoiced");
    expect(companyFlow({ ...saved, doneStatus: "Billboards" }).doneStatus).toBe("Billboards");
  });
});
