import { describe, expect, it } from "vitest";
import { formatDimension, formatHWD, joinFtIn, splitFtIn } from "./dimensions";

describe("splitFtIn", () => {
  it("splits 42 total inches into 3 ft + 6 in", () => {
    expect(splitFtIn("42")).toEqual({ ft: "3", in: "6" });
  });

  it("emits a blank `in` when the total is a whole foot", () => {
    // 36" = 3'0" — the inches box should be blank, not "0", so the
    // placeholder "0" still shows.
    expect(splitFtIn("36")).toEqual({ ft: "3", in: "" });
  });

  it("emits a blank `ft` when the total is sub-foot", () => {
    expect(splitFtIn("10")).toEqual({ ft: "", in: "10" });
  });

  it("returns both blank for empty, zero, or invalid input", () => {
    expect(splitFtIn("")).toEqual({ ft: "", in: "" });
    expect(splitFtIn("0")).toEqual({ ft: "", in: "" });
    expect(splitFtIn("not a number")).toEqual({ ft: "", in: "" });
  });

  it("handles fractional inches without losing precision", () => {
    // 18.5" = 1'6.5"
    expect(splitFtIn("18.5")).toEqual({ ft: "1", in: "6.5" });
  });
});

describe("joinFtIn", () => {
  it("multiplies feet by 12 and adds inches", () => {
    expect(joinFtIn("3", "6")).toBe("42");
    expect(joinFtIn("10", "0")).toBe("120");
    expect(joinFtIn("0", "6")).toBe("6");
  });

  it("returns empty string when both boxes are blank", () => {
    expect(joinFtIn("", "")).toBe("");
  });

  it("treats a blank box as 0", () => {
    expect(joinFtIn("3", "")).toBe("36");
    expect(joinFtIn("", "6")).toBe("6");
  });

  it("round-trips through splitFtIn", () => {
    for (const total of ["12", "36", "42", "120", "6.5", "18.5"]) {
      const { ft, in: inches } = splitFtIn(total);
      expect(joinFtIn(ft, inches)).toBe(total);
    }
  });
});

describe("formatDimension", () => {
  it("formats common cabinet sizes as ft'in\"", () => {
    expect(formatDimension("42")).toBe('3\'6"');
    expect(formatDimension("120")).toBe('10\'0"');
    expect(formatDimension("6")).toBe('0\'6"');
  });

  it("returns an em-dash for empty / zero", () => {
    expect(formatDimension("")).toBe("—");
    expect(formatDimension("0")).toBe("—");
    expect(formatDimension(undefined)).toBe("—");
    expect(formatDimension(null)).toBe("—");
  });

  it("keeps fractional inches readable", () => {
    expect(formatDimension("6.5")).toBe('0\'6.5"');
    expect(formatDimension("18.5")).toBe('1\'6.5"');
  });

  it("trims trailing zeros from fractional inches", () => {
    expect(formatDimension("6.50")).toBe('0\'6.5"');
    expect(formatDimension("6.500")).toBe('0\'6.5"');
  });
});

describe("formatHWD", () => {
  it("joins three dimensions with the × glyph", () => {
    expect(formatHWD("36", "120", "12")).toBe('3\'0" × 10\'0" × 1\'0"');
  });

  it("drops empty / zero columns from the join", () => {
    expect(formatHWD("36", "120", "")).toBe('3\'0" × 10\'0"');
    expect(formatHWD("36", "120", "0")).toBe('3\'0" × 10\'0"');
  });

  it("returns an em-dash when every dimension is blank", () => {
    expect(formatHWD("", "", "")).toBe("—");
  });
});
