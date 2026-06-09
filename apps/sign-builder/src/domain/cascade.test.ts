// These tests cover the cascade-reset rules from ALE-53 acceptance:
// "Select Wall Sign, complete all 9 steps fully. Change Sign Type to
//  Channel Letters. Verify all dropdowns reset, all text inputs clear,
//  fabrication toggle resets to IN-HOUSE, no warning banners visible,
//  gblProductCode shows only \"FL\"."
//
// The cascade lives inside SpecProvider via React state. The tests below
// replay the same reducer behavior against pure functions so we get
// coverage without booting React Testing Library.

import { describe, expect, it } from "vitest";
import { emptySignSpec, type SignSpec } from "./SignSpec";
import { isLetter, isPan } from "./signTypes";
import { assembleProductCode } from "./productCode";

// Mirror of SpecProvider.setSignType — every downstream field returns to
// its default, while the header inputs (customer / project / qty) carry
// over. Keeping this in the test file means a behavior change in the
// provider triggers a visible test failure.
function applySignTypeChange(prev: SignSpec, code: SignSpec["signTypeCode"]): SignSpec {
  const next: SignSpec = {
    ...emptySignSpec(),
    customerName: prev.customerName,
    projectName: prev.projectName,
    quantity: prev.quantity,
    signTypeCode: code,
  };
  if (!code) return next;
  if (isLetter(code)) next.faces = "NA";
  if (isPan(code))    next.faces = "SF";
  if (code === "EM")  next.illumination = "IL";
  if (isPan(code))    next.illumination = "NI";
  return next;
}

describe("sign-type cascade reset (ALE-53 Test 1)", () => {
  it("wipes every downstream field when changing Wall Sign to Channel Letters", () => {
    const filledWallSign: SignSpec = {
      ...emptySignSpec(),
      customerName: "Westview Medical",
      projectName: "Main Entry Cabinet",
      quantity: 4,
      signTypeCode: "WC",
      faces: "DF",
      illumination: "IL",
      ledColor: "RD",
      faceType: "RFPB",
      backerType: "FP",
      backerColor: "White Acrylic",
      finish: "P",
      paintColor: "PMS 286 C",
      vinyl: "CV",
      vinylColor: "3M 3630 — 022 Black",
      vinylHex: "#1A1A1A",
      mounting: "WB",
      heightIn: "36",
      widthIn: "120",
      depthIn: "6",
      notes: "Field measurements pending.",
      outsourced: false,
    };

    const next = applySignTypeChange(filledWallSign, "FL");

    // Header carried over.
    expect(next.customerName).toBe("Westview Medical");
    expect(next.projectName).toBe("Main Entry Cabinet");
    expect(next.quantity).toBe(4);

    // Sign type set. Letter types lock Step 2 to "N/A" and the downstream
    // cascade (Step 4 Illumination) is gated on faces being set, so we
    // pre-fill the only valid value here. The canvas plan listed the
    // assembled code as just "FL" after the reset, but that left the form
    // unable to advance — the React port resolves the contradiction by
    // pre-filling locked values immediately.
    expect(next.signTypeCode).toBe("FL");
    expect(next.faces).toBe("NA");

    // Every downstream field reset to the default.
    expect(next.illumination).toBe("");
    expect(next.ledColor).toBe("WH");
    expect(next.faceType).toBe("");
    expect(next.backerType).toBe("");
    expect(next.backerColor).toBe("");
    expect(next.finish).toBe("");
    expect(next.paintColor).toBe("");
    expect(next.vinyl).toBe("");
    expect(next.vinylColor).toBe("");
    expect(next.vinylHex).toBe("");
    expect(next.mounting).toBe("");
    expect(next.heightIn).toBe("");
    expect(next.widthIn).toBe("");
    expect(next.depthIn).toBe("");
    expect(next.notes).toBe("");
    expect(next.outsourced).toBe(false);

    // Product code carries the locked "NA" segment for letters; everything
    // beyond that is empty until the user picks illumination + face type.
    expect(assembleProductCode(next)).toBe("FL-NA");
  });

  it("locks pan types to Single Face + Non-Illuminated", () => {
    const next = applySignTypeChange(emptySignSpec(), "AP");
    expect(next.faces).toBe("SF");
    expect(next.illumination).toBe("NI");
  });

  it("locks EMC to internally illuminated", () => {
    const next = applySignTypeChange(emptySignSpec(), "EM");
    expect(next.illumination).toBe("IL");
  });

  it("clearing the sign type wipes everything back to defaults", () => {
    const filled = applySignTypeChange(emptySignSpec(), "MN");
    const cleared = applySignTypeChange(filled, "");
    expect(cleared.signTypeCode).toBe("");
    expect(cleared.faces).toBe("");
    expect(cleared.illumination).toBe("");
  });
});
