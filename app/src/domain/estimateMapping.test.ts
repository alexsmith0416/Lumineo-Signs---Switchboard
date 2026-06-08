import { describe, expect, it } from "vitest";
import { mapSpecToEstimatePieces } from "./estimateMapping";
import { emptySignSpec, type SignSpec } from "./SignSpec";

function build(o: Partial<SignSpec>): SignSpec {
  return { ...emptySignSpec(), ...o };
}

describe("mapSpecToEstimatePieces — primary piece selection", () => {
  it("WC + DF + RFPB → Df Routed Cabinet (per ALE-244 acceptance)", () => {
    const pieces = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "DF", illumination: "IL", faceType: "RFPB",
      heightIn: "48", widthIn: "84", depthIn: "12", quantity: 1,
    }));
    const primary = pieces[0];
    expect(primary.pieceType).toBe("Df Routed Cabinet");
    expect(primary.heightIn).toBe("48");
    expect(primary.lengthIn).toBe("84");
    expect(primary.depthIn).toBe("12");
  });

  it("WC + SF + PT → Sf Acrylic Cabinet", () => {
    const p = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "SF", faceType: "PT",
    }));
    expect(p[0].pieceType).toBe("Sf Acrylic Cabinet");
  });

  it("WC + DF + DF (direct print) → Df Flex Cabinet", () => {
    const p = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "DF", faceType: "DF",
    }));
    expect(p[0].pieceType).toBe("Df Flex Cabinet");
  });

  it("PP → Post & Panel", () => {
    const p = mapSpecToEstimatePieces(build({ signTypeCode: "PP", faces: "SF", faceType: "AT" }));
    expect(p[0].pieceType).toBe("Post & Panel");
  });

  it("AP → Alum/Economy Pan with Aluminum option; EP → economy option", () => {
    const ap = mapSpecToEstimatePieces(build({ signTypeCode: "AP", faces: "SF", faceType: "AT" }));
    const ep = mapSpecToEstimatePieces(build({ signTypeCode: "EP", faces: "SF", faceType: "AT" }));
    expect(ap[0].pieceType).toBe("Alum/Economy Pan");
    expect(ap[0].options).toBe("Aluminum");
    expect(ep[0].options).toBe("Economy");
  });

  it("FL → Channel Letter Fabrication (Front-Lit)", () => {
    const p = mapSpecToEstimatePieces(build({ signTypeCode: "FL", faces: "NA", faceType: "AT" }));
    expect(p[0].pieceType).toBe("Channel Letter Fabrication");
    expect(p[0].options).toBe("Front-Lit");
  });

  it("EM → EMC Assembly", () => {
    const p = mapSpecToEstimatePieces(build({ signTypeCode: "EM", faces: "SF", faceType: "EM" }));
    expect(p[0].pieceType).toBe("EMC Assembly");
  });
});

describe("mapSpecToEstimatePieces — additional pieces driven by options", () => {
  it("adds Vinyl Cutting + Apply Vinyl Graphics when vinyl=CV", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "SF", faceType: "PT",
      vinyl: "CV", vinylColor: "3M 3630 — 022 Black",
    })).map((p) => p.pieceType);
    expect(types).toContain("Vinyl Cutting");
    expect(types).toContain("Apply Vinyl Graphics");
  });

  it("adds Apply Vinyl only (no Vinyl Cutting) for digital print", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "SF", faceType: "PT", vinyl: "DV",
    })).map((p) => p.pieceType);
    expect(types).toContain("Apply Vinyl Graphics");
    expect(types).not.toContain("Vinyl Cutting");
  });

  it("adds Paint Calculation with qty=2 for double-face shop-painted", () => {
    const paint = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "DF", faceType: "AT", finish: "P", paintColor: "PMS 286",
    })).find((p) => p.pieceType === "Paint Calculation");
    expect(paint).toBeDefined();
    expect(paint!.qty).toBe(2);
    expect(paint!.notes).toBe("PMS 286");
  });

  it("adds LED Wiring for illuminated NON-letter signs", () => {
    const cabinet = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "SF", faceType: "AT", illumination: "IL",
    })).map((p) => p.pieceType);
    expect(cabinet).toContain("LED Wiring");

    // Front-lit letters bundle LED into the fabrication piece; no separate LED Wiring.
    const fl = mapSpecToEstimatePieces(build({
      signTypeCode: "FL", faces: "NA", faceType: "AT", illumination: "IL",
    })).map((p) => p.pieceType);
    expect(fl).not.toContain("LED Wiring");
  });

  it("adds Pole Cover + Structural Steel for MN with New Pole", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "MN", faces: "SF", faceType: "AT",
      poleType: "New Pole", poleDiameter: "6in", poleMaterial: "Steel",
    })).map((p) => p.pieceType);
    expect(types).toContain("Pole Cover");
    expect(types).toContain("Structural Steel");
  });

  it("does NOT add Pole Cover when poleType is Existing Pole", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "MN", faces: "SF", faceType: "AT", poleType: "Existing Pole",
    })).map((p) => p.pieceType);
    expect(types).not.toContain("Pole Cover");
  });
});
