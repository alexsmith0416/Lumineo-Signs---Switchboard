import { describe, it, expect } from "vitest";
import {
  evenSplit,
  isSplittable,
  lineHours,
  potFor,
  sameJobTask,
  splitPartLabels,
  splitSiblings,
  taskCommitment,
} from "./split-hours";
import { line, at } from "../engine/__fixtures__/build";

// A 24h task cut into 16h + 8h, linked by an explicit split group.
const partA = line({
  id: "A",
  jobNo: "J100",
  employeeId: "bob",
  departmentId: "metal",
  start: at(0, 8),
  estimatedHours: 24,
  overrideHours: 16,
  splitGroupId: "sg-1",
});
const partB = line({
  id: "B",
  jobNo: "J100",
  employeeId: "bob",
  departmentId: "metal",
  start: at(3, 8),
  estimatedHours: 24,
  overrideHours: 8,
  splitGroupId: "sg-1",
});

describe("lineHours", () => {
  it("uses the override when set, else the estimate", () => {
    expect(lineHours({ overrideHours: 6, estimatedHours: 24 })).toBe(6);
    expect(lineHours({ overrideHours: null, estimatedHours: 24 })).toBe(24);
  });
});

describe("potFor", () => {
  it("splits one estimate across the parts without inflating it", () => {
    const pot = potFor(partA, [partA, partB]);
    expect(pot.pot).toBe(24);
    expect(pot.allocated).toBe(24);
    expect(pot.remaining).toBe(0);
    expect(pot.count).toBe(2);
    expect(pot.index).toBe(1);
    expect(pot.otherParts).toBe(8);
  });

  it("orders parts by start date, so index reads as the work sequence", () => {
    expect(potFor(partB, [partB, partA]).index).toBe(2);
  });

  it("reports hours left when the parts don't use the whole estimate", () => {
    const half = { ...partA, overrideHours: 4 };
    const pot = potFor(half, [half]);
    expect(pot.allocated).toBe(4);
    expect(pot.remaining).toBe(20);
    expect(pot.overBy).toBe(0);
  });

  it("flags an overrun instead of hiding it", () => {
    const big = { ...partB, overrideHours: 16 }; // 16 + 16 > 24
    const pot = potFor(partA, [partA, big]);
    expect(pot.allocated).toBe(32);
    expect(pot.remaining).toBe(-8);
    expect(pot.overBy).toBe(8);
  });

  it("an unsplit card is a single part holding its own hours", () => {
    const solo = line({
      jobNo: "J200",
      employeeId: "tom",
      departmentId: "paint",
      start: at(0, 8),
      estimatedHours: 8,
    });
    const pot = potFor(solo, [solo]);
    expect(pot.count).toBe(1);
    expect(pot.allocated).toBe(8);
    expect(pot.otherParts).toBe(0);
  });
});

describe("splitSiblings without a split-group column", () => {
  // The crfdf_splitgroup column post-dates the tables; until it exists the
  // parts have to be recognised some other way.
  const noGroupA = { ...partA, splitGroupId: null };
  const noGroupB = { ...partB, splitGroupId: null };

  it("falls back to same job + task on the same person", () => {
    expect(splitSiblings(noGroupA, [noGroupA, noGroupB])).toHaveLength(2);
  });

  it("does NOT treat one task duplicated across a crew as sections", () => {
    // Duplicate-to-employees puts the same task on several people who each work
    // the full hours in parallel — summing those into one pot would be wrong.
    const onTom = { ...noGroupB, id: "C", employeeId: "tom" };
    const parts = splitSiblings(noGroupA, [noGroupA, onTom]);
    expect(parts).toHaveLength(1);
    expect(potFor(noGroupA, [noGroupA, onTom]).allocated).toBe(16);
  });

  it("an explicit group still wins across employees", () => {
    // Once the column exists, dragging a part to someone else keeps it in the pot.
    const moved = { ...partB, employeeId: "tom" };
    expect(splitSiblings(partA, [partA, moved])).toHaveLength(2);
  });
});

describe("taskCommitment", () => {
  it("totals what a job + task already has booked, across employees", () => {
    const onTom = { ...partB, id: "C", employeeId: "tom" };
    const c = taskCommitment({ jobNo: "J100", planningLineDescription: partA.planningLineDescription }, [
      partA,
      onTom,
    ]);
    expect(c.hours).toBe(24);
    expect(c.lines).toHaveLength(2);
  });

  it("excludes the card being edited so it isn't counted against itself", () => {
    const c = taskCommitment(partA, [partA, partB], partA.id);
    expect(c.hours).toBe(8);
  });

  it("ignores block-out cards and other jobs", () => {
    const pto = line({
      jobNo: "PTO",
      employeeId: "bob",
      departmentId: "metal",
      start: at(1, 8),
      estimatedHours: 8,
      isCustom: true,
    });
    const other = line({
      jobNo: "J999",
      employeeId: "bob",
      departmentId: "metal",
      start: at(1, 8),
      estimatedHours: 8,
    });
    expect(taskCommitment(partA, [partA, partB, pto, other]).hours).toBe(24);
  });

  it("matches task text case- and whitespace-insensitively", () => {
    const sloppy = { ...partB, planningLineDescription: `  ${partA.planningLineDescription.toUpperCase()} ` };
    expect(sameJobTask(partA, sloppy)).toBe(true);
  });
});

describe("evenSplit", () => {
  it("divides evenly when it can", () => {
    expect(evenSplit(24, 2)).toEqual([12, 12]);
    expect(evenSplit(24, 3)).toEqual([8, 8, 8]);
  });

  it("always sums back to the original, remainder on the first part", () => {
    for (const [total, n] of [[10, 3], [7, 2], [13, 4], [1, 3]] as const) {
      const parts = evenSplit(total, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 5);
    }
  });

  it("keeps parts on quarter-hour boundaries", () => {
    for (const p of evenSplit(10, 3)) expect((p * 4) % 1).toBe(0);
  });
});

describe("splitPartLabels", () => {
  it("labels each part n/N in schedule order", () => {
    const labels = splitPartLabels([partB, partA]);
    expect(labels.get("A")).toBe("1/2");
    expect(labels.get("B")).toBe("2/2");
  });

  it("leaves whole cards unlabelled", () => {
    const solo = line({
      jobNo: "J300",
      employeeId: "dan",
      departmentId: "asm",
      start: at(0, 8),
      estimatedHours: 8,
    });
    expect(splitPartLabels([solo]).size).toBe(0);
  });

  it("doesn't label a task duplicated across a crew", () => {
    const a = { ...partA, splitGroupId: null };
    const onTom = { ...partB, id: "C", employeeId: "tom", splitGroupId: null };
    expect(splitPartLabels([a, onTom]).size).toBe(0);
  });
});

describe("isSplittable", () => {
  const base = { jobNo: "J1", employeeId: "bob", departmentId: "metal", start: at(0, 8) };

  it("allows a normal job card", () => {
    expect(isSplittable(line({ ...base, estimatedHours: 8 }))).toBe(true);
  });

  it("refuses block-out / group cards and shipment loads", () => {
    expect(isSplittable(line({ ...base, estimatedHours: 8, isCustom: true }))).toBe(false);
    expect(
      isSplittable({ ...line({ ...base, estimatedHours: 8 }), shipmentLoadId: "load-1" }),
    ).toBe(false);
  });

  it("refuses a card already down to the minimum slice", () => {
    expect(isSplittable(line({ ...base, estimatedHours: 0.5 }))).toBe(false);
  });
});
