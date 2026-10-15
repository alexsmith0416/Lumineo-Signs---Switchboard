import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import { answerQuestion, newSignLine } from "../engine/flow";
import { SetupIndex } from "../engine/setup-index";
import {
  addQuestion,
  copyDefaults,
  deleteQuestion,
  moveOption,
  questionCodeError,
  removeOption,
  setDefaultFor,
  setShowRule,
  shownWhen,
  typesWithBoth,
  updateOption,
} from "./question-ops";

const T = "WALL-CAB-LIT";

describe("answers", () => {
  it("renaming an answer renames it in this type's rules, defaults and Selected When", () => {
    let s = setDefaultFor(DEMO_SETUP, T, "FACE_TYPE", "Routed & Backed", "LIGHTING", "RGB LED Modules");
    s = updateOption(s, T, "FACE_TYPE", "Routed & Backed", { value: "Routed and Backed" });
    expect(s.options.some((o) => o.signTypeCode === T && o.value === "Routed and Backed")).toBe(true);
    expect(s.rules.filter((r) => r.signTypeCode === T && r.triggerQuestion === "FACE_TYPE").some((r) => r.triggerAnswer === "Routed and Backed")).toBe(true);
    expect(s.rules.some((r) => r.signTypeCode === T && r.triggerAnswer === "Routed & Backed")).toBe(false);
    expect(s.defaultRules[0]!.triggerAnswer).toBe("Routed and Backed");
    // Other sign types keep their own wording.
    expect(s.options.some((o) => o.signTypeCode !== T && o.value === "Routed & Backed") || !DEMO_SETUP.options.some((o) => o.signTypeCode !== T && o.value === "Routed & Backed")).toBe(true);

    const w = updateOption(DEMO_SETUP, T, "WORK", "New cabinet", { value: "Brand new cabinet" });
    expect(w.signTypes.find((t) => t.code === T)!.selectedWhen).toBe("LIT=Yes; WORK=Brand new cabinet");
  });

  it("removing an answer removes the rules that stand on it; moving reorders", () => {
    const s = removeOption(DEMO_SETUP, T, "FACE_TYPE", "Routed & Backed");
    expect(s.rules.some((r) => r.signTypeCode === T && r.triggerAnswer === "Routed & Backed")).toBe(false);
    const m = moveOption(DEMO_SETUP, T, "IN_OUT", "Interior", -1);
    const order = new SetupIndex(m).options(T, "IN_OUT").map((o) => o.value);
    expect(order).toEqual(["Interior", "Exterior"]);
  });
});

describe("questions", () => {
  it("adds after the selected question and deletes with its rules", () => {
    const after = DEMO_SETUP.questions.find((q) => q.signTypeCode === T && q.code === "FACE_TYPE")!;
    expect(questionCodeError(DEMO_SETUP, T, "FACE_TYPE")).toContain("already");
    const s = addQuestion(DEMO_SETUP, T, "new_q", "New question", after);
    const q = s.questions.find((x) => x.signTypeCode === T && x.code === "NEW_Q")!;
    expect(q.sortOrder).toBeGreaterThan(after.sortOrder);
    expect(q.sectionCode).toBe(after.sectionCode);
    const d = deleteQuestion(DEMO_SETUP, T, "FACE_TYPE");
    expect(d.rules.some((r) => r.signTypeCode === T && (r.triggerQuestion === "FACE_TYPE" || r.targetQuestion === "FACE_TYPE"))).toBe(false);
  });
});

describe("rules", () => {
  it("the show matrix adds and removes rules, and Shown when reads them back", () => {
    let s = setShowRule(DEMO_SETUP, T, "FACE_TYPE", "Flex Face", "BACKER", true);
    const idx = new SetupIndex(s);
    expect(shownWhen(idx, idx.question(T, "BACKER")!)).toContain("Flex Face");
    s = setShowRule(s, T, "FACE_TYPE", "Flex Face", "BACKER", false);
    expect(s.rules.some((r) => r.signTypeCode === T && r.targetQuestion === "BACKER" && r.triggerAnswer === "Flex Face")).toBe(false);
  });

  it("the defaults matrix: one rule per answer; a specific answer beats 'any'", () => {
    let s = setDefaultFor(DEMO_SETUP, T, "FACE_TYPE", "", "LIGHTING", "RGB LED Modules"); // any answer
    s = setDefaultFor(s, T, "FACE_TYPE", "Plex Face", "LIGHTING", "White LED Modules");
    s = setDefaultFor(s, T, "FACE_TYPE", "Plex Face", "LIGHTING", "White LED Modules"); // same cell again
    expect(s.defaultRules.filter((r) => r.triggerAnswer === "Plex Face").length).toBe(1);
    const idx = new SetupIndex(s);
    let line = newSignLine(idx, "s", 10000, "WALLCAB", "full");
    for (const [q, v] of [["LIT", "Yes"], ["WORK", "New cabinet"], ["FACE_TYPE", "Plex Face"]] as const) line = answerQuestion(idx, line, "full", q, v).evaluation.line;
    expect(line.answers.LIGHTING!.v).toBe("White LED Modules");
    line = answerQuestion(idx, line, "full", "FACE_TYPE", "Routed & Backed").evaluation.line;
    expect(line.answers.LIGHTING!.v).toBe("RGB LED Modules");
    expect(setDefaultFor(s, T, "FACE_TYPE", "Plex Face", "LIGHTING", "").defaultRules.some((r) => r.triggerAnswer === "Plex Face")).toBe(false);
  });

  it("copies a pair's defaults to other sign types that have both questions", () => {
    const s = setDefaultFor(DEMO_SETUP, T, "IN_OUT", "Interior", "INSTALL_BY", "Customer");
    const others = typesWithBoth(s, T, "IN_OUT", "INSTALL_BY");
    expect(others.length).toBeGreaterThan(0);
    const c = copyDefaults(s, T, "IN_OUT", "INSTALL_BY", others);
    for (const t of others) expect(c.defaultRules.some((r) => r.signTypeCode === t && r.value === "Customer")).toBe(true);
    expect(new Set(c.defaultRules.map((r) => r.id)).size).toBe(c.defaultRules.length);
  });
});
