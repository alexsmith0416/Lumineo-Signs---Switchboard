import { describe, expect, it } from "vitest";
import { emptySignSpec } from "./SignSpec";

describe("emptySignSpec", () => {
  it("initializes every field so React inputs stay controlled", () => {
    const spec = emptySignSpec();
    // Strings must be the empty string, not undefined.
    const stringKeys: (keyof typeof spec)[] = [
      "productCode", "name", "customerName", "projectName",
      "signTypeCode", "faces", "illumination",
      "faceType", "faceTypeCustom", "finish", "finishCustom", "paintColor",
      "vinyl", "vinylColor", "vinylHex", "digitalRef",
      "mounting", "mountingCustom",
      "heightIn", "widthIn", "depthIn",
      "backerType", "backerTypeCustom", "backerColor",
      "poleType", "poleDiameter", "poleMaterial",
      "footingType", "footingDepth", "footingMethod",
      "electrical", "conduitSize", "panelLocation",
      "notes", "departments",
    ];
    for (const k of stringKeys) {
      expect(spec[k], `field "${String(k)}" should default to ""`).toBe("");
    }
    expect(spec.quantity).toBe(1);
    expect(spec.outsourced).toBe(false);
    expect(spec.ledColor).toBe("WH");
    expect(spec.status).toBe("Draft");
  });
});
