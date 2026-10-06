import { describe, expect, it } from "vitest";
import {
  NO_JOB_EDITS,
  canEditJobField,
  formatJobEditFields,
  hasAnyJobEdits,
  jobEditAccess,
  parseJobEditFields,
} from "./job-edit-access";

describe("Jobs edit access", () => {
  it("lets a full editor change any field", () => {
    const a = jobEditAccess(true, []);
    expect(canEditJobField(a, "status")).toBe(true);
    expect(canEditJobField(a, "cf_anything")).toBe(true);
  });

  it("limits everyone else to exactly the fields granted to them", () => {
    const a = jobEditAccess(false, ["vendorStatus", "dateInstalled"]);
    expect(canEditJobField(a, "vendorStatus")).toBe(true);
    expect(canEditJobField(a, "dateInstalled")).toBe(true);
    expect(canEditJobField(a, "status")).toBe(false);
    expect(canEditJobField(a, "notes")).toBe(false);
    expect(a.all).toBe(false);
    expect(hasAnyJobEdits(a)).toBe(true);
  });

  it("is view only with no grants", () => {
    expect(hasAnyJobEdits(NO_JOB_EDITS)).toBe(false);
    expect(hasAnyJobEdits(jobEditAccess(false, []))).toBe(false);
    expect(canEditJobField(jobEditAccess(false, []), "status")).toBe(false);
  });

  it("stores the grants as clean comma-separated keys", () => {
    expect(parseJobEditFields(" vendor, ,po,vendor ")).toEqual(["vendor", "po"]);
    expect(parseJobEditFields(null)).toEqual([]);
    expect(formatJobEditFields(["po", "vendor", "po", ""])).toBe("po,vendor");
  });
});
