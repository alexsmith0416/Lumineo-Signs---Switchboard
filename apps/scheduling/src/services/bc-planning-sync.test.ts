import { describe, expect, it } from "vitest";
import type { ScheduleLine } from "../engine/types";
import {
  buildCompletionPush,
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
