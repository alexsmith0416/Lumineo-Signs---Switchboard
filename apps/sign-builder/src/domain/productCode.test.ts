import { describe, expect, it } from "vitest";
import { assembleProductCode, calculateDepartments } from "./productCode";
import { emptySignSpec, type SignSpec } from "./SignSpec";

function build(overrides: Partial<SignSpec>): SignSpec {
  return { ...emptySignSpec(), ...overrides };
}

describe("assembleProductCode", () => {
  it("returns empty when no sign type is selected", () => {
    expect(assembleProductCode(emptySignSpec())).toBe("");
  });

  it("includes only the sign type when nothing else is set", () => {
    expect(assembleProductCode(build({ signTypeCode: "WC" }))).toBe("WC");
  });

  it("joins all segments with hyphens, in order, skipping empties", () => {
    const spec = build({
      signTypeCode: "WC",
      faces:        "DF",
      illumination: "IL",
      faceType:     "RFPB",
      finish:       "P",
      vinyl:        "CV",
      mounting:     "WB",
      ledColor:     "WH",
    });
    expect(assembleProductCode(spec)).toBe("WC-DF-IL-RFPB-P-CV-WB-WH");
  });

  it("appends the LED segment only when illumination is IL or EL", () => {
    const il = build({ signTypeCode: "WC", faces: "SF", illumination: "IL", ledColor: "RD" });
    const el = build({ signTypeCode: "WC", faces: "SF", illumination: "EL", ledColor: "BL" });
    const ni = build({ signTypeCode: "WC", faces: "SF", illumination: "NI", ledColor: "WH" });
    expect(assembleProductCode(il).endsWith("-RD")).toBe(true);
    expect(assembleProductCode(el).endsWith("-BL")).toBe(true);
    // Non-illuminated must not carry an LED segment even with ledColor != "".
    expect(assembleProductCode(ni)).toBe("WC-SF-NI");
  });

  it("skips intermediate empty segments without leaving double hyphens", () => {
    const spec = build({
      signTypeCode: "FL",
      faces:        "NA",
      illumination: "NI",
      faceType:     "PT",
      mounting:     "DM",
    });
    // Finish + vinyl empty in the middle.
    expect(assembleProductCode(spec)).toBe("FL-NA-NI-PT-DM");
    expect(assembleProductCode(spec)).not.toMatch(/--/);
  });
});

describe("calculateDepartments", () => {
  it("returns empty when no sign type is set", () => {
    expect(calculateDepartments(emptySignSpec())).toBe("");
  });

  it("adds Grounding for MN / PS / PP", () => {
    for (const t of ["MN", "PS", "PP"] as const) {
      expect(calculateDepartments(build({ signTypeCode: t }))).toContain("Grounding");
    }
    expect(calculateDepartments(build({ signTypeCode: "WC" }))).not.toContain("Grounding");
  });

  it("skips Metal Fabrication when letters are outsourced", () => {
    const inHouse = build({ signTypeCode: "WC" });
    expect(calculateDepartments(inHouse)).toContain("Metal Fabrication");
    const outsourced = build({ signTypeCode: "FL", outsourced: true });
    expect(calculateDepartments(outsourced)).not.toContain("Metal Fabrication");
  });

  it("adds Paint only when finish is Shop Painted", () => {
    expect(calculateDepartments(build({ signTypeCode: "WC", finish: "P"   }))).toContain("Paint");
    expect(calculateDepartments(build({ signTypeCode: "WC", finish: "RWM" }))).not.toContain("Paint");
  });

  it("adds Vinyl unless the choice is No Vinyl or empty", () => {
    expect(calculateDepartments(build({ signTypeCode: "WC", vinyl: "CV" }))).toContain("Vinyl");
    expect(calculateDepartments(build({ signTypeCode: "WC", vinyl: "NV" }))).not.toContain("Vinyl");
    expect(calculateDepartments(build({ signTypeCode: "WC", vinyl: "" }))).not.toContain("Vinyl");
  });

  it("always includes Assembly", () => {
    expect(calculateDepartments(build({ signTypeCode: "WC" }))).toContain("Assembly");
  });
});
