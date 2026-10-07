import { describe, expect, it } from "vitest";
import { effectiveFrozen, frozenOffsets, lineX, nearestFrozen } from "./freeze-line";
import { defaultLayout, sanitizeLayout, setViewFrozen } from "./jobs-view-layout";

const W = [260, 190, 300, 100, 120, 115]; // Job, Status, Stepper, …

describe("the freeze line", () => {
  it("sticks each frozen column at the widths before it", () => {
    expect(frozenOffsets(W, 3)).toEqual([0, 260, 450]);
    expect(lineX(W, 3)).toBe(750);
  });

  it("keeps at least Job # / Name and one scrolling column, and fits the screen", () => {
    expect(effectiveFrozen(W, 0, 2000)).toBe(1);
    expect(effectiveFrozen(W, 99, 4000)).toBe(5);
    // 260+190+300 = 750 > 75% of 900 — falls back to two columns (450).
    expect(effectiveFrozen(W, 3, 900)).toBe(2);
    expect(effectiveFrozen([200], 3, 900)).toBe(1);
  });

  it("snaps a drag to the nearest column edge — frozen edges stay put, the rest move with the scroll", () => {
    // Not scrolled: edges at 260, 450, 750, 850…
    expect(nearestFrozen(W, 1, 0, 470, 2000)).toBe(2);
    expect(nearestFrozen(W, 1, 0, 740, 2000)).toBe(3);
    // Scrolled 200 px with 1 frozen: the 3-column edge is at 750 - 200 = 550.
    expect(nearestFrozen(W, 1, 200, 560, 2000)).toBe(3);
    // Edges that would freeze more than 75% of the view aren't offered.
    expect(nearestFrozen(W, 1, 0, 1000, 900)).toBe(2);
  });
});

describe("the view's frozen columns (shared)", () => {
  it("is saved on the view, never below 1", () => {
    const l = setViewFrozen(defaultLayout(), "All Jobs", 3);
    expect(l.views["All Jobs"]!.frozen).toBe(3);
    expect(setViewFrozen(l, "All Jobs", 0).views["All Jobs"]!.frozen).toBe(1);
    expect(setViewFrozen(l, "All Jobs", 3)).toBe(l); // unchanged → same object (no save)
  });

  it("survives a reload and drops nonsense", () => {
    const l = setViewFrozen(defaultLayout(), "All Jobs", 4);
    const known = new Set(l.views["All Jobs"]!.cols);
    expect(sanitizeLayout(JSON.parse(JSON.stringify(l)), known).views["All Jobs"]!.frozen).toBe(4);
    const bad = JSON.parse(JSON.stringify(l));
    bad.views["All Jobs"].frozen = "lots";
    expect(sanitizeLayout(bad, known).views["All Jobs"]!.frozen).toBeUndefined();
  });
});
