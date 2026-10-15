/**
 * Runs the engine over the real setup exported from Business Central.
 * Skipped unless SB_SETUP_FILE points at the export (it holds company data and
 * isn't in the repo):
 *
 *   $env:SB_SETUP_FILE="C:\...\SignBuilderSetup_20261015.json"; npm run test:signbuilder
 *
 * For every sign type it answers the type-picking questions so the type is
 * selected, answers everything else, and builds both descriptions. Set
 * SB_SETUP_OUT to a folder to also write the descriptions there for review.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SignLine, Spec } from "../domain/types";
import { checkSetup } from "../setup/check-setup";
import { parseBcSetupExport } from "../setup/import-bc";
import { buildFromTemplates, buildProduction } from "./descriptions";
import { answerQuestion, evaluate, newSignLine } from "./flow";
import { SetupIndex } from "./setup-index";
import { isPendingValue } from "./values";

const file = process.env.SB_SETUP_FILE ?? "";
const outDir = process.env.SB_SETUP_OUT ?? "";

const spec: Spec = {
  id: "s1", number: "SPEC-TEST", description: "Real setup check", purpose: "walkIn", status: "draft", detailLevel: "full",
  opportunityNo: "", jobNo: "J-TEST", projectId: "", customerNo: "", customerName: "Test Customer", contactName: "", designReference: "",
  jobDetailNotes: "", createdAt: "", createdBy: "", modifiedAt: "", lastGeneratedAt: "", approvedBy: "", approvedAt: "",
};

/** "LIT=Yes; WORK=New cabinet" → { LIT: "Yes", WORK: "New cabinet" } (first value of a | list). */
function wanted(selectedWhen: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of selectedWhen.split(";")) {
    const [code, values] = part.split("=");
    if (code && values) out[code.trim()] = values.split("|")[0]!.trim();
  }
  return out;
}

function fill(idx: SetupIndex, start: SignLine, pick: Record<string, string>): { line: SignLine; asked: number } {
  let line = start;
  let asked = 0;
  for (let guard = 0; guard < 400; guard++) {
    const ev = evaluate(idx, line, "full");
    // A type-picking answer that's showing with a different (e.g. default)
    // value is changed first — what a person does when "Lighted?" says Yes.
    const change = idx
      .questions(line.signTypeCode)
      .find((x) => pick[x.code] && ev.states[x.code]?.visible && ev.states[x.code]!.value !== pick[x.code]);
    const q = change ?? idx.questions(line.signTypeCode).find((x) => ev.states[x.code]?.nextStep);
    if (!q) break;
    const st = ev.states[q.code]!;
    let value = pick[q.code] ?? "";
    if (!value) {
      if (q.answerType === "option" || q.answerType === "yesno") {
        const options = idx.realOptions(q.signTypeCode, q.code).map((o) => o.value);
        const list = st.restricted ? options.filter((o) => st.allowed.includes(o)) : options;
        value = list[0] ?? (q.answerType === "yesno" ? "Yes" : "Per approved drawing");
      } else if (q.answerType === "dimension") {
        value = ["48", "48x120", "48x120x6"][Math.max(0, Math.min(2, (q.dimensionParts || 2) - 1))]!;
      } else if (q.answerType === "number") {
        value = "2";
      } else if (q.answerType === "vinyl") {
        value = "3630-33";
      } else {
        value = q.defaultValue && !isPendingValue(q.defaultValue) ? q.defaultValue : "Per approved drawing";
      }
    }
    line = answerQuestion(idx, line, "full", q.code, value).evaluation.line;
    asked++;
  }
  return { line, asked };
}

const present = !!file && existsSync(file);
const { setup, summary } = present
  ? parseBcSetupExport(readFileSync(file, "utf8"))
  : { setup: null, summary: null };

describe.skipIf(!setup)("real BC setup", () => {
  // The body is still collected when skipped, so nothing here may assume a setup.
  const idx = setup ? new SetupIndex(setup) : (null as unknown as SetupIndex);

  // Reports everything (SB_SETUP_OUT/_check-setup.txt); fails only when a sign
  // type can't be picked — other findings are for Setup → Check Setup.
  it("Check Setup: every sign type can be picked", () => {
    const issues = checkSetup(setup!);
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        join(outDir, "_check-setup.txt"),
        issues.map((i) => `${i.severity.toUpperCase()}  ${i.categoryCode}/${i.signTypeCode}  ${i.questionCode}\n  ${i.text}\n  → ${i.fix}`).join("\n\n") || "No issues.",
      );
    }
    const unreachable = issues.filter((i) => i.severity === "error" && i.signTypeCode && /Selected When|nobody can pick/.test(i.text));
    expect(unreachable.map((i) => `${i.signTypeCode}: ${i.text}`)).toEqual([]);
  });

  it("imports everything", () => {
    expect(summary!.categories).toBeGreaterThan(0);
    expect(summary!.signTypes).toBeGreaterThan(0);
    expect(summary!.questions).toBeGreaterThan(0);
  });

  const types = (setup?.signTypes ?? []).filter((t) => t.active && !t.isBlock);
  it.each(types.map((t) => [t.code, t] as const))("%s: reaches its type, completes, writes descriptions", (_code, t) => {
    const start = newSignLine(idx, spec.id, 10000, t.categoryCode, "full");
    const { line, asked } = fill(idx, { ...start, signName: t.description }, wanted(t.selectedWhen));
    expect(line.signTypeCode).toBe(t.code);
    const ev = evaluate(idx, line, "full");
    const open = idx.questions(line.signTypeCode).filter((q) => ev.states[q.code]?.nextStep).map((q) => q.code);
    expect(open).toEqual([]);
    const production = buildProduction(idx, spec, [line]);
    const field = buildFromTemplates(idx, spec, [line], "field");
    expect(production.trim().length + field.trim().length).toBeGreaterThan(0);
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        join(outDir, `${t.code}.txt`),
        `${t.code} — ${t.description}\nSpec Code: ${line.specCode}   Complete: ${line.completedPct}%   Answered: ${asked}\n\n` +
          `=== PRODUCTION DESCRIPTION ===\n${production}\n\n=== FIELD DESCRIPTION ===\n${field}\n`,
      );
    }
  });
});
