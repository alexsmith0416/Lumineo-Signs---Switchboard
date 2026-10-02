import { describe, expect, it } from "vitest";
import type { ScheduleLine } from "../engine/types";
import { dayValue, lineDays } from "./day-values";

const line = (o: Partial<ScheduleLine> & { region?: string; value?: number }): ScheduleLine & { region: string; value: number } =>
  ({
    id: Math.random().toString(),
    jobNo: "J1",
    startDateTime: new Date(2026, 9, 5, 8),
    endDateTime: new Date(2026, 9, 5, 16),
    region: "WK",
    value: 1000,
    ...o,
  }) as ScheduleLine & { region: string; value: number };

const regionOf = (l: ScheduleLine) => (l as ScheduleLine & { region: string }).region;
const valueOf = (l: ScheduleLine) => (l as ScheduleLine & { value: number }).value;
const MON = new Date(2026, 9, 5);
const TUE = new Date(2026, 9, 6);

describe("dayValue", () => {
  it("counts a job once per day per region, and once combined across regions", () => {
    const v = dayValue(
      [
        line({ jobNo: "J1", value: 5000 }),
        line({ jobNo: "J1", value: 5000, startDateTime: new Date(2026, 9, 5, 12) }), // 2nd card, same day
        line({ jobNo: "J2", value: 2000, region: "NEK" }),
        line({ jobNo: "J1", value: 5000, region: "NEK" }), // same job on the other board
      ],
      MON,
      regionOf,
      valueOf,
    );
    expect(v.byRegion).toEqual({ WK: { total: 5000, jobs: 1 }, NEK: { total: 7000, jobs: 2 } });
    expect(v.combined).toEqual({ total: 7000, jobs: 2 });
  });

  it("covers every day of a multi-day card, and skips custom blocks and no-value cards", () => {
    const lines = [
      line({ jobNo: "J1", endDateTime: new Date(2026, 9, 7, 12) }), // Mon–Wed
      line({ jobNo: "J2", isCustom: true }),
      line({ jobNo: "J3", value: 0 }),
      line({ jobNo: "J4", spanDays: 2 }), // stretched to Tue
    ];
    expect(dayValue(lines, TUE, regionOf, valueOf).combined).toEqual({ total: 2000, jobs: 2 });
    expect(lineDays(lines[3]!)[1]).toEqual(TUE);
  });
});
