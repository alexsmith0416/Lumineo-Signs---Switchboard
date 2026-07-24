import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { computeJobTargets } from "./job-schedule-data";

const iso = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : null);

describe("computeJobTargets", () => {
  const released = new Date(2026, 0, 1); // Thu Jan 1, 2026

  it("production = release + 7 weeks; install window = day-after → +3 weeks", () => {
    const t = computeJobTargets({ released, vinylOnly: false });
    expect(iso(t.targetProductionComplete)).toBe("2026-02-19"); // Thu, +7 wk
    expect(iso(t.installWindowStart)).toBe("2026-02-20"); // Fri, next business day
    expect(iso(t.installWindowEnd)).toBe("2026-03-13"); // Fri, +3 wk
  });

  it("vinyl/graphics-only: production = release + 4 weeks", () => {
    const t = computeJobTargets({ released, vinylOnly: true });
    expect(iso(t.targetProductionComplete)).toBe("2026-01-29"); // +4 wk
  });

  it("rolls a weekend production target FORWARD to Monday (never Friday)", () => {
    // release Sat Jan 3 + 7wk = Sat Feb 21 → Monday Feb 23
    const t = computeJobTargets({ released: new Date(2026, 0, 3), vinylOnly: false });
    expect(iso(t.targetProductionComplete)).toBe("2026-02-23");
  });

  it("a Red date pulls production to the working day BEFORE it and hides the window", () => {
    // Red = Mon Mar 16 → working day before = Fri Mar 13
    const t = computeJobTargets({ released, vinylOnly: false, redDate: new Date(2026, 2, 16) });
    expect(iso(t.targetProductionComplete)).toBe("2026-03-13");
    expect(t.installWindowStart).toBeNull();
    expect(t.installWindowEnd).toBeNull();
  });

  it("a Red date wins even over a manual production override", () => {
    const t = computeJobTargets({
      released,
      vinylOnly: false,
      redDate: new Date(2026, 2, 16), // Mon Mar 16 → Fri Mar 13
      productionOverride: new Date(2026, 3, 1),
    });
    expect(iso(t.targetProductionComplete)).toBe("2026-03-13");
  });

  it("manual production override wins and drives the install window", () => {
    const t = computeJobTargets({ released, vinylOnly: false, productionOverride: new Date(2026, 3, 1) }); // Wed Apr 1
    expect(iso(t.targetProductionComplete)).toBe("2026-04-01");
    expect(iso(t.installWindowStart)).toBe("2026-04-02"); // Thu, next business day
    expect(iso(t.installWindowEnd)).toBe("2026-04-23");
  });

  it("a scheduled install pulls production to the working day before it and hides the window", () => {
    // Scheduled = Fri Apr 10 → working day before = Thu Apr 9
    const t = computeJobTargets({ released, vinylOnly: false, scheduledInstall: new Date(2026, 3, 10) });
    expect(iso(t.targetProductionComplete)).toBe("2026-04-09");
    expect(t.installWindowStart).toBeNull();
    expect(t.installWindowEnd).toBeNull();
  });

  it("no release / red / override → no targets", () => {
    expect(computeJobTargets({ released: null, vinylOnly: false })).toEqual({
      targetProductionComplete: null,
      installWindowStart: null,
      installWindowEnd: null,
    });
  });
});
