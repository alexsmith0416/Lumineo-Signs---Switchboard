import { describe, expect, it } from "vitest";
import {
  cellValue,
  computeFormulaDate,
  describeFormula,
  linkFor,
  normalizeValue,
  withCustomFields,
  type CustomFieldDef,
} from "./custom-fields";
import type { JobRow } from "./job-tracking";

const def = (o: Partial<CustomFieldDef>): CustomFieldDef => ({ key: "cf_x", label: "X", type: "text", width: 100, ...o });

describe("computeFormulaDate", () => {
  it("adds days, weeks or working days to the base date", () => {
    expect(computeFormulaDate("2026-09-30", { baseField: "b", offset: 3, unit: "days" })).toBe("2026-10-03");
    expect(computeFormulaDate("2026-09-30", { baseField: "b", offset: 2, unit: "weeks" })).toBe("2026-10-14");
    // Wed Sep 30 + 3 working days = Mon Oct 5
    expect(computeFormulaDate("2026-09-30", { baseField: "b", offset: 3, unit: "workdays" })).toBe("2026-10-05");
    expect(computeFormulaDate("2026-09-30", { baseField: "b", offset: -1, unit: "weeks" })).toBe("2026-09-23");
  });
  it("is blank when the base date is", () => {
    expect(computeFormulaDate("", { baseField: "b", offset: 3, unit: "days" })).toBe("");
    expect(computeFormulaDate(undefined, { baseField: "b", offset: 3, unit: "days" })).toBe("");
  });
});

describe("describeFormula", () => {
  it("reads like the field editor", () => {
    expect(describeFormula({ baseField: "releaseDate", offset: 3, unit: "weeks" }, [])).toBe("= Release Date + 3 weeks");
    expect(describeFormula({ baseField: "cf_d", offset: -1, unit: "workdays" }, [def({ key: "cf_d", label: "Permit", type: "date" })]))
      .toBe("= Permit − 1 working day");
  });
});

describe("normalizeValue", () => {
  it("cleans each type for storage", () => {
    expect(normalizeValue(def({ type: "currency" }), "$1,234.567")).toBe(1234.57);
    expect(normalizeValue(def({ type: "number" }), "")).toBeNull();
    expect(normalizeValue(def({ type: "text" }), "  hi  ")).toBe("hi");
    expect(normalizeValue(def({ type: "text" }), "   ")).toBeNull();
    expect(normalizeValue(def({ type: "url" }), "lumineosigns.com")).toBe("https://lumineosigns.com");
    expect(normalizeValue(def({ type: "date" }), "2026-10-01")).toBe("2026-10-01");
    expect(normalizeValue(def({ type: "date" }), "")).toBeNull();
    expect(normalizeValue(def({ type: "multiselect" }), ["A", "", "B"])).toEqual(["A", "B"]);
    expect(normalizeValue(def({ type: "bool" }), true)).toBe(true);
  });
});

describe("cellValue / linkFor", () => {
  it("shapes values for the grid", () => {
    expect(cellValue(def({ type: "multiselect" }), ["A", "B"])).toBe("A, B");
    expect(cellValue(def({ type: "number" }), "x")).toBeNull();
    expect(cellValue(def({ type: "bool" }), undefined)).toBe(false);
  });
  it("links URL / email / phone values", () => {
    expect(linkFor("email", "a@b.com")).toBe("mailto:a@b.com");
    expect(linkFor("phone", "(316) 555-0100")).toBe("tel:3165550100");
    expect(linkFor("url", "https://x.com")).toBe("https://x.com");
    expect(linkFor("url", "javascript:alert(1)")).toBe("");
  });
});

describe("withCustomFields", () => {
  it("puts values on each row, and computes formula dates from built-in or custom dates", () => {
    const defs = [
      def({ key: "cf_permit", label: "Permit", type: "date" }),
      def({ key: "cf_tags", label: "Tags", type: "multiselect", opts: ["A", "B"] }),
      def({ key: "cf_due", label: "Due", type: "formula-date", formula: { baseField: "cf_permit", offset: 1, unit: "weeks" } }),
      def({ key: "cf_rel", label: "Rel+2", type: "formula-date", formula: { baseField: "releaseDate", offset: 2, unit: "days" } }),
    ];
    const rows = [{ jobNo: "J1", releaseDate: "2026-09-01" }, { jobNo: "J2", releaseDate: "" }] as unknown as JobRow[];
    const vals: Record<string, Record<string, unknown>> = { J1: { cf_permit: "2026-10-01", cf_tags: ["B"] } };
    const [a, b] = withCustomFields(rows, defs, (j) => vals[j]) as unknown as Array<Record<string, unknown>>;
    expect(a).toMatchObject({ cf_permit: "2026-10-01", cf_tags: "B", cf_due: "2026-10-08", cf_rel: "2026-09-03" });
    expect(b).toMatchObject({ cf_permit: "", cf_tags: "", cf_due: "", cf_rel: "" });
  });
});
