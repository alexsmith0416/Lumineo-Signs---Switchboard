// Production / Field / Extended Description text — a port of the BC
// extension's LSB Description Builder, in the same job-ticket house style.
//
//  Production: section by section (SIGN OVERVIEW / ROUTING / FABRICATION…),
//              one "• Label: answer" line per answered question, or the
//              question's Production Format — or, new in the app, the chosen
//              answer's own format / print text.
//  Field / Extended: the sign type's sentence templates.
// Several signs on one spec each get their own "SIGN n OF m" block.
import type { OutputType, Question, SignLine, Spec, TemplateLine } from "../domain/types";
import type { SetupIndex } from "./setup-index";
import { evaluate, printedAnswer } from "./flow";
import { conditionMet, isOpenDesignValue, isPendingValue, isSurveyValue, vinylLabel } from "./values";

const NL = "\n";
const SUB_NOTE_INDENT = "      - ";

export interface DescriptionOptions {
  /** Print the BC part # after linked materials — "… Aluminum Angle (#20050)".
   *  Default: Setup's "Show part numbers". */
  partNumbers?: boolean;
}

const partsOn = (idx: SetupIndex, opts?: DescriptionOptions) => opts?.partNumbers ?? idx.data.settings.showPartNumbers ?? false;

/** The answer as printed, plus "(#item)" for linked materials when part #s are on.
 *  Vinyl answers ("3630-20 White, 3630-33 Red") get one per color. */
function withPartNo(idx: SetupIndex, line: SignLine, q: Question, value: string, printed: string, pn: boolean): string {
  if (!pn) return printed;
  if (q.answerType === "vinyl") {
    const byLabel = new Map(idx.data.vinylColors.filter((c) => c.itemNo).map((c) => [vinylLabel(c).toLowerCase(), c.itemNo!]));
    return printed
      .split(",")
      .map((part) => {
        const p = part.trim();
        const no = byLabel.get(p.toLowerCase());
        return no ? `${p} (#${no})` : p;
      })
      .join(", ");
  }
  const no = idx.option(line.signTypeCode, q.code, value)?.itemNo;
  return no ? `${printed} (#${no})` : printed;
}

export function buildProduction(idx: SetupIndex, spec: Spec, lines: SignLine[], opts?: DescriptionOptions): string {
  const pn = partsOn(idx, opts);
  let out = "";
  const sorted = sortLines(lines);
  sorted.forEach((raw, i) => {
    const line = evaluate(idx, raw, spec.detailLevel).line;
    if (sorted.length > 1) {
      if (i > 0) out += NL;
      out += signHeading(idx, line, i + 1, sorted.length) + NL + NL;
    }
    out += pendingBlock(idx, line, true);
    out += productionForSign(idx, spec, line, pn);
  });
  if (spec.jobDetailNotes.trim() !== "") out += "JOB DETAIL NOTES" + NL + spec.jobDetailNotes.trim() + NL;
  return trimEnd(out);
}

export function buildFromTemplates(idx: SetupIndex, spec: Spec, lines: SignLine[], outputType: OutputType, opts?: DescriptionOptions): string {
  const pn = partsOn(idx, opts);
  let out = "";
  const sorted = sortLines(lines);
  sorted.forEach((raw, i) => {
    const line = evaluate(idx, raw, spec.detailLevel).line;
    const text = templateForSign(idx, spec, line, outputType, pn);
    if (text === "") return;
    if (out !== "") out += NL + NL;
    if (sorted.length > 1) out += signHeading(idx, line, i + 1, sorted.length) + NL;
    out += text;
  });
  return trimEnd(out);
}

const sortLines = (lines: SignLine[]) => [...lines].sort((a, b) => a.lineNo - b.lineNo);
const trimEnd = (s: string) => s.replace(/[\s]+$/, "");

function label(q: Question): string {
  return q.outputLabel || q.prompt;
}

// Details still waiting on a site survey, or left "Open for design" — they
// drop out of the descriptions once the real answers are filled in.
function pendingBlock(idx: SetupIndex, line: SignLine, productionStyle: boolean): string {
  const surveys: string[] = [];
  const designs: string[] = [];
  for (const q of idx.questions(line.signTypeCode)) {
    const a = line.answers[q.code];
    if (!a?.e) continue;
    if (isSurveyValue(a.v)) surveys.push(label(q));
    if (isOpenDesignValue(a.v)) designs.push(label(q));
  }
  if (printedAnswer(line, "SURVEY") === "Yes") {
    const what = printedAnswer(line, "SURVEY_FOR").trim();
    if (what) surveys.push(what);
  }
  const s = surveys.join("; ");
  const d = designs.join("; ");
  if (productionStyle) {
    let r = "";
    if (s) r += `*** SURVEY NEEDED: ${s} ***` + NL;
    if (d) r += `*** OPEN FOR DESIGN: ${d} ***` + NL;
    return r ? r + NL : "";
  }
  const parts: string[] = [];
  if (s) parts.push(`SURVEY NEEDED to confirm: ${s}.`);
  if (d) parts.push(`Still open for design: ${d}.`);
  return parts.join(" ");
}

function productionForSign(idx: SetupIndex, spec: Spec, line: SignLine, pn: boolean): string {
  let out = "";
  const questions = idx.questions(line.signTypeCode);
  for (const section of idx.sections) {
    let sectionText = "";
    for (const q of questions) {
      if (q.sectionCode !== section.code || !q.inProduction) continue;
      const a = line.answers[q.code];
      if (!a?.e || a.v === "" || isPendingValue(a.v)) continue;
      const text = productionLine(idx, spec, line, q, printedAnswer(line, q.code), pn);
      if (text !== "") sectionText += text + NL;
    }
    if (sectionText !== "") {
      if (section.heading) out += section.heading + NL;
      out += sectionText + NL;
    }
  }
  return out;
}

function productionLine(idx: SetupIndex, spec: Spec, line: SignLine, q: Question, value: string, pn: boolean): string {
  const option = idx.option(line.signTypeCode, q.code, value);
  // How the answer itself prints (an answer can have its own print text).
  const printed = withPartNo(idx, line, q, value, option?.outputText ? option.outputText : value, pn);
  let format: string;
  if (option?.productionFormat) {
    format = option.productionFormat;
  } else if (q.productionFormat) {
    // A formatted Yes/No question is a switch: its line prints only for Yes.
    if (q.answerType === "yesno" && value !== "Yes") return "";
    format = q.productionFormat;
  } else {
    format = "• %2: %1";
  }
  let text = format.split("%2").join(label(q)).split("\\n").join(NL);
  text = headerTokens(idx, spec, line, text);
  text = text.split("%1").join(printed);
  if (q.productionSubNote) text += NL + SUB_NOTE_INDENT + q.productionSubNote;
  return text;
}

function templateForSign(idx: SetupIndex, spec: Spec, line: SignLine, outputType: OutputType, pn: boolean): string {
  let out = outputType === "field" ? pendingBlock(idx, line, false) : "";
  for (const t of idx.templates(line.signTypeCode, outputType)) {
    const sentence = templateSentence(idx, spec, line, t, pn);
    if (sentence === null) continue;
    if (out !== "") out += t.newParagraph ? NL + NL : " ";
    out += sentence;
  }
  return out;
}

/** One template line for a sign: its sentence, or null when it doesn't print
 *  (its conditions aren't met, or a token is blank). */
export function templateSentence(idx: SetupIndex, spec: Spec, line: SignLine, t: TemplateLine, pn = false): string | null {
  if (t.conditionQuestion && !conditionMet(printedAnswer(line, t.conditionQuestion), t.conditionValues)) return null;
  if (t.andConditionQuestion && !conditionMet(printedAnswer(line, t.andConditionQuestion), t.andConditionValues)) return null;
  return resolveTemplate(idx, spec, line, t.text, pn);
}

/** Replaces every {TOKEN}; null (skip the sentence) when any token is empty. */
function resolveTemplate(idx: SetupIndex, spec: Spec, line: SignLine, template: string, pn: boolean): string | null {
  let ok = true;
  const text = template.replace(/\{([^}]*)\}/g, (_m, token: string) => {
    const v = tokenText(idx, spec, line, token, pn);
    if (v === "") ok = false;
    return v;
  });
  if (!ok) return null;
  const out = text.split("\\n").join(NL);
  return out.trim() === "" ? null : out;
}

function answerForTemplate(idx: SetupIndex, line: SignLine, code: string, pn: boolean): string {
  const value = printedAnswer(line, code);
  if (value === "") return "";
  const option = idx.option(line.signTypeCode, code, value);
  const printed = option?.outputText ? option.outputText : value;
  const q = idx.question(line.signTypeCode, code);
  return q ? withPartNo(idx, line, q, value, printed, pn) : printed;
}

function tokenText(idx: SetupIndex, spec: Spec, line: SignLine, token: string, pn = false): string {
  const upper = token.toUpperCase();
  if (upper.startsWith("Q:")) return answerForTemplate(idx, line, upper.slice(2), pn);
  if (upper.startsWith("LQ:")) return answerForTemplate(idx, line, upper.slice(3), pn).toLowerCase();
  switch (upper) {
    case "QTY":
      return String(line.quantity);
    case "TYPE": {
      const t = idx.signType(line.signTypeCode);
      return t ? t.outputName || t.description.toLowerCase() : "";
    }
    case "SIGN":
      return line.signName;
    case "DESIGNREF":
      return spec.designReference;
    case "JOB":
      return spec.jobNo;
  }
  return "";
}

function headerTokens(idx: SetupIndex, spec: Spec, line: SignLine, text: string): string {
  if (!text.includes("{")) return text;
  return text
    .split("{QTY}").join(String(line.quantity))
    .split("{TYPE}").join(tokenText(idx, spec, line, "TYPE"))
    .split("{SIGN}").join(line.signName)
    .split("{DESIGNREF}").join(spec.designReference)
    .split("{JOB}").join(spec.jobNo);
}

export function signHeading(idx: SetupIndex, line: SignLine, n: number, of: number): string {
  let name = line.signName;
  if (!name && line.typeDecided) name = idx.signType(line.signTypeCode)?.description ?? "";
  if (!name) name = idx.category(line.categoryCode)?.description ?? "";
  return `SIGN ${n} OF ${of} – ${name.toUpperCase()}`;
}

/** Headings (ALL CAPS lines, "- POLE COVER -") are shown bold + underlined. */
export function isHeadingLine(lineText: string): boolean {
  const t = lineText.trim();
  if (t === "") return false;
  if (t.startsWith("- ") && t.endsWith(" -")) return true;
  if (t.startsWith("•") || t.startsWith("-") || t.startsWith("*")) return false;
  return t === t.toUpperCase() && t !== t.toLowerCase();
}
