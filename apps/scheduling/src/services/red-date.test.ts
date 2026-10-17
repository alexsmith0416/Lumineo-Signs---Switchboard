import { describe, expect, it } from "vitest";
import type { Employee } from "../engine/types";
import { firstPastRedDate, pastRedDate, pickRedDateCrew, redDateRegion, redDateWindow } from "./red-date";

const d = (s: string) => new Date(s);
const emp = (id: string, departmentId: string, position: number, extra: Partial<Employee> = {}): Employee =>
  ({
    id,
    name: id,
    departmentId,
    productivityRate: 1,
    standardHoursPerDay: 8,
    maxOvertimePerDay: 0,
    worksWeekends: false,
    position,
    ...extra,
  }) as Employee;

// Install location ids (install-meta): 3 Olathe, 4 Topeka, 5 Lawrence, 0 Hutchinson, 1 Wichita.
const OLATHE_JOB = { lat: 38.88, lng: -94.8 };
const TOPEKA_JOB = { lat: 39.05, lng: -95.68 };

describe("pastRedDate", () => {
  const red = d("2026-10-23T00:00:00");
  it("allows ending any time on the red date", () => {
    expect(pastRedDate(d("2026-10-23T16:00:00"), red)).toBe(false);
    expect(pastRedDate(d("2026-10-24T00:00:00"), red)).toBe(false); // midnight = end of the 23rd
  });
  it("blocks ending on a later day", () => {
    expect(pastRedDate(d("2026-10-24T09:00:00"), red)).toBe(true);
  });
});

describe("firstPastRedDate", () => {
  const red = new Map([["J1", d("2026-10-23T00:00:00")]]);
  it("finds a job card that runs past its red date, skipping custom cards", () => {
    const late = { jobNo: "J1", endDateTime: d("2026-10-26T12:00:00") };
    expect(firstPastRedDate([{ ...late, isCustom: true }], (j) => red.get(j))).toBeNull();
    expect(firstPastRedDate([late], (j) => red.get(j))?.jobNo).toBe("J1");
    expect(firstPastRedDate([{ jobNo: "J2", endDateTime: d("2027-01-01") }], (j) => red.get(j))).toBeNull();
  });
});

describe("redDateRegion", () => {
  it("maps the Jobs list Install Region", () => {
    expect(redDateRegion("NEK")).toBe("NEK");
    expect(redDateRegion("wk")).toBe("WK");
    expect(redDateRegion("")).toBeNull();
    expect(redDateRegion("Sub-Installer")).toBe("skip");
    expect(redDateRegion("HOUSE")).toBe("skip");
  });
});

describe("pickRedDateCrew", () => {
  const crew = [
    emp("olathe-2", "3", 2),
    emp("olathe-1", "3", 1),
    emp("topeka-1", "4", 1),
    emp("olathe-assist", "3", 0, { isAssist: true }),
    emp("hutch-1", "0", 1),
  ];
  it("takes the top person at the location nearest the ship-to", () => {
    expect(pickRedDateCrew(OLATHE_JOB, "NEK", crew)?.employee.id).toBe("olathe-1");
    expect(pickRedDateCrew(TOPEKA_JOB, "NEK", crew)?.employee.id).toBe("topeka-1");
  });
  it("stays in the job's region", () => {
    expect(pickRedDateCrew(OLATHE_JOB, "WK", crew)?.employee.id).toBe("hutch-1");
  });
  it("falls back to the next-nearest location with a crew", () => {
    expect(pickRedDateCrew(TOPEKA_JOB, "NEK", crew.filter((e) => e.departmentId !== "4"))?.employee.id).toBe("olathe-1");
  });
  it("returns null when the region has no crew", () => {
    expect(pickRedDateCrew(OLATHE_JOB, "NEK", [emp("hutch-1", "0", 1)])).toBeNull();
  });
});

describe("redDateWindow", () => {
  const red = d("2026-10-23T00:00:00"); // a Friday
  it("puts a day or less on the red date at 8:00", () => {
    const w = redDateWindow(red, 6);
    expect(w.start).toEqual(d("2026-10-23T08:00:00"));
    expect(w.end).toEqual(d("2026-10-23T14:00:00"));
  });
  it("starts longer work early enough to finish on the red date", () => {
    const w = redDateWindow(red, 20); // 3 days: Wed, Thu, Fri (4 h)
    expect(w.days).toBe(3);
    expect(w.start).toEqual(d("2026-10-21T08:00:00"));
    expect(w.end).toEqual(d("2026-10-23T12:00:00"));
  });
  it("defaults to one day when the job has no install hours", () => {
    expect(redDateWindow(red, 0).end).toEqual(d("2026-10-23T16:00:00"));
  });
});
