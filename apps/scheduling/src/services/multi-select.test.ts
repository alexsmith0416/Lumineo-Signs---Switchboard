import { describe, expect, it } from "vitest";
import type { ScheduleLine } from "../engine/types";
import { groupFromSelection, groupMoveTargets, pasteStarts } from "./multi-select";

const line = (id: string, emp: string, start: string, extra: Partial<ScheduleLine> = {}): ScheduleLine =>
  ({
    id, jobNo: `J${id}`, customerName: `Cust ${id}`, planningLineDescription: `Task ${id}`,
    startDateTime: new Date(start), endDateTime: new Date(start), estimatedHours: 4, overrideHours: null,
    employeeId: emp, departmentId: "d", customerDueDate: null, isLocked: false, jobSequence: 0, ...extra,
  }) as ScheduleLine;

describe("groupMoveTargets", () => {
  const sel = [line("1", "amy", "2026-10-19T08:00:00"), line("2", "amy", "2026-10-20T08:00:00"), line("3", "bob", "2026-10-21T13:00:00")];
  it("shifts every card by the dragged card's move", () => {
    const t = groupMoveTargets(sel, "1", new Date("2026-10-21T08:00:00"));
    expect(t.map((x) => x.start.toISOString())).toEqual([
      new Date("2026-10-21T08:00:00").toISOString(),
      new Date("2026-10-22T08:00:00").toISOString(),
      new Date("2026-10-23T13:00:00").toISOString(),
    ]);
    expect(t.every((x) => x.employeeId === undefined)).toBe(true);
  });
  it("moves the dragged card's person's cards to the new person only", () => {
    const t = groupMoveTargets(sel, "1", new Date("2026-10-19T08:00:00"), "cal");
    expect(t.find((x) => x.id === "2")?.employeeId).toBe("cal");
    expect(t.find((x) => x.id === "3")?.employeeId).toBeUndefined();
  });
  it("leaves locked cards (other than the dragged one) where they are", () => {
    const t = groupMoveTargets([...sel, line("4", "amy", "2026-10-19T12:00:00", { isLocked: true })], "1", new Date("2026-10-20T08:00:00"));
    expect(t.some((x) => x.id === "4")).toBe(false);
  });
});

describe("pasteStarts", () => {
  it("puts the earliest at 8:00 on the day and keeps the others' day gaps and times", () => {
    const p = pasteStarts([line("2", "amy", "2026-10-21T13:00:00"), line("1", "amy", "2026-10-19T10:00:00")], new Date("2026-11-02T00:00:00"));
    expect(p[0]!.card.id).toBe("1");
    expect(p[0]!.start).toEqual(new Date("2026-11-02T08:00:00"));
    expect(p[1]!.start).toEqual(new Date("2026-11-04T13:00:00"));
  });
});

describe("groupFromSelection", () => {
  it("makes members from the job cards, earliest first, skipping custom cards", () => {
    const g = groupFromSelection(
      [line("2", "amy", "2026-10-21T08:00:00", { overrideHours: 6 }), line("1", "amy", "2026-10-19T08:00:00"), line("c", "amy", "2026-10-18T08:00:00", { isCustom: true })],
      "  Week jobs ",
    );
    expect(g?.first.id).toBe("1");
    expect(g?.data.title).toBe("Week jobs");
    expect(g?.data.members.map((m) => [m.jobNo, m.estimatedHours])).toEqual([["J1", 4], ["J2", 6]]);
  });
  it("is null with no job cards", () => {
    expect(groupFromSelection([line("c", "amy", "2026-10-18T08:00:00", { isCustom: true })], "x")).toBeNull();
  });
});
