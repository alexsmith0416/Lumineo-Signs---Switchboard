import { describe, expect, it } from "vitest";
import { mapSpecToEstimatePieces } from "./estimateMapping";
import { emptySignSpec, type SignSpec } from "./SignSpec";

function build(o: Partial<SignSpec>): SignSpec {
  return { ...emptySignSpec(), ...o };
}

describe("mapSpecToEstimatePieces — typeIds match Estimating's registry", () => {
  it("WC + DF + RFPB → df-routed-cabinet with pushThrough='No'", () => {
    const pieces = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "DF", illumination: "IL", faceType: "RFPB",
      heightIn: "48", widthIn: "84", depthIn: "12", quantity: 1,
    }));
    const primary = pieces[0];
    expect(primary.typeId).toBe("df-routed-cabinet");
    expect(primary.inputs.H).toBe(48);
    expect(primary.inputs.L).toBe(84);
    expect(primary.inputs.D).toBe(12);
    expect(primary.inputs.pushThrough).toBe("No");
  });

  it("WC + DF + RFPT routes push-through input correctly", () => {
    const pieces = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "DF", faceType: "RFPT", heightIn: "36", widthIn: "120",
    }));
    expect(pieces[0].typeId).toBe("df-routed-cabinet");
    expect(pieces[0].inputs.pushThrough).toBe("Yes");
  });

  it("WC + SF + PT → sf-acrylic-cabinet", () => {
    const p = mapSpecToEstimatePieces(build({ signTypeCode: "WC", faces: "SF", faceType: "PT" }));
    expect(p[0].typeId).toBe("sf-acrylic-cabinet");
  });

  it("WC + DF + DF → df-flex-cabinet", () => {
    const p = mapSpecToEstimatePieces(build({ signTypeCode: "WC", faces: "DF", faceType: "DF" }));
    expect(p[0].typeId).toBe("df-flex-cabinet");
  });

  it("PP → post-and-panel", () => {
    const p = mapSpecToEstimatePieces(build({ signTypeCode: "PP", faces: "SF", faceType: "AT" }));
    expect(p[0].typeId).toBe("post-and-panel");
  });

  it("AP → alum-pan-sign; EP → economy-pan-sign (two different piece types)", () => {
    const ap = mapSpecToEstimatePieces(build({ signTypeCode: "AP", faces: "SF", faceType: "AT" }));
    const ep = mapSpecToEstimatePieces(build({ signTypeCode: "EP", faces: "SF", faceType: "AT" }));
    expect(ap[0].typeId).toBe("alum-pan-sign");
    expect(ep[0].typeId).toBe("economy-pan-sign");
  });

  it("FL → channel-letter-fabrication with face='block' default", () => {
    const p = mapSpecToEstimatePieces(build({
      signTypeCode: "FL", faces: "NA", faceType: "AT", heightIn: "12", widthIn: "60",
    }));
    expect(p[0].typeId).toBe("channel-letter-fabrication");
    expect(p[0].inputs.face).toBe("block");
    // Rough perimeter seeded from H + L: (12 + 60) * 2 = 144 inches
    expect(p[0].inputs.inches).toBe(144);
  });

  it("AL → routed-alum-faces-letters; AC → routed-push-through-acrylic", () => {
    const al = mapSpecToEstimatePieces(build({ signTypeCode: "AL", faces: "NA", faceType: "AT" }));
    const ac = mapSpecToEstimatePieces(build({ signTypeCode: "AC", faces: "NA", faceType: "AT" }));
    expect(al[0].typeId).toBe("routed-alum-faces-letters");
    expect(ac[0].typeId).toBe("routed-push-through-acrylic");
  });

  it("CA + PL fall back to freeform-tm (no exact piece type in registry)", () => {
    const ca = mapSpecToEstimatePieces(build({ signTypeCode: "CA", faces: "NA", faceType: "AT" }));
    const pl = mapSpecToEstimatePieces(build({ signTypeCode: "PL", faces: "NA", faceType: "AT" }));
    expect(ca[0].typeId).toBe("freeform-tm");
    expect(pl[0].typeId).toBe("freeform-tm");
  });

  it("EM → emc-assembly", () => {
    const p = mapSpecToEstimatePieces(build({ signTypeCode: "EM", faces: "SF", faceType: "EM" }));
    expect(p[0].typeId).toBe("emc-assembly");
  });
});

describe("mapSpecToEstimatePieces — additional pieces driven by options", () => {
  it("vinyl=CV adds vinyl-cutting + apply-vinyl-graphics", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "SF", faceType: "PT",
      vinyl: "CV", vinylColor: "3M 3630 — 022 Black",
    })).map((p) => p.typeId);
    expect(types).toContain("vinyl-cutting");
    expect(types).toContain("apply-vinyl-graphics");
  });

  it("vinyl=DV adds apply-vinyl-graphics only (no cutting)", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "SF", faceType: "PT", vinyl: "DV",
    })).map((p) => p.typeId);
    expect(types).toContain("apply-vinyl-graphics");
    expect(types).not.toContain("vinyl-cutting");
  });

  it("finish=P + faces=DF adds paint-calculation with faces=2", () => {
    const paint = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "DF", faceType: "AT", finish: "P", paintColor: "PMS 286",
    })).find((p) => p.typeId === "paint-calculation");
    expect(paint).toBeDefined();
    expect(paint!.inputs.faces).toBe(2);
    expect(paint!.label).toBe("Paint — PMS 286");
  });

  it("illumination=IL on non-letters adds led-wiring", () => {
    const cab = mapSpecToEstimatePieces(build({
      signTypeCode: "WC", faces: "SF", faceType: "AT", illumination: "IL",
    })).map((p) => p.typeId);
    expect(cab).toContain("led-wiring");

    // Channel letters bundle LED — no separate piece.
    const fl = mapSpecToEstimatePieces(build({
      signTypeCode: "FL", faces: "NA", faceType: "AT", illumination: "IL",
    })).map((p) => p.typeId);
    expect(fl).not.toContain("led-wiring");
  });

  it("FL adds trimcap-letter-face on top of channel-letter-fabrication", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "FL", faces: "NA", faceType: "AT",
    })).map((p) => p.typeId);
    expect(types).toContain("channel-letter-fabrication");
    expect(types).toContain("trimcap-letter-face");
  });

  it("MN + New Pole adds pole-cover + structural-steel", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "MN", faces: "SF", faceType: "AT",
      poleType: "New Pole", poleDiameter: "6in", poleMaterial: "Steel",
    })).map((p) => p.typeId);
    expect(types).toContain("pole-cover");
    expect(types).toContain("structural-steel");
  });

  it("MN + Existing Pole does NOT add pole-cover", () => {
    const types = mapSpecToEstimatePieces(build({
      signTypeCode: "MN", faces: "SF", faceType: "AT", poleType: "Existing Pole",
    })).map((p) => p.typeId);
    expect(types).not.toContain("pole-cover");
  });
});
