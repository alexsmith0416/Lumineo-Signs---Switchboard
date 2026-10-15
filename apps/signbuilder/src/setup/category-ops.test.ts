import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import { SetupIndex } from "../engine/setup-index";
import { checkSetup } from "./check-setup";
import {
  addCategory,
  categoryCodeError,
  deleteCategory,
  deleteCategoryBlocker,
  moveCategory,
  newTypeInCategory,
  prefixClashes,
  updateCategory,
} from "./category-ops";

const order = (s: typeof DEMO_SETUP) => [...s.categories].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.code);

describe("categories", () => {
  it("adds (inactive, at the end), checks codes, and reorders", () => {
    const first = order(DEMO_SETUP)[0]!;
    expect(categoryCodeError(DEMO_SETUP, first)).toContain("already");
    expect(categoryCodeError(DEMO_SETUP, "bad code!")).toContain("letters");
    const s = addCategory(DEMO_SETUP, "awning", "Awnings", "aw");
    const c = s.categories.find((x) => x.code === "AWNING")!;
    expect(c).toMatchObject({ active: false, codePrefix: "AW", description: "Awnings" });
    expect(order(s).at(-1)).toBe("AWNING");
    const m = moveCategory(s, "AWNING", -1);
    expect(order(m).at(-2)).toBe("AWNING");
    expect(moveCategory(s, first, -1)).toBe(s);
  });

  it("deletes only empty categories, with their checklist lines", () => {
    const used = DEMO_SETUP.signTypes[0]!.categoryCode;
    expect(deleteCategoryBlocker(DEMO_SETUP, used)).toContain("sign type");
    expect(() => deleteCategory(DEMO_SETUP, used)).toThrow();
    let s = addCategory(DEMO_SETUP, "AWNING", "Awnings", "AW");
    s = { ...s, checklist: [...s.checklist, { lineNo: 1, categoryCode: "AWNING", group: "", detail: "x", inForm: "", stage: "job", notes: "", questionCodes: "" }] };
    const d = deleteCategory(s, "AWNING");
    expect(d.categories.some((c) => c.code === "AWNING")).toBe(false);
    expect(d.checklist.some((l) => l.categoryCode === "AWNING")).toBe(false);
  });

  it("a new sign type in a category is a copy of another, inactive; the category can then be switched on", () => {
    let s = addCategory(DEMO_SETUP, "AWNING", "Awnings", "AW");
    s = newTypeInCategory(s, "AWNING", "WALL-CAB-LIT", "AWN-LIT", "Lighted awning");
    const t = s.signTypes.find((x) => x.code === "AWN-LIT")!;
    expect(t).toMatchObject({ categoryCode: "AWNING", active: false, selectedWhen: "" });
    expect(s.questions.filter((q) => q.signTypeCode === "AWN-LIT").length).toBe(s.questions.filter((q) => q.signTypeCode === "WALL-CAB-LIT").length);
    // Active category with no active type → a problem; with the type on → fine.
    s = updateCategory(s, "AWNING", { active: true });
    expect(checkSetup(s, { categoryCode: "AWNING" }).some((i) => i.severity === "error" && !i.signTypeCode)).toBe(true);
    s = { ...s, signTypes: s.signTypes.map((x) => (x.code === "AWN-LIT" ? { ...x, active: true } : x)) };
    expect(new SetupIndex(s).firstSignType("AWNING")?.code).toBe("AWN-LIT");
    expect(checkSetup(s, { categoryCode: "AWNING" }).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("warns when two categories share a Spec Code prefix", () => {
    const a = DEMO_SETUP.categories.find((c) => c.active)!;
    const s = updateCategory(addCategory(DEMO_SETUP, "ZZ", "Other", a.codePrefix), "ZZ", { active: true });
    expect(prefixClashes(s, "ZZ", a.codePrefix).map((c) => c.code)).toEqual([a.code]);
    expect(checkSetup(s).some((i) => i.text.includes("Spec Code prefix"))).toBe(true);
    expect(checkSetup(DEMO_SETUP).some((i) => i.text.includes("Spec Code prefix"))).toBe(false);
  });
});
