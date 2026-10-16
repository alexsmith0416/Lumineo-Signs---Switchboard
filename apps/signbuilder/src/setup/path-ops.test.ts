import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import { answerQuestion, evaluate } from "../engine/flow";
import { SetupIndex } from "../engine/setup-index";
import { firstAllowed, hiddenReason, seedPath, signOfType, testSign } from "./path-ops";

const idx = new SetupIndex(DEMO_SETUP);
const T = "WALL-CAB-LIT";

describe("test & path", () => {
  it("a test sign starts on the category's first type; signOfType answers the first questions to pick a type", () => {
    const s = testSign(idx, "WALLCAB");
    expect(s.signTypeCode).toBe(idx.firstSignType("WALLCAB")!.code);
    const ni = signOfType(idx, "WALL-CAB-NI");
    expect(ni.signTypeCode).toBe("WALL-CAB-NI");
    expect(ni.typeDecided).toBe(true);
  });

  it("seeds the answers that bring a conditional question up, and says why it's hidden otherwise", () => {
    // WALL_TYPE shows when Installed by is Lumineo or Subcontractor.
    let line = signOfType(idx, T);
    line = answerQuestion(idx, line, "full", "INSTALL_BY", "Customer").evaluation.line;
    const q = idx.question(T, "WALL_TYPE")!;
    const ev = evaluate(idx, line, "full");
    expect(ev.states.WALL_TYPE!.eligible).toBe(false);
    expect(hiddenReason(idx, ev.line, q, ev.states.WALL_TYPE)).toContain("No rule shows it");

    const seeded = seedPath(idx, T, "WALL_TYPE");
    expect(evaluate(idx, seeded, "full").states.WALL_TYPE!.eligible).toBe(true);
    expect(seeded.signTypeCode).toBe(T);
  });

  it("firstAllowed reads rule values", () => {
    expect(firstAllowed(idx, T, "INSTALL_BY", "Customer|Lumineo")).toBe("Customer");
    expect(firstAllowed(idx, T, "INSTALL_BY", "!Lumineo")).toBe("Customer");
    expect(firstAllowed(idx, T, "INSTALL_BY", "")).toBe("Lumineo");
  });
});
