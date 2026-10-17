import { describe, expect, it } from "vitest";
import type { Employee, ScheduleLine } from "../engine/types";
import { parseWorkRadius, radiusFlags, type WorkRadiusConfig } from "./work-radius";

// Location ids: 3 Olathe, 4 Topeka.
const topekaCrew = { id: "t1", name: "T", departmentId: "4" } as Employee;
const employees = new Map([["t1", topekaCrew]]);
const line = (id: string, extra: Partial<ScheduleLine> = {}) =>
  ({ id, jobNo: `J${id}`, employeeId: "t1", ...extra }) as ScheduleLine;
const OLATHE = { lat: 38.88, lng: -94.8 };
const NEAR_TOPEKA = { lat: 39.03, lng: -95.7 };
const cfg = (c: Partial<WorkRadiusConfig> = {}): WorkRadiusConfig => ({ radius: { "4": 30 }, mode: "outline", overrides: {}, ...c });

describe("radiusFlags", () => {
  it("flags a Topeka crew's Olathe job in Olathe's colours", () => {
    const f = radiusFlags({ lines: [line("1")], employees, config: cfg(), positionOf: () => OLATHE }).get("1");
    expect(f).toMatchObject({ locationId: "3", locationName: "Olathe", homeName: "Topeka", manual: false });
    expect(f!.miles).toBeGreaterThan(30);
  });
  it("leaves jobs inside the radius, and locations with no radius, alone", () => {
    expect(radiusFlags({ lines: [line("1")], employees, config: cfg(), positionOf: () => NEAR_TOPEKA }).size).toBe(0);
    expect(radiusFlags({ lines: [line("1")], employees, config: cfg({ radius: {} }), positionOf: () => OLATHE }).size).toBe(0);
  });
  it("honours a hand-set location or 'none'", () => {
    const manual = radiusFlags({ lines: [line("1")], employees, config: cfg({ overrides: { "1": "5" } }), positionOf: () => NEAR_TOPEKA });
    expect(manual.get("1")).toMatchObject({ locationId: "5", locationName: "Lawrence", manual: true });
    expect(radiusFlags({ lines: [line("1")], employees, config: cfg({ overrides: { "1": "none" } }), positionOf: () => OLATHE }).size).toBe(0);
  });
  it("skips custom cards and cards with no position", () => {
    expect(radiusFlags({ lines: [line("1", { isCustom: true })], employees, config: cfg(), positionOf: () => OLATHE }).size).toBe(0);
    expect(radiusFlags({ lines: [line("1")], employees, config: cfg(), positionOf: () => null }).size).toBe(0);
  });
});

describe("parseWorkRadius", () => {
  it("keeps valid miles, mode and overrides", () => {
    expect(parseWorkRadius({ radius: { "4": "60", "3": -1 }, mode: "fill", overrides: { a: "3", b: 5 } })).toEqual({
      radius: { "4": 60 }, mode: "fill", overrides: { a: "3" },
    });
    expect(parseWorkRadius(undefined).mode).toBe("outline");
  });
});
