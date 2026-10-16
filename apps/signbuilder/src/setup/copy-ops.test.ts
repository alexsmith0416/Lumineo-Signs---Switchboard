import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import { evaluate } from "../engine/flow";
import { SetupIndex } from "../engine/setup-index";
import { checkSetup } from "./check-setup";
import { existingOn, pasteQuestions, sharePickingQuestions, withFollowUps } from "./copy-ops";
import { seedPath } from "./path-ops";
import { addQuestion, deleteQuestion, setDefaultFor, setShowRule, updateQuestion } from "./question-ops";

const A = "WALL-CAB-LIT";
const B = "WALL-CAB-NI";

describe("copy questions", () => {
  it("follow-ups: the questions a listed one brings up", () => {
    expect(withFollowUps(DEMO_SETUP, A, ["INSTALL_BY"])).toContain("WALL_TYPE");
    expect(withFollowUps(DEMO_SETUP, A, ["WALL_TYPE"])).toEqual(["WALL_TYPE"]);
  });

  it("pastes a new question with its answers, show rule and defaults; it works on the target", () => {
    let s = addQuestion(DEMO_SETUP, A, "NEW_Q", "New question");
    s = { ...s, options: [...s.options, { signTypeCode: A, questionCode: "NEW_Q", value: "One", sortOrder: 10 } as never, { signTypeCode: A, questionCode: "NEW_Q", value: "Two", sortOrder: 20 } as never] };
    s = updateQuestion(s, A, "NEW_Q", { scope: "conditional" });
    s = setShowRule(s, A, "INSTALL_BY", "Customer", "NEW_Q", true);
    s = setDefaultFor(s, A, "INSTALL_BY", "Customer", "NEW_Q", "Two");
    const r = pasteQuestions(s, A, ["NEW_Q"], [B], false);
    expect(r.pasted).toBe(1);
    expect(r.missingParents).toEqual([]);
    const out = r.setup;
    expect(out.options.filter((o) => o.signTypeCode === B && o.questionCode === "NEW_Q").map((o) => o.value)).toEqual(["One", "Two"]);
    expect(out.rules.filter((x) => x.signTypeCode === B && x.targetQuestion === "NEW_Q")).toHaveLength(1);
    const idx = new SetupIndex(out);
    const line = seedPath(idx, B, "NEW_Q");
    expect(evaluate(idx, line, "full").states.NEW_Q!.value).toBe("Two");
    expect(checkSetup(out).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("keeps or replaces questions the target already has, and flags missing parents", () => {
    let s = updateQuestion(DEMO_SETUP, A, "WALL_TYPE", { prompt: "Wall (from A)" });
    expect(existingOn(s, ["WALL_TYPE"], [B])).toEqual([{ type: B, codes: ["WALL_TYPE"] }]);
    const kept = pasteQuestions(s, A, ["WALL_TYPE"], [B], false);
    expect(kept.kept).toBe(1);
    expect(kept.setup).toBe(s);
    const replaced = pasteQuestions(s, A, ["WALL_TYPE"], [B], true).setup;
    expect(replaced.questions.find((q) => q.signTypeCode === B && q.code === "WALL_TYPE")!.prompt).toBe("Wall (from A)");
    // Rules about it aren't doubled.
    const before = DEMO_SETUP.rules.filter((r) => r.signTypeCode === B && r.targetQuestion === "WALL_TYPE").length;
    expect(replaced.rules.filter((r) => r.signTypeCode === B && r.targetQuestion === "WALL_TYPE")).toHaveLength(before);

    s = deleteQuestion(DEMO_SETUP, B, "INSTALL_BY");
    s = deleteQuestion(s, B, "WALL_TYPE");
    expect(pasteQuestions(s, A, ["WALL_TYPE"], [B], false).missingParents).toEqual([`${B}: WALL_TYPE`]);
  });

  it("shares the first questions with the category", () => {
    const s = updateQuestion(DEMO_SETUP, B, "LIT", { prompt: "Lit?" });
    expect(checkSetup(s).some((i) => i.text.includes("differs"))).toBe(true);
    const r = sharePickingQuestions(s, A);
    expect(r.types).toBeGreaterThan(0);
    expect(r.setup.questions.find((q) => q.signTypeCode === B && q.code === "LIT")!.prompt).not.toBe("Lit?");
    expect(checkSetup(r.setup).some((i) => i.text.includes("differs"))).toBe(false);
  });
});
