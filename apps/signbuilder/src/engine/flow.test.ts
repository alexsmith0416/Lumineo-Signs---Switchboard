import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import type { Spec } from "../domain/types";
import { buildFromTemplates, buildProduction } from "./descriptions";
import { answerQuestion, evaluate, newSignLine, setQuantity } from "./flow";
import { SetupIndex } from "./setup-index";
import { formatLength, parseLength } from "./values";

const idx = new SetupIndex(DEMO_SETUP);

const spec: Spec = {
  id: "s1", number: "SPEC-0001", description: "Test", purpose: "walkIn", status: "draft", detailLevel: "full",
  opportunityNo: "", jobNo: "J1234", projectId: "", customerNo: "", customerName: "Acme", contactName: "", designReference: "",
  jobDetailNotes: "", createdAt: "", createdBy: "", modifiedAt: "", lastGeneratedAt: "", approvedBy: "", approvedAt: "",
};

function answer(line: ReturnType<typeof newSignLine>, code: string, value: string) {
  return answerQuestion(idx, line, "full", code, value).evaluation.line;
}

describe("sizes", () => {
  it("reads feet and inches", () => {
    expect(parseLength("4' 6")).toBe(54);
    expect(parseLength("6-1/2")).toBe(6.5);
    expect(parseLength("abc")).toBeNull();
    expect(formatLength(54)).toBe("4’-6”");
    expect(formatLength(7.5)).toBe("7 1/2”");
  });
});

describe("flow", () => {
  it("starts at Quantity, then waits on Lighted?", () => {
    const line = newSignLine(idx, "s1", 10000, "WALLCAB", "full");
    const ev = evaluate(idx, line, "full");
    expect(ev.states.QTY!.value).toBe("1");
    expect(ev.states.LIT!.nextStep).toBe(true);
    expect(line.typeDecided).toBe(false);
    expect(line.specCode).toBe("WC-EXT-SF"); // defaults count; no type segment yet
  });

  it("first questions pick the sign type and carry answers over", () => {
    let line = newSignLine(idx, "s1", 10000, "WALLCAB", "full");
    line = answer(line, "LIT", "no");
    expect(line.signTypeCode).toBe("WALL-CAB-LIT");
    line = answer(line, "WORK", "new cab");
    expect(line.signTypeCode).toBe("WALL-CAB-NI");
    expect(line.typeDecided).toBe(true);
    expect(line.answers.LIT!.v).toBe("No");
    expect(line.specCode.startsWith("WC-NI")).toBe(true);
  });

  it("rules show questions, limit answers and clear what no longer applies", () => {
    let line = newSignLine(idx, "s1", 10000, "WALLCAB", "full");
    line = answer(line, "LIT", "Yes");
    line = answer(line, "WORK", "New cabinet");
    line = answer(line, "FACE_TYPE", "Routed & Backed");
    let ev = evaluate(idx, line, "full");
    expect(ev.states.ROUTE_FACE!.eligible).toBe(true);
    expect(ev.states.BACKER!.restricted).toBe(false);
    line = answer(line, "BACKER", "3mm ACM");

    // Push-thru only offers plex: the ACM backer is cleared and reported.
    const res = answerQuestion(idx, line, "full", "FACE_TYPE", "Routed w/ Push Thru");
    ev = res.evaluation;
    expect(ev.states.BACKER!.restricted).toBe(true);
    expect(ev.states.BACKER!.allowed).toEqual([".177” White Plex"]);
    expect(ev.cleared.map((c) => c.prompt)).toContain("Backer material");
    expect(() => answerQuestion(idx, ev.line, "full", "BACKER", "3mm ACM")).toThrow(/isn't offered/);

    // Plex face: the routed questions go away.
    ev = answerQuestion(idx, ev.line, "full", "FACE_TYPE", "Plex Face").evaluation;
    expect(ev.states.ROUTE_FACE!.eligible).toBe(false);
    expect(ev.states.FACE_PLEX!.eligible).toBe(true);
  });

  it("only the opportunity questions at opportunity detail", () => {
    let line = newSignLine(idx, "s1", 10000, "WALLCAB", "opportunity");
    line = answerQuestion(idx, line, "opportunity", "LIT", "Yes").evaluation.line;
    line = answerQuestion(idx, line, "opportunity", "WORK", "New cabinet").evaluation.line;
    const ev = evaluate(idx, line, "opportunity");
    expect(ev.states.PAINT_COLOR!.visible).toBe(false);
    expect(ev.states.FACE_TYPE!.inScope).toBe(true);
  });

  it("quantity column and question stay in step", () => {
    const line = newSignLine(idx, "s1", 10000, "WALLCAB", "full");
    const ev = setQuantity(idx, line, "full", 3);
    expect(ev.line.answers.QTY!.v).toBe("3");
    expect(answer(ev.line, "QTY", "5").quantity).toBe(5);
  });
});

describe("descriptions", () => {
  it("builds production and field text", () => {
    let line = newSignLine(idx, "s1", 10000, "WALLCAB", "full");
    line = answer(line, "LIT", "Yes");
    line = answer(line, "WORK", "New cabinet");
    line = answer(line, "SIGN_SIZE", "48x96");
    line = answer(line, "FACE_TYPE", "Plex Face");
    line = answer(line, "MOUNTING", "Flush to wall");
    line = answer(line, "WALL_TYPE", "Needs Survey");
    line = answer(line, "ELEC", "Existing at sign location");
    line = answer(line, "PERMIT", "Customer to secure");
    const production = buildProduction(idx, spec, [line]);
    expect(production).toContain("*** SURVEY NEEDED: Wall type ***");
    expect(production).toContain("SIGN OVERVIEW");
    expect(production).toContain("• SCOPE OF WORK: New I/I Wall Sign Cabinet");
    expect(production).toContain("• Qty: 1");
    expect(production).toContain("• Sign Size: 4’-0” (H) x 8’-0” (W)");
    expect(production).toContain("      - Applied internally to sign backer");
    const field = buildFromTemplates(idx, spec, [line], "field");
    expect(field).toContain("SURVEY NEEDED to confirm: Wall type.");
    expect(field).toContain("Install (1) new I/I wall sign cabinet, 4’-0” (H) x 8’-0” (W).");
    // The wall type is still a survey, so that sentence is skipped.
    expect(field).not.toContain("Mount flush");
    expect(field).toContain("Connect to existing at sign location power.");
  });
});
