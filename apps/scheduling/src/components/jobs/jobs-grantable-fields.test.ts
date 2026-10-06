import { describe, expect, it } from "vitest";
import { grantableFields } from "./jobs-grantable-fields";
import type { CustomFieldDef } from "../../services/custom-fields";

const def = (key: string, type: CustomFieldDef["type"]): CustomFieldDef => ({ key, label: key, type, width: 100 });

describe("grantable Jobs fields", () => {
  const keys = grantableFields([def("cf_a", "text"), def("cf_due", "formula-date"), def("cf_cost", "currency")]).map((f) => f.key);

  it("offers the fields someone can actually change", () => {
    expect(keys).toEqual(expect.arrayContaining(["status", "job", "stepper", "sketch", "vendorStatus", "dateInstalled", "notes", "cf_a"]));
  });

  it("never offers calculated or BC-filled columns", () => {
    for (const k of ["mfgTarget", "installTarget", "dip", "doh", "location", "value", "remaining", "cf_due"]) {
      expect(keys).not.toContain(k);
    }
  });

  it("flags Currency custom fields as $ (hidden from logins without $ access)", () => {
    expect(grantableFields([def("cf_cost", "currency")]).find((f) => f.key === "cf_cost")?.money).toBe(true);
  });

  it("lists each field once", () => {
    expect(new Set(keys).size).toBe(keys.length);
  });
});
