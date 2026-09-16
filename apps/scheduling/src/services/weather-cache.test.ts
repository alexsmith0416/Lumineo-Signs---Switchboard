import { describe, expect, it } from "vitest";
import { buildWeatherMap, weatherFilter, WEATHER_LOOKBACK_DAYS } from "./dataverse-live";

describe("weatherFilter", () => {
  it("reads only dated rows from the lookback window onward", () => {
    expect(WEATHER_LOOKBACK_DAYS).toBe(14);
    expect(weatherFilter(new Date(2026, 8, 15, 16, 30))).toBe("lum_date ge 2026-09-01");
  });

  it("crosses month and year boundaries in local time", () => {
    expect(weatherFilter(new Date(2026, 2, 3))).toBe("lum_date ge 2026-02-17");
    expect(weatherFilter(new Date(2027, 0, 5))).toBe("lum_date ge 2026-12-22");
  });
});

describe("buildWeatherMap", () => {
  it("keys per-day forecasts by ZIP and day", () => {
    const m = buildWeatherMap([
      { lum_location: " 67460 ", lum_date: "2026-09-15", lum_tempf: 88, lum_conditiontext: "Sunny", lum_humidity: 40 },
      { lum_location: "67460", lum_date: "2026-09-16T00:00:00Z", lum_tempf: 71, lum_conditiontext: "Rain" },
    ]);
    expect(m.get("67460|2026-09-15")).toMatchObject({ tempF: 88, condition: "Sunny", humidity: 40 });
    expect(m.get("67460|2026-09-16")).toMatchObject({ tempF: 71, condition: "Rain" });
  });

  it("ignores legacy dateless rows and rows with no ZIP", () => {
    const m = buildWeatherMap([
      { lum_location: "67460", lum_date: null, lum_tempf: 77, lum_conditiontext: "Clear" },
      { lum_location: "", lum_date: "2026-09-15", lum_tempf: 60 },
    ]);
    expect(m.size).toBe(0);
  });
});
