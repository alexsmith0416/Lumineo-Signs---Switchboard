import { describe, expect, it } from "vitest";
import {
  addStage,
  applyTick,
  companyFlow,
  currentStage,
  effectiveFlow,
  flowFromRules,
  flowStatus,
  isFlowMovable,
  moveStage,
  parseStages,
  parseStagesDone,
  stageId,
  stepForStatus,
  stepOrder,
  updateStage,
  type FlowStage,
} from "./job-flow";
import { buildDepartmentSteps, orderSteps } from "./production-steps";
import { DEFAULT_STATUS_RULES } from "./status-rules";

const st = (step: string, status: string): FlowStage => ({ step, status });
const VINYL_CUT = st("V", "MFG - Vinyl Cut");
const VINYL_APP = st("V", "MFG - Vinyl Application");
const none = new Set<string>();

/** Alex's example (Oct 6): Vinyl split into Cut, then Application. */
const J34707: FlowStage[] = [
  st("R", "MFG - Routing"),
  st("MF", "MFG - Terry Metal Fab"),
  st("P", "MFG - Paint Prep / Paint"),
  VINYL_CUT,
  VINYL_APP,
  st("A", "MFG - Assembly"),
  st("I", "Install - waiting on product"),
];

describe("company flow", () => {
  it("starts from the old step → status rules, in stepper order", () => {
    const f = flowFromRules(DEFAULT_STATUS_RULES);
    // Lifecycle stages (Oct 7) around the departments.
    expect(stepOrder(f.stages)).toEqual(["NO", "UM", "PU", "MC", "S", "R", "MF", "P", "V", "A", "CR", "RI", "I", "CP", "CA", "CI"]);
    expect(f.stages.find((s) => s.step === "V")!.status).toBe("MFG - Vinyl Cut");
    expect(f.doneStatus).toBe("Complete Invoiced");
  });

  it("uses an edited rule until the flow itself is saved", () => {
    const f = companyFlow(undefined, { ...DEFAULT_STATUS_RULES, P: "MFG - Paint" });
    expect(f.stages.find((s) => s.step === "P")!.status).toBe("MFG - Paint");
  });

  it("reads a saved flow and falls back when it's damaged", () => {
    const saved = companyFlow({ stages: J34707, doneStatus: "Complete to Admin" });
    expect(saved.stages).toEqual(J34707);
    expect(saved.doneStatus).toBe("Complete to Admin");
    expect(companyFlow({ stages: "nope" }).stages).toEqual(flowFromRules().stages);
  });
});

describe("a job's flow", () => {
  const company = flowFromRules();

  it("is the company flow narrowed to the job's stepper steps", () => {
    const f = effectiveFlow(company, null, ["R", "P", "I"]);
    expect(f.map((s) => s.step)).toEqual(["R", "P", "I"]);
  });

  it("uses the job's own stages when an editor set them", () => {
    expect(effectiveFlow(company, J34707, ["R", "MF", "P", "V", "A", "I"])).toEqual(J34707);
  });

  it("drops stages for steps no longer on the stepper", () => {
    expect(effectiveFlow(company, J34707, ["R", "V", "I"]).map(stageId)).toEqual(
      [J34707[0], VINYL_CUT, VINYL_APP, J34707[6]].map((s) => stageId(s!)),
    );
  });

  it("fits a step added to the stepper later into its default place", () => {
    const own = [st("R", "MFG - Routing"), st("A", "MFG - Assembly")];
    const f = effectiveFlow(company, own, ["R", "P", "A"]);
    expect(f.map((s) => s.step)).toEqual(["R", "P", "A"]);
  });

  it("sets the stepper order (a reordered flow reorders the stepper)", () => {
    const own = [st("P", "MFG - Paint Prep / Paint"), st("R", "MFG - Routing"), st("A", "MFG - Assembly")];
    const steps = buildDepartmentSteps(["Routing", "Paint", "Assembly"], new Set(["NO", "UM", "PU"]), false, {}, stepOrder(own));
    // The departments in the flow's order; the lifecycle stages keep their places around them.
    expect(steps.map((s) => s.key)).toEqual(["NO", "UM", "PU", "P", "R", "A", "CP", "CA", "CI"]);
    expect(steps.find((s) => s.key === "P")!.state).toBe("active");
  });

  it("keeps a step the order doesn't name next to its default neighbour", () => {
    const defs = [{ key: "R" }, { key: "MF" }, { key: "P" }, { key: "A" }];
    expect(orderSteps(defs, ["P", "R", "A"]).map((d) => d.key)).toEqual(["P", "R", "MF", "A"]);
  });
});

describe("a Task complete tick", () => {
  it("on the first of two Vinyl stages: status moves to Vinyl Application, Vinyl stays open", () => {
    const done = new Set(["R", "MF", "P"]);
    const r = applyTick(J34707, "V", [], done, "MFG - Vinyl Cut");
    expect(r.stage).toEqual(VINYL_CUT);
    expect(r.completesStep).toBe(false);
    expect(r.stagesDone).toEqual([stageId(VINYL_CUT)]);
    expect(flowStatus(J34707, "Complete-need paperwork", new Set(r.stagesDone), done)).toBe("MFG - Vinyl Application");
  });

  it("on the last Vinyl stage: Vinyl completes and the job moves to Assembly", () => {
    const done = new Set(["R", "MF", "P"]);
    const r = applyTick(J34707, "V", [stageId(VINYL_CUT)], done, "MFG - Vinyl Application");
    expect(r.stage).toEqual(VINYL_APP);
    expect(r.completesStep).toBe(true);
    expect(r.stagesDone).toEqual([]); // the completed step holds them now
    expect(flowStatus(J34707, "Complete-need paperwork", none, new Set([...done, "V"]))).toBe("MFG - Assembly");
  });

  it("counts a status set by hand on a later stage as the earlier ones done", () => {
    const r = applyTick(J34707, "V", [], new Set(["R", "MF", "P"]), "MFG - Vinyl Application");
    expect(r.stage).toEqual(VINYL_APP);
    expect(r.completesStep).toBe(true);
  });

  it("out of order (Vinyl Cut while the job is in Paint) records the stage but keeps the status", () => {
    const done = new Set(["R", "MF"]);
    const r = applyTick(J34707, "V", [], done, "MFG - Paint Prep / Paint");
    expect(r.completesStep).toBe(false);
    expect(flowStatus(J34707, "x", new Set(r.stagesDone), done)).toBe("MFG - Paint Prep / Paint");
  });

  it("completes a one-stage step straight away", () => {
    const r = applyTick(J34707, "R", [], none, "MFG - Routing");
    expect(r.completesStep).toBe(true);
    expect(flowStatus(J34707, "x", none, new Set(["R"]))).toBe("MFG - Terry Metal Fab");
  });

  it("completes a step the flow has no stage for", () => {
    expect(applyTick(J34707, "CR", [], none, "MFG - Assembly")).toEqual({ stage: null, completesStep: true, stagesDone: [] });
  });

  it("ends on the done status when every stage is done", () => {
    const all = new Set(J34707.map((s) => s.step));
    expect(currentStage(J34707, none, all)).toBeNull();
    expect(flowStatus(J34707, "Complete-need paperwork", none, all)).toBe("Complete-need paperwork");
  });

  it("never moves a hold or a status outside the flow", () => {
    expect(isFlowMovable("Hold - Customer", J34707, "Complete-need paperwork")).toBe(false);
    expect(isFlowMovable("Billboards", J34707, "Complete-need paperwork")).toBe(false);
    expect(isFlowMovable("MFG - Vinyl Cut", J34707, "Complete-need paperwork")).toBe(true);
  });
});

describe("editing a flow", () => {
  it("moves, adds next to the step, and refuses duplicates", () => {
    expect(moveStage(J34707, 3, -1)[2]).toEqual(VINYL_CUT);
    expect(moveStage(J34707, 0, -1)).toEqual(J34707);
    const added = addStage(J34707, st("MF", "MFG - Chris Metal Fab"));
    expect(added[2]).toEqual(st("MF", "MFG - Chris Metal Fab"));
    expect(addStage(J34707, VINYL_CUT)).toEqual(J34707);
    expect(updateStage(J34707, 3, VINYL_APP)).toEqual(J34707);
    expect(updateStage(J34707, 3, st("V", "MFG - Vinyl Install"))[3]).toEqual(st("V", "MFG - Vinyl Install"));
  });

  it("reads stored stages / progress and ignores junk", () => {
    expect(parseStages(JSON.stringify(J34707))).toEqual(J34707);
    expect(parseStages("")).toBeNull();
    expect(parseStages("{bad")).toBeNull();
    expect(parseStages([VINYL_CUT, VINYL_CUT, { step: "V" }])).toEqual([VINYL_CUT]);
    expect(parseStagesDone('["V|MFG - Vinyl Cut", 3]')).toEqual(["V|MFG - Vinyl Cut"]);
    expect(parseStagesDone("nope")).toEqual([]);
  });

  it("finds the step a status belongs to (History's 'moved to')", () => {
    expect(stepForStatus(J34707, "Complete-need paperwork", "MFG - Vinyl Application")).toBe("V");
    expect(stepForStatus(J34707, "Complete-need paperwork", "Complete-need paperwork")).toBe("done");
    expect(stepForStatus(J34707, "Complete-need paperwork", "Billboards")).toBeNull();
  });
});

describe("one status spanning two departments (MFG - Assembly & Graphics)", () => {
  const AG = "MFG - Assembly & Graphics";
  const flow: FlowStage[] = [
    st("P", "MFG - Paint Prep / Paint"),
    st("V", AG),
    st("A", AG),
    st("I", "Install - waiting on product"),
  ];
  const doneStatus = "Complete-need paperwork";

  it("moves onto it automatically when Paint completes", () => {
    expect(flowStatus(flow, doneStatus, none, new Set(["P"]))).toBe(AG);
  });

  it("stays on it while either department is still open — whichever finishes first", () => {
    // Vinyl first
    expect(applyTick(flow, "V", [], new Set(["P"]), AG).completesStep).toBe(true);
    expect(flowStatus(flow, doneStatus, none, new Set(["P", "V"]))).toBe(AG);
    // Assembly first
    expect(applyTick(flow, "A", [], new Set(["P"]), AG).completesStep).toBe(true);
    expect(flowStatus(flow, doneStatus, none, new Set(["P", "A"]))).toBe(AG);
  });

  it("moves on once both are complete", () => {
    expect(flowStatus(flow, doneStatus, none, new Set(["P", "V", "A"]))).toBe("Install - waiting on product");
  });

  it("can be set up in the editor (same status on two different departments is allowed)", () => {
    const base = [st("P", "MFG - Paint Prep / Paint"), st("V", "MFG - Vinyl Cut"), st("A", "MFG - Assembly")];
    const next = updateStage(updateStage(base, 1, st("V", AG)), 2, st("A", AG));
    expect(next.map((s) => s.status)).toEqual(["MFG - Paint Prep / Paint", AG, AG]);
  });
});
