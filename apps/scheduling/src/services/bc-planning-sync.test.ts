import { describe, expect, it } from "vitest";
import type { ScheduleLine } from "../engine/types";
import {
  allStepsComplete,
  buildCompletionPush,
  buildJobPush,
  buildSchedulePush,
  pushRowName,
  shouldSyncLine,
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
  it("skips lines with no planning-step text", () => {
    expect(shouldSyncLine(line({ planningLineDescription: "" }))).toBe(false);
  });
});

describe("buildSchedulePush", () => {
  it("maps a committed line to a schedule push with ISO times", () => {
    const push = buildSchedulePush(line(), { assignedTo: "emp-1138", assignedToName: "Tanner Rue" });
    expect(push).toEqual({
      kind: "schedule",
      jobNo: "J32865",
      planningStep: "Vinyl Install Only",
      deptKey: "dept-vinyl",
      startDateTime: "2026-05-14T12:00:00.000Z",
      endDateTime: "2026-05-14T22:00:00.000Z",
      assignedTo: "emp-1138",
      assignedToName: "Tanner Rue",
      complete: false,
      started: true,
      sourceLineId: "line-1",
    });
  });

  it("returns null for a non-BC / custom line (never enqueued)", () => {
    expect(buildSchedulePush(line({ isCustom: true }))).toBeNull();
  });

  it("defaults assignee to empty (e.g. team-lane lines)", () => {
    const push = buildSchedulePush(line());
    expect(push?.assignedTo).toBe("");
  });
});

describe("buildCompletionPush", () => {
  it("builds a complete push carrying the completer", () => {
    const push = buildCompletionPush({ jobNo: "J32865", deptKey: "dept-vinyl", complete: true, completedBy: "Amy Wing" });
    expect(push).toMatchObject({ kind: "completion", complete: true, started: true, assignedToName: "Amy Wing" });
    expect(push?.startDateTime).toBeNull();
  });

  it("builds a re-open (complete=false) push", () => {
    const push = buildCompletionPush({ jobNo: "J32865", deptKey: "dept-vinyl", complete: false });
    expect(push?.complete).toBe(false);
  });

  it("returns null without a job or dept key", () => {
    expect(buildCompletionPush({ jobNo: "", deptKey: "dept-vinyl", complete: true })).toBeNull();
    expect(buildCompletionPush({ jobNo: "J1", deptKey: "", complete: true })).toBeNull();
  });
});

describe("pushRowName", () => {
  it("labels the outbox row job · step", () => {
    expect(pushRowName(buildSchedulePush(line())!)).toBe("J32865 · Vinyl Install Only");
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
