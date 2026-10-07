import { describe, expect, it } from "vitest";
import { builtinColumn, builtinEditor, builtinIsMulti, canToggleMulti, splitMulti } from "./field-options";
import { trackValue } from "./jobs-editable";
import { JOB_FIELDS } from "./jobs-fields";
import { cellValue, choiceList, compatibleTypes, normalizeValue, type CustomFieldDef } from "../../services/custom-fields";

describe("Edit field — built-in columns", () => {
  it("renames a column; blank or absent keeps the default name", () => {
    expect(builtinColumn(JOB_FIELDS.expeditor!, { label: "Expedited" }).label).toBe("Expedited");
    expect(builtinColumn(JOB_FIELDS.expeditor!, { label: "  " }).label).toBe("Expeditor");
    expect(builtinColumn(JOB_FIELDS.expeditor!).label).toBe("Expeditor");
  });

  it("only plain tracking choices switch Single / Multi — not Current Status, Hold or dates", () => {
    expect(canToggleMulti("vendor")).toBe(true);
    expect(canToggleMulti("sales")).toBe(true);
    expect(canToggleMulti("status")).toBe(false);
    expect(canToggleMulti("holdReason")).toBe(false);
    expect(canToggleMulti("dateToAdmin")).toBe(false);
  });

  it("Single / Multi follows the override, else the column's default", () => {
    expect(builtinIsMulti("vendor")).toBe(false);
    expect(builtinIsMulti("vendor", { multi: true })).toBe(true);
    expect(builtinIsMulti("sales")).toBe(true);
    expect(builtinIsMulti("sales", { multi: false })).toBe(false);
    // An override can't make Current Status multi.
    expect(builtinIsMulti("status", { multi: true })).toBe(false);
    expect(builtinColumn(JOB_FIELDS.vendor!, { multi: true }).multi).toBe(true);
  });

  it("the editor carries the edited options and Single / Multi", () => {
    const ed = builtinEditor("vendor", { multi: true, opts: ["GSG", "UFB"] })!;
    expect(ed.type).toBe("multiselect");
    expect(ed.opts).toEqual(["GSG", "UFB"]);
    expect(builtinEditor("dateToAdmin")!.type).toBe("date");
  });

  it("several values save as 'A, B' and read back as a list", () => {
    expect(trackValue({ type: "multiselect" }, ["GSG", "", "UFB"])).toBe("GSG, UFB");
    expect(trackValue({ type: "select" }, "GSG")).toBe("GSG");
    expect(trackValue({ type: "date" }, "2026-10-07")).toBe("2026-10-07");
    expect(trackValue({ type: "bool" }, true)).toBe(true);
    expect(splitMulti("GSG, UFB")).toEqual(["GSG", "UFB"]);
    expect(splitMulti("")).toEqual([]);
  });
});

describe("Edit field — custom field types", () => {
  const def = (type: CustomFieldDef["type"]): CustomFieldDef => ({ key: "cf_x", label: "X", type, width: 100 });

  it("switches only within a group that keeps every value", () => {
    expect(compatibleTypes("select")).toEqual(["select", "multiselect"]);
    expect(compatibleTypes("url")).toContain("text");
    expect(compatibleTypes("currency")).toEqual(["number", "currency"]);
    expect(compatibleTypes("date")).toEqual(["date"]);
    expect(compatibleTypes("formula-date")).toEqual(["formula-date"]);
  });

  it("Single / Multi Select read either saved shape", () => {
    expect(choiceList("A")).toEqual(["A"]);
    expect(choiceList(["A", "B"])).toEqual(["A", "B"]);
    expect(cellValue(def("select"), ["A", "B"])).toBe("A, B");
    expect(cellValue(def("multiselect"), "A")).toBe("A");
    expect(normalizeValue(def("multiselect"), "A")).toEqual(["A"]);
  });
});
