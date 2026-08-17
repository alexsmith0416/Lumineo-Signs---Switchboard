import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CHECK_COLUMNS,
  MAX_CHECK_COLUMNS,
  MAX_CHECK_LABEL,
  addCheckOption,
  normalizeCheckLabel,
  removeCheckOption,
  toggleCheckColumn,
  visibleCheckColumns,
} from "./print-columns";

describe("normalizeCheckLabel", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeCheckLabel("  Strapped   down  ")).toBe("Strapped down");
  });

  it("caps the length so a column stays narrow", () => {
    expect(normalizeCheckLabel("x".repeat(50))).toHaveLength(MAX_CHECK_LABEL);
  });

  it("returns empty for blank input", () => {
    expect(normalizeCheckLabel("   ")).toBe("");
  });
});

describe("addCheckOption", () => {
  it("appends a new option", () => {
    expect(addCheckOption(["Loaded"], "Strapped")).toEqual(["Loaded", "Strapped"]);
  });

  it("normalizes before adding", () => {
    expect(addCheckOption([], "  Tarped  ")).toEqual(["Tarped"]);
  });

  it("ignores a duplicate regardless of case, by identity", () => {
    const options = ["Loaded", "Order"];
    expect(addCheckOption(options, "loaded")).toBe(options);
    expect(addCheckOption(options, "LOADED")).toBe(options);
  });

  it("ignores a blank label, by identity", () => {
    const options = ["Loaded"];
    expect(addCheckOption(options, "   ")).toBe(options);
  });

  it("does not mutate the input", () => {
    const options = ["Loaded"];
    addCheckOption(options, "Tarped");
    expect(options).toEqual(["Loaded"]);
  });
});

describe("removeCheckOption", () => {
  it("removes a user-added option", () => {
    expect(removeCheckOption(["Loaded", "Tarped"], "Tarped")).toEqual(["Loaded"]);
  });

  it("refuses to remove a built-in", () => {
    const options = ["Loaded", "Order"];
    for (const builtIn of BUILT_IN_CHECK_COLUMNS) {
      expect(removeCheckOption(options, builtIn)).toBe(options);
    }
  });

  it("is a no-op for an unknown label, by identity", () => {
    const options = ["Loaded", "Tarped"];
    expect(removeCheckOption(options, "Nope")).toBe(options);
  });
});

describe("toggleCheckColumn", () => {
  it("selects and deselects", () => {
    expect(toggleCheckColumn(["Loaded"], "Order")).toEqual(["Loaded", "Order"]);
    expect(toggleCheckColumn(["Loaded", "Order"], "Order")).toEqual(["Loaded"]);
  });

  it("matches case-insensitively when deselecting", () => {
    expect(toggleCheckColumn(["Loaded"], "loaded")).toEqual([]);
  });

  it("stops at the column cap, by identity", () => {
    const full = Array.from({ length: MAX_CHECK_COLUMNS }, (_, i) => `C${i}`);
    expect(toggleCheckColumn(full, "One more")).toBe(full);
    // …but unticking still works at the cap.
    expect(toggleCheckColumn(full, "C0")).toHaveLength(MAX_CHECK_COLUMNS - 1);
  });
});

describe("visibleCheckColumns", () => {
  it("returns selected columns in library order, not click order", () => {
    const options = ["Loaded", "Order", "Tarped"];
    expect(visibleCheckColumns(["Tarped", "Loaded"], options)).toEqual(["Loaded", "Tarped"]);
  });

  it("drops a selection whose option was deleted", () => {
    expect(visibleCheckColumns(["Loaded", "Gone"], ["Loaded", "Order"])).toEqual(["Loaded"]);
  });

  it("returns nothing when nothing is selected", () => {
    expect(visibleCheckColumns([], ["Loaded", "Order"])).toEqual([]);
  });
});
