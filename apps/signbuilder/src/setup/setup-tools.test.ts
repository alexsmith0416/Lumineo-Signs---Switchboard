import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import { checkSetup } from "./check-setup";
import { duplicateSignType, signTypeCodeError, updateSignType } from "./sign-type-ops";

const first = DEMO_SETUP.signTypes.find((t) => !t.isBlock)!;

describe("sign type edits", () => {
  it("duplicates a type with everything under it, inactive and unpickable", () => {
    const next = duplicateSignType(DEMO_SETUP, first.code, "copy-1", "");
    const copy = next.signTypes.find((t) => t.code === "COPY-1")!;
    expect(copy.active).toBe(false);
    expect(copy.selectedWhen).toBe("");
    expect(next.questions.filter((q) => q.signTypeCode === "COPY-1").length).toBe(DEMO_SETUP.questions.filter((q) => q.signTypeCode === first.code).length);
    expect(next.options.filter((o) => o.signTypeCode === "COPY-1").length).toBe(DEMO_SETUP.options.filter((o) => o.signTypeCode === first.code).length);
    const ruleIds = new Set(next.rules.map((r) => r.id));
    expect(ruleIds.size).toBe(next.rules.length); // copied rules get new ids
    expect(DEMO_SETUP.signTypes.some((t) => t.code === "COPY-1")).toBe(false); // original untouched
  });

  it("rejects bad or taken codes", () => {
    expect(signTypeCodeError(DEMO_SETUP, "")).not.toBe("");
    expect(signTypeCodeError(DEMO_SETUP, first.code)).toContain("already exists");
    expect(signTypeCodeError(DEMO_SETUP, "X".repeat(21))).not.toBe("");
    expect(signTypeCodeError(DEMO_SETUP, "NEW-TYPE")).toBe("");
  });
});

describe("Check Setup", () => {
  it("the sample setup is clean", () => {
    expect(checkSetup(DEMO_SETUP).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("catches two types with the same Selected When", () => {
    const [a, b] = DEMO_SETUP.signTypes.filter((t) => t.categoryCode === first.categoryCode && !t.isBlock);
    const broken = updateSignType(DEMO_SETUP, b!.code, { selectedWhen: a!.selectedWhen });
    expect(checkSetup(broken).some((i) => i.severity === "error" && i.text.includes("same as"))).toBe(true);
  });

  it("catches a Selected When answer that isn't offered", () => {
    const t = DEMO_SETUP.signTypes.find((x) => x.categoryCode === first.categoryCode && x.selectedWhen)!;
    const code = t.selectedWhen.split("=")[0]!.trim();
    const broken = updateSignType(DEMO_SETUP, t.code, { selectedWhen: `${code}=Not an answer` });
    const found = checkSetup(broken).filter((i) => i.signTypeCode === t.code && i.severity === "error");
    expect(found.some((i) => i.text.includes("isn't one of its answers"))).toBe(true);
  });

  it("catches a type no answers reach", () => {
    const t = DEMO_SETUP.signTypes.find((x) => x.categoryCode === first.categoryCode && x.selectedWhen)!;
    const broken = updateSignType(DEMO_SETUP, t.code, { selectedWhen: "" });
    expect(checkSetup(broken).some((i) => i.signTypeCode === t.code && i.text.includes("no Selected When"))).toBe(true);
  });
});
