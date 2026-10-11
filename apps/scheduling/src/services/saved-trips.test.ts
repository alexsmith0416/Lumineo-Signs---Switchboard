import { describe, expect, it } from "vitest";
import { clock, dayMapsUrl, defaultTripName, duration, type TripStop } from "./saved-trips";
import type { TripPlan } from "./trip-plan";

const stop = (jobNo: string, address: string): TripStop => ({ jobNo, name: jobNo, address, zip: "67401", kind: "install", hours: 2, lat: 38.8, lng: -97.6 });

describe("saved trip helpers", () => {
  it("formats clock times and durations", () => {
    expect(clock(7)).toBe("7:00 AM");
    expect(clock(13.5)).toBe("1:30 PM");
    expect(clock(12)).toBe("12:00 PM");
    expect(duration(0.75)).toBe("45 m");
    expect(duration(2)).toBe("2 h");
    expect(duration(1.42)).toBe("1 h 25 m");
  });

  it("links one day's drive in Google Maps, home to home", () => {
    const plan: TripPlan = {
      order: [1, 2],
      overnight: false,
      nights: 0,
      driveHours: 3,
      miles: 150,
      workHours: 4,
      warnings: [],
      days: [
        {
          day: 1,
          driveHours: 3,
          workHours: 4,
          endsAt: "home",
          events: [
            { type: "drive", from: 0, to: 1, hours: 1, miles: 50 },
            { type: "work", stop: 1, hours: 2, part: 1, parts: 1 },
            { type: "drive", from: 1, to: 2, hours: 1, miles: 50 },
            { type: "work", stop: 2, hours: 2, part: 1, parts: 1 },
            { type: "drive", from: 2, to: 0, hours: 1, miles: 50 },
          ],
        },
      ],
    };
    const trip = {
      home: { name: "Hutchinson", address: "1429 W 4th Ave, Hutchinson, KS 67501", lat: 38.05, lng: -97.95 },
      stops: [stop("J1", "1 Main St, Salina, KS"), stop("J2", "")],
      plan,
    };
    const url = new URL(dayMapsUrl(trip, 0));
    expect(url.searchParams.get("origin")).toBe("1429 W 4th Ave, Hutchinson, KS 67501");
    expect(url.searchParams.get("destination")).toBe(url.searchParams.get("origin"));
    expect(url.searchParams.get("waypoints")).toBe("1 Main St, Salina, KS 67401|38.80000,-97.60000");
    expect(dayMapsUrl(trip, 5)).toBe("");
  });

  it("names a trip by region, home and towns", () => {
    expect(defaultTripName("WK", "Hutchinson", [stop("J1", "1 Main St, Salina, KS"), stop("J2", "2 Elm, Abilene, KS")])).toBe(
      "WK · Hutchinson → Salina, Abilene · 2 jobs",
    );
    expect(defaultTripName("WK", "Hutchinson", [stop("J1", "1 Main St, Hutchinson, KS")])).toBe("WK · Hutchinson (local) · 1 job");
  });
});
