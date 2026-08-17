import { beforeEach, describe, expect, it } from "vitest";
import { createScheduleStore } from "./schedule-store";
import { useWriteStatusStore } from "./write-status-store";
import type { ScheduleDataSource } from "../services/data-source";
import type { Department, Employee, ScheduleLine } from "../engine/types";

// THE REGRESSION THIS LOCKS DOWN
//
// "I make a change, the app quick-loads, and the change is gone. I do it again
// and it works." That was a failed background write triggering a board reload,
// and the reload replacing the user's optimistic edit with the pre-edit server
// state. A save problem was showing up as silently discarded work.
//
// The rule now: a write that fails NEVER reverts what's on screen. The edit
// stays, the failure is recorded with a retry, and the user is told.

const MONDAY = new Date(2026, 7, 10, 8, 0, 0);

/** Let any stray async work land before asserting. A reverting reload (the old
 *  behaviour) is kicked off with `void` and resolves a few ticks later, so
 *  asserting immediately would let a regression slip through. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

const employee: Employee = {
  id: "e1",
  name: "Tester",
  departmentId: "d1",
  position: 1,
  standardHoursPerDay: 8,
  productivityRate: 1,
  maxOvertimePerDay: 0,
  worksWeekends: false,
};

const department: Department = { id: "d1", name: "Metal Fab", flowOrder: 1, color: "#BED7FF" };

const line: ScheduleLine = {
  id: "L1",
  jobNo: "J1",
  customerName: "Cust",
  planningLineDescription: "Task",
  employeeId: "e1",
  departmentId: "d1",
  startDateTime: MONDAY,
  endDateTime: new Date(2026, 7, 10, 16, 0, 0),
  estimatedHours: 8,
  overrideHours: null,
  customerDueDate: new Date(2026, 7, 21),
  isLocked: false,
  jobSequence: 1,
};

/** A source whose reads work and whose writes always fail. */
function brokenWriteSource(): ScheduleDataSource {
  return {
    kind: "production",
    loadDepartments: async () => [department],
    loadEmployees: async () => [employee],
    loadScheduleLines: async () => [{ ...line }],
    loadWorkHours: async () => [],
    loadOvertimeOverrides: async () => [],
    updateScheduleLine: async () => {
      throw new Error("Failed to fetch");
    },
    createScheduleLine: async () => {
      throw new Error("Failed to fetch");
    },
    deleteScheduleLine: async () => {
      throw new Error("Failed to fetch");
    },
  };
}

describe("an edit whose save fails", () => {
  beforeEach(() => {
    useWriteStatusStore.getState().clear();
  });

  it("keeps a card resize on screen instead of reverting it", async () => {
    const useStore = createScheduleStore(brokenWriteSource(), "test-resize");
    await useStore.getState().loadWeek(MONDAY);

    await useStore.getState().setTaskSpan("L1", 2);
    await flush();

    // The board still shows what the user did.
    expect(useStore.getState().schedule.find((l) => l.id === "L1")?.spanDays).toBe(2);
    // …and the failure is visible rather than silent.
    expect(useWriteStatusStore.getState().failed).toHaveLength(1);
    expect(useWriteStatusStore.getState().failed[0]?.label).toBe("Resize job card");
  });

  it("keeps an hours change on screen", async () => {
    const useStore = createScheduleStore(brokenWriteSource(), "test-hours");
    await useStore.getState().loadWeek(MONDAY);

    await useStore.getState().updateTaskHours("L1", 16, false);
    await flush();

    expect(useStore.getState().schedule.find((l) => l.id === "L1")?.overrideHours).toBe(16);
    expect(useWriteStatusStore.getState().failed).toHaveLength(1);
  });

  it("keeps a newly added card on screen", async () => {
    const useStore = createScheduleStore(brokenWriteSource(), "test-add");
    await useStore.getState().loadWeek(MONDAY);

    await useStore.getState().addScheduleLine({ ...line, id: "L2", jobNo: "J2" });
    await flush();

    expect(useStore.getState().schedule.map((l) => l.id)).toContain("L2");
    expect(useWriteStatusStore.getState().failed[0]?.label).toBe("Add job card");
  });

  it("keeps a deletion applied on screen", async () => {
    const useStore = createScheduleStore(brokenWriteSource(), "test-delete");
    await useStore.getState().loadWeek(MONDAY);

    await useStore.getState().deleteScheduleLine("L1");
    await flush();

    expect(useStore.getState().schedule.map((l) => l.id)).not.toContain("L1");
    expect(useWriteStatusStore.getState().failed[0]?.label).toBe("Delete job card");
  });

  it("offers a retry that re-runs the same write", async () => {
    let attempts = 0;
    const source = brokenWriteSource();
    source.updateScheduleLine = async (id, changes) => {
      attempts++;
      if (attempts === 1) throw new Error("Failed to fetch");
      return { ...line, ...changes, id } as ScheduleLine;
    };

    const useStore = createScheduleStore(source, "test-retry");
    await useStore.getState().loadWeek(MONDAY);
    await useStore.getState().setTaskSpan("L1", 3);
    await flush();
    expect(useWriteStatusStore.getState().failed).toHaveLength(1);

    await useWriteStatusStore.getState().retryAll();
    await flush();

    expect(attempts).toBe(2);
    expect(useWriteStatusStore.getState().failed).toHaveLength(0);
    // The edit was never disturbed while all that happened.
    expect(useStore.getState().schedule.find((l) => l.id === "L1")?.spanDays).toBe(3);
  });

  it("reports a successful save as nothing pending and nothing failed", async () => {
    const source = brokenWriteSource();
    source.updateScheduleLine = async (id, changes) => ({ ...line, ...changes, id }) as ScheduleLine;

    const useStore = createScheduleStore(source, "test-ok");
    await useStore.getState().loadWeek(MONDAY);
    await useStore.getState().setTaskSpan("L1", 2);
    await flush();

    expect(useWriteStatusStore.getState().failed).toHaveLength(0);
    expect(useWriteStatusStore.getState().pending).toBe(0);
  });
});
