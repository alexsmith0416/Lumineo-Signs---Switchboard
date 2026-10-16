import { afterEach, describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import type { SetupData } from "../domain/types";
import { evaluate } from "../engine/flow";
import { SetupIndex } from "../engine/setup-index";
import { createMockRepo, setRepoOverride } from "../services/repo";
import { useSetupStore } from "../store/setup-store";
import { seedPath, signOfType } from "./path-ops";
import {
  addChecklistLine,
  addReferenceRule,
  addVinylColor,
  checklistOf,
  colorKey,
  deleteReferenceRule,
  deleteVinylColor,
  moveChecklistLine,
  moveReferenceRule,
  referenceCodeError,
  rulesOf,
  typesUsingReference,
  updateReferenceRule,
  updateVinylColor,
  vinylCodeError,
} from "./reference-ops";

const T = "WALL-CAB-LIT";

describe("reference rules", () => {
  it("the first matching rule picks the page; order and conditions change it", () => {
    const page = "P1";
    const other = "P2";
    let s: SetupData = { ...DEMO_SETUP, referenceRules: DEMO_SETUP.referenceRules.filter((r) => r.signTypeCode !== T) };
    s = addReferenceRule(s, T, page);
    s = addReferenceRule(s, T, other);
    const [first, second] = rulesOf(s, T);
    // A condition the sample won't meet on the first rule → the second wins.
    s = updateReferenceRule(s, T, first!.lineNo, { conditionQuestion: "INSTALL_BY", conditionValues: "Customer" });
    let idx = new SetupIndex(s);
    expect(evaluate(idx, signOfType(idx, T), "full").line.specReferenceCode).toBe(other);
    expect(evaluate(idx, seedPath(idx, T, "INSTALL_BY", "Customer"), "full").line.specReferenceCode).toBe(page);
    s = moveReferenceRule(s, T, second!.lineNo, -1);
    idx = new SetupIndex(s);
    expect(evaluate(idx, seedPath(idx, T, "INSTALL_BY", "Customer"), "full").line.specReferenceCode).toBe(other);
    expect(typesUsingReference(s, other)).toContain(T);
    s = deleteReferenceRule(s, T, second!.lineNo);
    expect(rulesOf(s, T)).toHaveLength(1);
    expect(referenceCodeError(s, "bad code!")).toContain("letters");
    expect(referenceCodeError({ ...s, references: [{ code: page, description: "", fileName: "", sharePointUrl: "" }] }, page)).toContain("already");
  });
});

describe("vinyl colors and checklist", () => {
  it("adds, edits and deletes colors", () => {
    const s = addVinylColor({ ...DEMO_SETUP, vinylColors: [] }, { series: "3630", code: "3630-99", name: "Test" });
    expect(vinylCodeError(s, "3630", "3630-99")).toContain("already");
    const key = colorKey({ series: "3630", code: "3630-99" });
    const e = updateVinylColor(s, key, { hex: "#ff0000", itemNo: "15000" });
    expect(e.vinylColors[0]).toMatchObject({ hex: "#ff0000", itemNo: "15000", name: "Test" });
    expect(deleteVinylColor(e, key).vinylColors).toEqual([]);
  });

  it("adds and moves checklist lines within a category", () => {
    let s: SetupData = { ...DEMO_SETUP, checklist: [] };
    s = addChecklistLine(s, "ALL", "Basics").setup;
    s = addChecklistLine(s, "ALL", "Basics").setup;
    s = { ...s, checklist: s.checklist.map((l, i) => ({ ...l, detail: `d${i}` })) };
    const [a] = checklistOf(s, "ALL");
    s = moveChecklistLine(s, a!.lineNo, 1);
    expect(checklistOf(s, "ALL").map((l) => l.detail)).toEqual(["d1", "d0"]);
  });
});

describe("reference pages in the store", () => {
  afterEach(() => setRepoOverride(null));

  it("saves a page with its images outside Undo", async () => {
    setRepoOverride(createMockRepo(null, { setup: DEMO_SETUP, specs: [], lines: [], projects: [] }));
    await useSetupStore.getState().load();
    const st = () => useSetupStore.getState();
    st().replace({ ...st().setup!, categories: [...st().setup!.categories] }, "an edit");
    await st().saveReference({ code: "NEW-PAGE", description: "New page", fileName: "", sharePointUrl: "", thumbnail: "data:x", fullImage: "data:y" });
    expect(st().setup!.references.some((r) => r.code === "NEW-PAGE")).toBe(true);
    expect((await st().referenceImages("NEW-PAGE")).fullImage).toBe("data:y");
    st().undo();
    expect(st().setup!.references.some((r) => r.code === "NEW-PAGE")).toBe(true);
    await st().deleteReference("NEW-PAGE");
    expect(st().setup!.references.some((r) => r.code === "NEW-PAGE")).toBe(false);
  });
});
