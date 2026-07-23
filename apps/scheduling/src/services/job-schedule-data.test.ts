import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { computeJobTargets } from "./job-schedule-data";

const iso = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : null);

describe("computeJobTargets", () => {
  const released = new Date(2026, 0, 1); // Jan 1, 2026

  it("production = release + 7 weeks; install window = release + 8…10 weeks", () => {
    const t = computeJobTargets(released, false);
    expect(iso(t.targetProductionComplete)).toBe("2026-02-19"); // +7 wk
    expect(iso(t.installWindowStart)).toBe("2026-02-26"); // +8 wk
    expect(iso(t.installWindowEnd)).toBe("2026-03-12"); // +10 wk
  });

  it("vinyl/graphics-only: production = release + 4 weeks; install window unchanged (+8…10)", () => {
    const t = computeJobTargets(released, true);
    expect(iso(t.targetProductionComplete)).toBe("2026-01-29"); // +4 wk
    expect(iso(t.installWindowStart)).toBe("2026-02-26"); // +8 wk
    expect(iso(t.installWindowEnd)).toBe("2026-03-12"); // +10 wk
  });

  it("no release date → no targets", () => {
    expect(computeJobTargets(null, false)).toEqual({
      targetProductionComplete: null,
      installWindowStart: null,
      installWindowEnd: null,
    });
  });
});
