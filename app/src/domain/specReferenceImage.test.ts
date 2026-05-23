import { describe, expect, it } from "vitest";
import { getSpecReferenceImage } from "./specReferenceImage";
import { emptySignSpec, type SignSpec } from "./SignSpec";

function build(o: Partial<SignSpec>): SignSpec {
  return { ...emptySignSpec(), ...o };
}

describe("getSpecReferenceImage", () => {
  it("returns null when no sign type is selected", () => {
    expect(getSpecReferenceImage(emptySignSpec())).toBeNull();
  });

  it("maps each letter sign type to its dedicated spec page", () => {
    const cases: Array<[SignSpec["signTypeCode"], string]> = [
      ["FL", "ST-12_Front_Lit_Channel_Letters"],
      ["HL", "ST-13_Halo_Lit_Channel_Letters"],
      ["CL", "ST-14_Combo_Lit_Channel_Letters"],
      ["AL", "ST-15_FCO_Aluminum_Letters"],
      ["CA", "ST-16_Cast_Aluminum_Letters"],
      ["PL", "ST-18_Formed_Plastic_Letters"],
      ["AC", "ST-19_FCO_Acrylic_Letters"],
    ];
    for (const [t, expected] of cases) {
      const r = getSpecReferenceImage(build({ signTypeCode: t }));
      expect(r, `letter ${t} should resolve`).not.toBeNull();
      expect(r!.thumb).toContain(expected);
      expect(r!.full).toContain(expected);
    }
  });

  it("maps pans, post-and-panel, and EMC to their dedicated pages", () => {
    expect(getSpecReferenceImage(build({ signTypeCode: "AP" }))!.thumb)
      .toContain("ST-01_Aluminum_Pan_Sign");
    expect(getSpecReferenceImage(build({ signTypeCode: "EP" }))!.thumb)
      .toContain("ST-02_Economy_Pan_Sign");
    expect(getSpecReferenceImage(build({ signTypeCode: "PP" }))!.thumb)
      .toContain("ST-03_Post_Panel_Sign");
    expect(getSpecReferenceImage(build({ signTypeCode: "EM" }))!.thumb)
      .toContain("ST-22_EMC_Standards");
  });

  it("uses the non-illuminated cabinet page for any NI cabinet", () => {
    for (const t of ["WC", "MN", "PS"] as const) {
      const r = getSpecReferenceImage(build({ signTypeCode: t, faces: "SF", illumination: "NI" }));
      expect(r!.thumb).toContain("ST-04_NonIllum_Cabinet");
    }
  });

  it("branches cabinets on faces + face type when illuminated", () => {
    const sfRouted = getSpecReferenceImage(build({
      signTypeCode: "WC", faces: "SF", illumination: "IL", faceType: "RFPB",
    }));
    const dfRouted = getSpecReferenceImage(build({
      signTypeCode: "WC", faces: "DF", illumination: "IL", faceType: "RFPT",
    }));
    expect(sfRouted!.thumb).toContain("ST-10_SF_Routed_Copy_Cabinet");
    expect(dfRouted!.thumb).toContain("ST-11_DF_Routed_Copy_Cabinet");

    const sfPlex = getSpecReferenceImage(build({
      signTypeCode: "WC", faces: "SF", illumination: "IL", faceType: "PT",
    }));
    const dfPlex = getSpecReferenceImage(build({
      signTypeCode: "WC", faces: "DF", illumination: "IL", faceType: "PT",
    }));
    expect(sfPlex!.thumb).toContain("ST-06_SF_Acrylic_Poly_Cabinet");
    expect(dfPlex!.thumb).toContain("ST-07_DF_Acrylic_Poly_Cabinet");

    const sfFlex = getSpecReferenceImage(build({
      signTypeCode: "WC", faces: "SF", illumination: "IL", faceType: "DF",
    }));
    const dfFlex = getSpecReferenceImage(build({
      signTypeCode: "WC", faces: "DF", illumination: "IL", faceType: "DF",
    }));
    expect(sfFlex!.thumb).toContain("ST-08_SF_Flex_Face_Cabinet");
    expect(dfFlex!.thumb).toContain("ST-09_DF_Flex_Face_Cabinet");
  });

  it("returns null for an illuminated cabinet with no face type yet", () => {
    const r = getSpecReferenceImage(build({
      signTypeCode: "WC", faces: "SF", illumination: "IL", faceType: "",
    }));
    expect(r).toBeNull();
  });

  it("strips the ST-NN_ prefix and underscores from the caption", () => {
    const r = getSpecReferenceImage(build({ signTypeCode: "FL" }));
    expect(r!.caption).toBe("Front Lit Channel Letters");
  });
});
