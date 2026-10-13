import { describe, expect, it } from "vitest";
import { SYNC_PICKUP_LIMIT_MS, SYNC_PULLS, SYNC_RUN_LIMIT_MS, overallPhase, readSyncRequest } from "./sync-request";

const row = (status: string, result = "") => ({ status, result });

describe("reading a Check BC now request", () => {
  it("follows the flow's status", () => {
    expect(readSyncRequest("neworders", row("Requested"), 1000).phase).toBe("waiting");
    expect(readSyncRequest("neworders", row("Running"), 1000).phase).toBe("running");
    expect(readSyncRequest("neworders", row("Done", "Added 1 job: 24-1234"), 1000)).toEqual({
      phase: "done",
      message: "Added 1 job: 24-1234",
    });
    expect(readSyncRequest("jobpos", row("Failed", "Could not check BC"), 1000)).toEqual({
      phase: "failed",
      message: "Could not check BC",
    });
  });

  it("gives up on a request nobody picks up, naming the flow", () => {
    const v = readSyncRequest("taskcompletions", row("Requested"), SYNC_PICKUP_LIMIT_MS + 1);
    expect(v.phase).toBe("failed");
    expect(v.message).toContain("BCSync_TaskCompletions");
    expect(readSyncRequest("jobsketches", row("Running"), SYNC_RUN_LIMIT_MS + 1).phase).toBe("failed");
  });

  it("treats a vanished row as failed", () => {
    expect(readSyncRequest("neworders", null, 0).phase).toBe("failed");
  });

  it("covers every pull once, task completions first", () => {
    expect(SYNC_PULLS[0]!.kind).toBe("taskcompletions");
    expect(new Set(SYNC_PULLS.map((p) => p.kind)).size).toBe(SYNC_PULLS.length);
  });

  it("is busy while any pull is, then failed if any failed", () => {
    expect(overallPhase([])).toBe("idle");
    expect(overallPhase(["done", "running"])).toBe("running");
    expect(overallPhase(["done", "waiting", "failed"])).toBe("running");
    expect(overallPhase(["done", "failed"])).toBe("failed");
    expect(overallPhase(["done", "done"])).toBe("done");
  });
});
