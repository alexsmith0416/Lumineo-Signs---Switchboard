import { describe, expect, it } from "vitest";
import { googleMapsDirUrl, loopHours, needsOvernight, planDays, shortestLoop, type Matrix } from "./trip-plan";

/** A matrix from a symmetric hours table; miles = hours × 50. */
const matrix = (hours: number[][]): Matrix => ({ hours, miles: hours.map((r) => r.map((h) => h * 50)), source: "estimate" });

// Home 0; stops on a line east of home at 1 h, 2 h, 3 h.
const LINE = [
  [0, 1, 2, 3],
  [1, 0, 1, 2],
  [2, 1, 0, 1],
  [3, 2, 1, 0],
];

describe("shortest loop", () => {
  it("visits every stop once and finds the cheapest loop", () => {
    // Listed out of order; the best loop goes out along the line and back (6 h).
    const h = [
      [0, 3, 1, 2],
      [3, 0, 2, 1],
      [1, 2, 0, 1],
      [2, 1, 1, 0],
    ];
    const order = shortestLoop(h);
    expect([...order].sort()).toEqual([1, 2, 3]);
    expect(loopHours(h, order)).toBe(6);
  });

  it("handles big groups with the heuristic", () => {
    // 14 stops on a line: the best loop is 2 × the far end.
    const n = 14;
    const h = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => Math.abs(i - j)));
    const order = shortestLoop(h);
    expect(new Set(order).size).toBe(n);
    expect(loopHours(h, order)).toBe(2 * n);
  });
});

describe("days", () => {
  it("fits a short trip in one day trip and comes home", () => {
    const p = planDays({ matrix: matrix(LINE), order: [1, 2], work: [0, 2, 2], overnight: false, maxNights: 2 });
    expect(p.days).toHaveLength(1);
    // 1 out + 2 work + 1 + 2 work + 2 home = 8 h
    expect(p.days[0]!.driveHours + p.days[0]!.workHours).toBe(8);
    expect(p.days[0]!.endsAt).toBe("home");
    expect(p.warnings).toEqual([]);
  });

  it("day trips hold back the drive home and go home each night", () => {
    // Stop 3 is 3 h out: a day leaves 10 − 3 − 3 = 4 h of work. 6 h of work = 2 days.
    const p = planDays({ matrix: matrix(LINE), order: [3], work: [0, 0, 0, 6], overnight: false, maxNights: 2 });
    expect(p.days).toHaveLength(2);
    expect(p.days.every((d) => d.endsAt === "home")).toBe(true);
    const parts = p.days.flatMap((d) => d.events).filter((e) => e.type === "work");
    expect(parts.map((e) => (e.type === "work" ? [e.hours, e.part, e.parts] : null))).toEqual([
      [4, 1, 2],
      [2, 2, 2],
    ]);
  });

  it("overnights stay near the work and only drive home at the end", () => {
    const p = planDays({ matrix: matrix(LINE), order: [3], work: [0, 0, 0, 12], overnight: true, maxNights: 2 });
    // Day 1: 3 drive + 7 work (hotel). Day 2: 5 work + 3 home.
    expect(p.days).toHaveLength(2);
    expect(p.days[0]!.endsAt).toBe(3);
    expect(p.nights).toBe(1);
    expect(p.days[1]!.endsAt).toBe("home");
    expect(p.driveHours).toBe(6);
  });

  it("warns past the night limit and on a day that can't fit", () => {
    const long = planDays({ matrix: matrix(LINE), order: [3], work: [0, 0, 0, 30], overnight: true, maxNights: 1 });
    expect(long.nights).toBeGreaterThan(1);
    expect(long.warnings.some((w) => w.includes("night limit"))).toBe(true);
    const far = matrix([
      [0, 6],
      [6, 0],
    ]);
    const tooFar = planDays({ matrix: far, order: [1], work: [0, 2], overnight: false, maxNights: 2 });
    expect(tooFar.warnings.some((w) => w.includes("overnight"))).toBe(true);
  });

  it("calls it an overnight when any stop is over 4 h one-way", () => {
    expect(needsOvernight(LINE, [1, 2, 3])).toBe(false);
    expect(needsOvernight([[0, 4.5], [4.5, 0]], [1])).toBe(true);
  });
});

describe("Google Maps link", () => {
  it("builds origin → waypoints → destination, at most 9 waypoints", () => {
    const url = new URL(googleMapsDirUrl(["Home", "A", "B", "Home"]));
    expect(url.searchParams.get("origin")).toBe("Home");
    expect(url.searchParams.get("destination")).toBe("Home");
    expect(url.searchParams.get("waypoints")).toBe("A|B");
    const many = new URL(googleMapsDirUrl(["H", ...Array.from({ length: 12 }, (_, i) => `S${i}`), "H"]));
    expect(many.searchParams.get("waypoints")!.split("|")).toHaveLength(9);
    expect(googleMapsDirUrl(["H"])).toBe("");
  });
});
