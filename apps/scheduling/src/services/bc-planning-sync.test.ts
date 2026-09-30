import { describe, expect, it } from "vitest";
import type { ScheduleLine } from "../engine/types";
import {
  allStepsComplete,
  bcStepForDepartmentName,
  bcStepForKey,
  bcStepStates,
  buildStepStatePush,
  buildJobPush,
  buildStepSchedulePush,
  pushRowName,
  resourceNoByName,
  shouldSyncLine,
  stepWindow,
} from "./bc-planning-sync";

function line(overrides: Partial<ScheduleLine> = {}): ScheduleLine {
  return {
    id: "line-1",
    jobNo: "J32865",
    customerName: "Blue Moon",
    planningLineDescription: "Vinyl Install Only",
    startDateTime: new Date("2026-05-14T12:00:00Z"),
    endDateTime: new Date("2026-05-14T22:00:00Z"),
    estimatedHours: 10,
    overrideHours: null,
    employeeId: "emp-1138",
    departmentId: "dept-vinyl",
    customerDueDate: null,
    isLocked: false,
    jobSequence: 1,
    ...overrides,
  };
}

describe("shouldSyncLine", () => {
  it("syncs a BC-backed labor line", () => {
    expect(shouldSyncLine(line())).toBe(true);
  });
  it("skips custom cards (PTO / group containers)", () => {
    expect(shouldSyncLine(line({ isCustom: true }))).toBe(false);
  });
  it("skips lines with no job number", () => {
    expect(shouldSyncLine(line({ jobNo: "" }))).toBe(false);
  });
});

describe("BC step mapping", () => {
  it("maps every stepper key to its agreed BC catalogue step", () => {
    expect(["MC", "S", "R", "MF", "P", "V", "A", "CR", "I"].map(bcStepForKey)).toEqual([
      "Substrate Cut/Prep",
      "Fabrication",
      "Routing",
      "Fabrication",
      "Painting",
      "Vinyl",
      "Final Assembly",
      "Crating",
      "Install",
    ]);
  });
  it("returns null for an unknown key", () => {
    expect(bcStepForKey("X")).toBeNull();
    expect(bcStepForKey("")).toBeNull();
  });
  it("maps live department names, folding the fabrication departments together", () => {
    expect(bcStepForDepartmentName("Steel MFG")).toBe("Fabrication");
    expect(bcStepForDepartmentName("Metal Fab")).toBe("Fabrication");
    expect(bcStepForDepartmentName("Fabrication Help")).toBe("Fabrication");
    expect(bcStepForDepartmentName("Routing")).toBe("Routing");
    expect(bcStepForDepartmentName("Paint")).toBe("Painting");
    expect(bcStepForDepartmentName("Vinyl / Graphics")).toBe("Vinyl");
    expect(bcStepForDepartmentName("Assembly")).toBe("Final Assembly");
  });
  it("returns null for a department with no BC step", () => {
    expect(bcStepForDepartmentName("Shipping")).toBeNull();
    expect(bcStepForDepartmentName(undefined)).toBeNull();
  });
});

describe("stepWindow", () => {
  const rn = (id: string) => ({ "emp-1": "1059", "emp-2": "1071" })[id] ?? "";
  const at = (iso: string) => new Date(iso);

  it("spans earliest start to latest end across the step's cards", () => {
    const w = stepWindow(
      [
        line({ startDateTime: at("2026-10-06T13:00:00Z"), endDateTime: at("2026-10-06T21:00:00Z"), employeeId: "emp-1" }),
        line({ startDateTime: at("2026-10-05T13:00:00Z"), endDateTime: at("2026-10-05T17:00:00Z"), employeeId: "emp-1" }),
        line({ startDateTime: at("2026-10-12T13:00:00Z"), endDateTime: at("2026-10-12T15:00:00Z"), employeeId: "emp-1" }),
      ],
      rn,
    );
    expect(w?.start.toISOString()).toBe("2026-10-05T13:00:00.000Z");
    expect(w?.end.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(w?.assignedTo).toBe("1059");
  });

  it("leaves the assignee blank when several people share the step", () => {
    const w = stepWindow([line({ employeeId: "emp-1" }), line({ employeeId: "emp-2" })], rn);
    expect(w?.assignedTo).toBe("");
  });

  it("ignores cards with no BC resource no when picking the assignee", () => {
    // A team-lane card alongside one person's card still assigns that person.
    const w = stepWindow([line({ employeeId: "emp-1" }), line({ employeeId: "lane-x" })], rn);
    expect(w?.assignedTo).toBe("1059");
  });

  it("skips custom cards and cards without a usable window", () => {
    const w = stepWindow(
      [
        line({ isCustom: true, startDateTime: at("2020-01-01T00:00:00Z") }),
        line({ startDateTime: new Date("nope") }),
        line({ startDateTime: at("2026-10-05T13:00:00Z"), endDateTime: at("2026-10-05T17:00:00Z") }),
      ],
      rn,
    );
    expect(w?.start.toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });

  it("is null when no card remains — BC is left alone, not cleared", () => {
    expect(stepWindow([], rn)).toBeNull();
    expect(stepWindow([line({ isCustom: true })], rn)).toBeNull();
  });
});

describe("resourceNoByName", () => {
  // A slice of the real crfdf_appuser directory (Sep 28, 2026).
  const people = [
    { displayName: "Doug Geddes", userType: "install-wk", bcNo: "1141" },
    { displayName: "Justin Ferguson", userType: "ops", bcNo: "5025" },
    { displayName: "Justin Jeffers", userType: "install-nek", bcNo: "1253" },
    { displayName: "Kevin Barnhart", userType: "ops", bcNo: "5038" },
    { displayName: "Kevin Himes", userType: "pm", bcNo: "5034" },
    { displayName: "Thomas Dunson", userType: "install-wk", bcNo: "1156" },
    { displayName: "Thomas Sellers", userType: "admin", bcNo: "4009" },
    { displayName: "Lee Mcqueen", userType: "production", bcNo: "1062" },
    { displayName: "Kayleigh Mcqueen", userType: "production", bcNo: "1159" },
    { displayName: "Daniel Keller", userType: "install-wk", bcNo: "1100" },
    { displayName: "Bartel de Leeuw", userType: "developer", bcNo: "" },
  ];

  it("matches a unique first name", () => {
    expect(resourceNoByName("Doug", people)).toBe("1141");
  });
  it("uses the last-name initial to pick between people", () => {
    expect(resourceNoByName("Justin F", people)).toBe("5025");
    expect(resourceNoByName("Justin J", people)).toBe("1253");
    expect(resourceNoByName("Kevin B", people)).toBe("5038");
  });
  it("prefers the installer when a first name is shared", () => {
    expect(resourceNoByName("Thomas", people)).toBe("1156");
  });
  it("matches a full name, case-insensitively", () => {
    expect(resourceNoByName("Lee McQueen", people)).toBe("1062");
  });
  it("leaves the assignee blank when still ambiguous", () => {
    // Kevin Barnhart (ops) and Kevin Himes (pm): no installer to prefer.
    expect(resourceNoByName("Kevin", people)).toBe("");
  });
  it("leaves it blank for placeholders, nicknames and people without a BC no", () => {
    expect(resourceNoByName("Misc Jobs", people)).toBe("");
    expect(resourceNoByName("Danny", people)).toBe("");
    expect(resourceNoByName("Bartel", people)).toBe("");
    expect(resourceNoByName("", people)).toBe("");
  });
});

describe("buildStepSchedulePush", () => {
  const window = {
    start: new Date("2026-05-14T12:00:00Z"),
    end: new Date("2026-05-15T22:00:00Z"),
    assignedTo: "1059",
  };

  it("builds a per-step push with ISO UTC times", () => {
    expect(buildStepSchedulePush({ jobNo: "J32865", step: "Vinyl", window, sourceLineId: "line-1" })).toEqual({
      kind: "schedule",
      jobNo: "J32865",
      planningStep: "Vinyl",
      deptKey: "",
      startDateTime: "2026-05-14T12:00:00.000Z",
      endDateTime: "2026-05-15T22:00:00.000Z",
      assignedTo: "1059",
      assignedToName: "",
      complete: false,
      started: false,
      sourceLineId: "line-1",
    });
  });

  it("never marks the step started — scheduling is not starting", () => {
    expect(buildStepSchedulePush({ jobNo: "J1", step: "Vinyl", window })?.started).toBe(false);
  });

  it("is null without a job, a step, or a window", () => {
    expect(buildStepSchedulePush({ jobNo: "", step: "Vinyl", window })).toBeNull();
    expect(buildStepSchedulePush({ jobNo: "J1", step: null, window })).toBeNull();
    expect(buildStepSchedulePush({ jobNo: "J1", step: "Vinyl", window: null })).toBeNull();
  });
});

describe("bcStepStates", () => {
  type St = "completed" | "active" | "included";
  const steps = (...a: Array<[string, St]>) => a.map(([key, state]) => ({ key, state }));
  const pick = (r: ReturnType<typeof bcStepStates>, step: string) => r.find((x) => x.step === step);

  it("marks the active department Started and the rest not", () => {
    const r = bcStepStates(steps(["R", "completed"], ["MF", "active"], ["P", "included"], ["I", "included"]));
    expect(pick(r, "Routing")).toMatchObject({ started: true, complete: true });
    expect(pick(r, "Fabrication")).toMatchObject({ started: true, complete: false });
    expect(pick(r, "Painting")).toMatchObject({ started: false, complete: false });
    expect(pick(r, "Install")).toMatchObject({ started: false, complete: false });
  });

  it("supports several active departments at once", () => {
    const r = bcStepStates(steps(["MF", "active"], ["V", "active"], ["A", "included"]));
    expect(pick(r, "Fabrication")?.started).toBe(true);
    expect(pick(r, "Vinyl")?.started).toBe(true);
    expect(pick(r, "Final Assembly")?.started).toBe(false);
  });

  it("completes a folded step only when all of its departments are done", () => {
    const partial = bcStepStates(steps(["S", "completed"], ["MF", "active"]));
    expect(pick(partial, "Fabrication")).toMatchObject({ started: true, complete: false, keys: ["S", "MF"] });
    const done = bcStepStates(steps(["S", "completed"], ["MF", "completed"], ["P", "active"]));
    expect(pick(done, "Fabrication")).toMatchObject({ started: true, complete: true });
  });

  it("leaves a folded step not Started when none of its departments is active", () => {
    // Steel is done, Routing is the active stage, Metal Fab hasn't begun.
    const r = bcStepStates(steps(["S", "completed"], ["R", "active"], ["MF", "included"]));
    expect(pick(r, "Fabrication")).toMatchObject({ started: false, complete: false });
  });

  it("returns one entry per BC step, only for included departments (plus the main Production step)", () => {
    const r = bcStepStates(steps(["S", "active"], ["MF", "included"]));
    expect(r.map((x) => x.step)).toEqual(["Production", "Fabrication"]);
    expect(bcStepStates([])).toEqual([]);
  });

  describe("main steps", () => {
    it("Production is Started while any production step is, and Complete once all are", () => {
      const going = bcStepStates(steps(["R", "completed"], ["MF", "active"], ["I", "included"]));
      expect(pick(going, "Production")).toMatchObject({ started: true, complete: false, keys: ["R", "MF"] });
      const done = bcStepStates(steps(["R", "completed"], ["MF", "completed"], ["I", "active"]));
      expect(pick(done, "Production")).toMatchObject({ started: true, complete: true });
    });

    it("Installation/Service is Started once Install is active, Complete once it's done", () => {
      expect(pick(bcStepStates(steps(["MF", "active"], ["I", "included"])), "Installation/Service"))
        .toMatchObject({ started: false, complete: false });
      expect(pick(bcStepStates(steps(["MF", "completed"], ["I", "active"])), "Installation/Service"))
        .toMatchObject({ started: true, complete: false, keys: ["I"] });
      expect(pick(bcStepStates(steps(["MF", "completed"], ["I", "completed"])), "Installation/Service"))
        .toMatchObject({ started: true, complete: true });
    });

    it("leaves out a main step the job has nothing under", () => {
      expect(pick(bcStepStates(steps(["I", "active"])), "Production")).toBeUndefined();
      expect(pick(bcStepStates(steps(["MF", "active"])), "Installation/Service")).toBeUndefined();
    });
  });
});

describe("buildStepStatePush", () => {
  it("carries the step's Started and Complete", () => {
    const push = buildStepStatePush({
      jobNo: "J33138",
      state: { step: "Fabrication", started: true, complete: false, keys: ["S", "MF"] },
      by: "Alex Smith",
    });
    expect(push).toMatchObject({
      kind: "state",
      jobNo: "J33138",
      planningStep: "Fabrication",
      deptKey: "S,MF",
      started: true,
      complete: false,
      startDateTime: null,
      assignedTo: "",
    });
  });
  it("is null without a job", () => {
    expect(buildStepStatePush({ jobNo: "", state: { step: "Vinyl", started: true, complete: false, keys: ["V"] } })).toBeNull();
  });
});

describe("pushRowName", () => {
  it("labels the outbox row job · step", () => {
    const push = buildStepStatePush({ jobNo: "J32865", state: { step: "Vinyl", started: true, complete: false, keys: ["V"] } });
    expect(pushRowName(push!)).toBe("J32865 · Vinyl");
  });
});

describe("allStepsComplete", () => {
  it("is true only when every included step is done", () => {
    expect(allStepsComplete(["P", "V", "I"], new Set(["P", "V", "I"]))).toBe(true);
    expect(allStepsComplete(["P", "V", "I"], new Set(["P", "V"]))).toBe(false);
  });

  it("ignores completions for steps the stepper doesn't include", () => {
    // An editor removed "I" from this job, so it can't hold the job open —
    // and a stale completion row for it can't close the job on its own either.
    expect(allStepsComplete(["P", "V"], new Set(["P", "V", "I"]))).toBe(true);
  });

  it("treats an empty step list as NOT complete", () => {
    // A job with no stepper hasn't finished anything. Returning true here would
    // push complete=true to BC for every job that has no production steps.
    expect(allStepsComplete([], new Set())).toBe(false);
    expect(allStepsComplete([], new Set(["P"]))).toBe(false);
  });
});

describe("buildJobPush", () => {
  it("builds a job-completion push carrying the date in endDateTime", () => {
    const push = buildJobPush({
      jobNo: "J32865",
      complete: true,
      completedBy: "Amy Wing",
      completedDate: new Date("2026-09-14T17:00:00Z"),
    });
    expect(push).toMatchObject({
      kind: "job",
      jobNo: "J32865",
      complete: true,
      planningStep: "",
      deptKey: "",
      assignedTo: "",
      assignedToName: "Amy Wing",
    });
    expect(push?.endDateTime).toBe("2026-09-14T17:00:00.000Z");
    expect(push?.startDateTime).toBeNull();
  });

  it("carries no completion date when re-opening", () => {
    const push = buildJobPush({ jobNo: "J32865", complete: false });
    expect(push?.complete).toBe(false);
    expect(push?.endDateTime).toBeNull();
  });

  it("defaults the completion date to now", () => {
    expect(buildJobPush({ jobNo: "J32865", complete: true })?.endDateTime).not.toBeNull();
  });

  it("returns null without a job no", () => {
    expect(buildJobPush({ jobNo: "", complete: true })).toBeNull();
  });

  it("never carries BC's status field — that's a BC-owner decision", () => {
    const push = buildJobPush({ jobNo: "J32865", complete: true });
    expect(Object.keys(push!)).not.toContain("status");
  });
});
