import { describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import { checkSetup } from "./check-setup";
import { duplicateSignType, signTypeCodeError, updateSignType } from "./sign-type-ops";
import { matchConfidence, suggestItems } from "./item-match";
import { cleanWording, setItemForValue, setShowPartNumbers } from "./item-ops";
import { buildProduction } from "../engine/descriptions";
import { answerQuestion, newSignLine } from "../engine/flow";
import { SetupIndex } from "../engine/setup-index";
import type { BcItem, Spec } from "../domain/types";

const first = DEMO_SETUP.signTypes.find((t) => !t.isBlock)!;

// Real BC item names (UAT, Oct 15 2026).
const ITEMS: BcItem[] = [
  { no: "20020", name: "2 x 2 x .125 Alum Ang 25'", category: "ALUANG", uom: "EA" },
  { no: "20040", name: "1.5x1.5x.187 SqCrnrArcAlAng 20'", category: "ALUANG", uom: "EA" },
  { no: "20050", name: "2x2x.187 SqCrnrArcAl Ang 20'", category: "ALUANG", uom: "EA" },
  { no: "20055", name: "2 x 2 x.187 StrcAlum Ang 25'", category: "ALUANG", uom: "EA" },
  { no: "20014", name: ".75 x 1.5 x .125 Alum Ang 20'", category: "ALUANG", uom: "EA" },
  { no: "28050", name: "2 X 2 X .187 Angle Iron", category: "STLSHP", uom: "EA" },
  { no: "29525", name: "2 X 2 X .187 Sq Tube", category: "STLTUB", uom: "EA" },
  { no: "24055", name: ".090 Mil Alum 3003", category: "ALUSHT", uom: "SH" },
  { no: "24060", name: "Routing - .090 Mil Alum 5052", category: "ALUSHT", uom: "SH" },
  { no: "53100", name: '.177 "FF" White 4 X 8 Plex', category: "PLASSH", uom: "SH" },
  { no: "53095", name: ".177 Milky White Plex (2447)", category: "PLASSH", uom: "SH" },
  { no: "13085", name: "Omegabond 3mm ACM", category: "GRASUB", uom: "SQFT" },
  { no: "13005", name: "3mm Sintra White 4'x8'", category: "GRASUB", uom: "SH" },
  { no: "15456", name: '48" 3630-20 White', category: "VTRANS", uom: "SQFT" },
  { no: "15916", name: '60" 3630-20 White', category: "VTRANS", uom: "SQFT" },
];

describe("BC item matching", () => {
  const top = (answer: string) => suggestItems(answer, ITEMS)[0]?.item.no ?? "";
  it("reads sizes and abbreviations both ways", () => {
    expect(top("2”x2”x.187” Aluminum Angle")).toMatch(/^200(50|55)$/);
    expect(top("1.5”x1.5”x.187” Aluminum Angle")).toBe("20040");
    expect(top("3/4”x1.5” Aluminum Angle")).toBe("20014");
    expect(top(".090 Mil Aluminum")).toBe("24055"); // plain stock, not the routing blank
    expect(top(".177” White Plex")).toBe("53100"); // "FF" white, not milky
    expect(top("3mm ACM")).toBe("13085"); // not Sintra
    expect(top("3630-20 White vinyl")).toBe("15456"); // the 48" roll
  });
  it("tells steel from aluminum by the BC category", () => {
    expect(top("2” x 2” x .187” Angle Iron")).toBe("28050");
    expect(top("2” x 2” x .187” Aluminum Square Tube")).toBe(""); // BC only has it in steel
  });
  it("asks for a pick when the answer leaves the wall thickness out", () => {
    expect(matchConfidence(suggestItems("2”x2” Aluminum Angle", ITEMS))).toBe("pick");
  });
  it("words new answers like the existing ones", () => {
    expect(cleanWording(ITEMS[2]!)).toBe("2”x2”x.187” Aluminum Angle");
    expect(cleanWording(ITEMS[5]!)).toBe("2” x 2” x .187” Angle Iron");
    expect(cleanWording(ITEMS[9]!)).toBe(".177” White Plex");
    expect(cleanWording(ITEMS[11]!)).toBe("3mm ACM");
  });
});

describe("part numbers in the descriptions", () => {
  const spec: Spec = {
    id: "s1", number: "SPEC-1", description: "", purpose: "walkIn", status: "draft", detailLevel: "full", opportunityNo: "", jobNo: "",
    projectId: "", customerNo: "", customerName: "", contactName: "", designReference: "", jobDetailNotes: "", createdAt: "",
    createdBy: "", modifiedAt: "", lastGeneratedAt: "", approvedBy: "", approvedAt: "",
  };
  it("prints (#item) after linked materials only when switched on", () => {
    let setup = setItemForValue(DEMO_SETUP, "White LED Modules", "44603");
    const idx0 = new SetupIndex(setup);
    let line = newSignLine(idx0, "s1", 10000, "WALLCAB", "full");
    for (const [q, v] of [["LIT", "Yes"], ["WORK", "New cabinet"], ["FACE_TYPE", "Plex Face"]] as const) line = answerQuestion(idx0, line, "full", q, v).evaluation.line;
    expect(buildProduction(idx0, spec, [line])).toContain("Lighting Type: White LED Modules\n");
    expect(buildProduction(idx0, spec, [line], { partNumbers: true })).toContain("Lighting Type: White LED Modules (#44603)");
    setup = setShowPartNumbers(setup, true);
    expect(buildProduction(new SetupIndex(setup), spec, [line])).toContain("(#44603)"); // the Setup default
  });
});

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
