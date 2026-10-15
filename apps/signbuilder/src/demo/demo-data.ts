/**
 * The demo sandbox's data: a copy of the current setup plus a few sample specs,
 * built by actually answering the questions with the engine — so the demo
 * always matches the real questions, whatever the setup is.
 */
import type { Project, SetupData, SignLine, Spec } from "../domain/types";
import { answerQuestion, evaluate, newSignLine } from "../engine/flow";
import { SetupIndex } from "../engine/setup-index";
import { isPendingValue } from "../engine/values";
import type { MockSeed } from "../services/repo";

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

function spec(id: string, number: string, partial: Partial<Spec>): Spec {
  return {
    id,
    number,
    description: "",
    purpose: "opportunity",
    status: "draft",
    detailLevel: "opportunity",
    opportunityNo: "",
    jobNo: "",
    projectId: "",
    customerNo: "",
    customerName: "",
    contactName: "",
    designReference: "",
    jobDetailNotes: "",
    createdAt: iso(10),
    createdBy: "Demo",
    modifiedAt: iso(1),
    lastGeneratedAt: "",
    approvedBy: "",
    approvedAt: "",
    ...partial,
  };
}

/** Answers the sign's questions in order with the first answer offered (or a
 *  sample) until `stopAfter` answers, or until it's complete. */
function fillSign(idx: SetupIndex, line: SignLine, s: Spec, stopAfter: number): SignLine {
  let current = line;
  for (let i = 0; i < stopAfter; i++) {
    const ev = evaluate(idx, current, s.detailLevel);
    const q = idx.questions(current.signTypeCode).find((x) => ev.states[x.code]?.nextStep);
    if (!q) break;
    const st = ev.states[q.code]!;
    let value = "";
    if (q.answerType === "option" || q.answerType === "yesno") {
      const options = idx.realOptions(q.signTypeCode, q.code).map((o) => o.value);
      const list = st.restricted ? options.filter((o) => st.allowed.includes(o)) : options;
      value = list[0] ?? (q.answerType === "yesno" ? "Yes" : "");
    } else if (q.answerType === "dimension") {
      value = ["48", "48x120", "48x120x6"][Math.max(0, Math.min(2, (q.dimensionParts || 2) - 1))]!;
    } else if (q.answerType === "number") {
      value = "1";
    } else if (q.answerType === "vinyl") {
      value = "3M 3630-33 Red";
    } else {
      value = q.defaultValue && !isPendingValue(q.defaultValue) ? q.defaultValue : "Per approved drawing";
    }
    if (!value) break;
    try {
      current = answerQuestion(idx, current, s.detailLevel, q.code, value).evaluation.line;
    } catch {
      break;
    }
  }
  return current;
}

export function makeDemoSeed(setup: SetupData): MockSeed {
  const copy: SetupData = JSON.parse(JSON.stringify(setup));
  const idx = new SetupIndex(copy);
  const cats = idx.activeCategories();
  const project: Project = { id: "demo-project", name: "Westview Medical rollout", customerName: "Westview Medical", notes: "Three clinics, same branding.", createdAt: iso(20) };

  const s1 = spec("demo-spec-1", "SPEC-9001", {
    customerName: "Westview Medical",
    description: "Main ID + entrance",
    opportunityNo: "OP-10421",
    projectId: project.id,
  });
  const s2 = spec("demo-spec-2", "SPEC-9002", {
    customerName: "Lakeside Office Park",
    description: "Monument + wall sign",
    jobNo: "J-DEMO-2",
    purpose: "existingProject",
    detailLevel: "full",
    status: "submitted",
  });

  const lines: SignLine[] = [];
  if (cats[0]) {
    let l = newSignLine(idx, s1.id, 10000, cats[0].code, s1.detailLevel);
    l = fillSign(idx, { ...l, signName: "Main ID – North elevation" }, s1, 5);
    lines.push(l);
  }
  const second = cats[1] ?? cats[0];
  if (second) {
    let l = newSignLine(idx, s2.id, 10000, second.code, s2.detailLevel);
    l = fillSign(idx, { ...l, signName: "Front entrance" }, s2, 6);
    lines.push(l);
  }
  return { setup: copy, specs: [s1, s2], lines, projects: [project] };
}
