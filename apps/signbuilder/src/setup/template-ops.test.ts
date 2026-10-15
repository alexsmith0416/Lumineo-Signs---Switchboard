import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import type { Spec } from "../domain/types";
import { buildFromTemplates } from "../engine/descriptions";
import { SetupIndex } from "../engine/setup-index";
import { checkSetup } from "./check-setup";
import {
  addTemplateLine,
  copyTemplateFrom,
  deleteTemplateLine,
  linesOf,
  moveTemplateLine,
  replaceQuestionInLine,
  sampleSign,
  suggestReplacements,
  templateLineProblems,
  updateTemplateLine,
} from "./template-ops";

const T = "WALL-CAB-LIT";
const spec = { designReference: "D-1", jobNo: "J1", jobDetailNotes: "", detailLevel: "full" } as Spec;
const texts = (s: typeof DEMO_SETUP, type = T) => linesOf(s, type, "field").map((l) => l.text);

describe("editing lines", () => {
  it("adds between two lines, at the top, and renumbers when there's no room", () => {
    const r = addTemplateLine(DEMO_SETUP, T, "field", 10000, { text: "Between" });
    expect(texts(r.setup)[1]).toBe("Between");
    expect(r.lineNo).toBe(15000);
    const top = addTemplateLine(DEMO_SETUP, T, "field", 0, { text: "Top" });
    expect(texts(top.setup)[0]).toBe("Top");
    // Squeeze lines 10000 and 10001 together: no room → renumbered, order kept.
    const tight = updateTemplateLine(DEMO_SETUP, T, "field", 20000, {});
    const squeezed = { ...tight, templates: tight.templates.map((l) => (l.signTypeCode === T && l.lineNo === 20000 ? { ...l, lineNo: 10001 } : l)) };
    const n = addTemplateLine(squeezed, T, "field", 10000, { text: "Squeezed" });
    expect(texts(n.setup).slice(0, 3)).toEqual(["Installation by customer.", "Squeezed", "Install ({QTY}) new {TYPE}, {Q:SIGN_SIZE}."]);
    expect(linesOf(n.setup, T, "field").map((l) => l.lineNo)).toContain(n.lineNo);
    // Other sign types untouched.
    expect(texts(n.setup, "WALL-CAB-NI")).toEqual(texts(DEMO_SETUP, "WALL-CAB-NI"));
  });

  it("moves, deletes and copies from another sign type", () => {
    const m = moveTemplateLine(DEMO_SETUP, T, "field", 10000, 1);
    expect(texts(m).slice(0, 2)).toEqual(["Install ({QTY}) new {TYPE}, {Q:SIGN_SIZE}.", "Installation by customer."]);
    expect(moveTemplateLine(DEMO_SETUP, T, "field", 10000, -1)).toBe(DEMO_SETUP);
    const d = deleteTemplateLine(DEMO_SETUP, T, "field", 10000);
    expect(texts(d)).not.toContain("Installation by customer.");
    const c = copyTemplateFrom(DEMO_SETUP, "WALL-CAB-NI", T, "field");
    expect(texts(c)).toEqual(texts(DEMO_SETUP, "WALL-CAB-NI"));
  });
});

describe("problems", () => {
  it("flags missing questions, unknown tokens and answers that don't exist; offers replacements", () => {
    const s = updateTemplateLine(DEMO_SETUP, T, "field", 30000, { text: "Mount {Q:MOUNT_STYLE} with {BOGUS}.", conditionQuestion: "PERMIT", conditionValues: "Maybe" });
    const idx = new SetupIndex(s);
    const line = linesOf(s, T, "field").find((l) => l.lineNo === 30000)!;
    const kinds = templateLineProblems(idx, line).map((p) => `${p.kind}:${p.code}`);
    expect(kinds).toEqual(["missingQuestion:MOUNT_STYLE", "unknownToken:BOGUS", "valueNotAnswer:PERMIT"]);
    expect(suggestReplacements(idx, T, "MOUNT_STYLE").map((q) => q.code)).toContain("MOUNTING");
    const fixed = replaceQuestionInLine(line, "MOUNT_STYLE", "MOUNTING");
    expect(fixed.text).toBe("Mount {Q:MOUNTING} with {BOGUS}.");
    expect(checkSetup(s).filter((i) => i.area === "descriptions" && i.signTypeCode === T)).toHaveLength(3);
    expect(checkSetup(DEMO_SETUP).filter((i) => i.area === "descriptions")).toHaveLength(0);
  });
});

describe("preview", () => {
  it("answers every question that comes up, and follows the picks", () => {
    const idx = new SetupIndex(DEMO_SETUP);
    const sign = sampleSign(idx, T, {});
    const text = buildFromTemplates(idx, spec, [sign], "field");
    expect(text).toContain("Install (1) new");
    expect(text).not.toContain("Installation by customer.");
    const byCustomer = buildFromTemplates(idx, spec, [sampleSign(idx, T, { INSTALL_BY: "Customer" })], "field");
    expect(byCustomer).toContain("Installation by customer.");
    expect(byCustomer).not.toContain("Install (1) new");
  });
});
