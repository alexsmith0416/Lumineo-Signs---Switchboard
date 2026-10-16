import { useEffect, useMemo, useRef, useState } from "react";
import type { DetailLevel, SignLine, Spec } from "../../domain/types";
import { buildFromTemplates, buildProduction } from "../../engine/descriptions";
import { answerQuestion, evaluate } from "../../engine/flow";
import { hiddenReason, seedPath, testSign } from "../../setup/path-ops";
import { useSetupStore } from "../../store/setup-store";
import { DescriptionText } from "../builder/DescriptionPreview";
import QuestionCard from "../builder/QuestionCard";

const TEST_SPEC: Spec = {
  id: "test", number: "TEST", description: "", purpose: "walkIn", status: "draft", detailLevel: "full", opportunityNo: "", jobNo: "J-TEST",
  projectId: "", customerNo: "", customerName: "", contactName: "", designReference: "D-TEST", jobDetailNotes: "", createdAt: "", createdBy: "",
  modifiedAt: "", lastGeneratedAt: "", approvedBy: "", approvedAt: "",
};

/** Where Test & Path opens: a category, or the path to one question of a sign type. */
export interface PathStart {
  categoryCode?: string;
  typeCode?: string;
  questionCode?: string;
}

/** Setup → Test & Path: the real spec form on a test sign that's never saved —
 *  pick a category and answer as a salesperson would, with the sign type the
 *  answers land on, its Spec Code and the descriptions alongside. "Show hidden
 *  questions" lists the rest greyed out with why each one isn't asked. */
export default function TestPath({ start }: { start?: PathStart }) {
  const setup = useSetupStore((s) => s.setup);
  const idx = useSetupStore((s) => s.idx);
  const categories = useMemo(() => idx?.activeCategories() ?? [], [idx]);
  const [categoryCode, setCategoryCode] = useState(start?.categoryCode ?? (start?.typeCode && setup?.signTypes.find((t) => t.code === start.typeCode)?.categoryCode) ?? "");
  const [line, setLine] = useState<SignLine | null>(null);
  const [detail, setDetail] = useState<DetailLevel>("full");
  const [showHidden, setShowHidden] = useState(!!start?.questionCode);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [focus, setFocus] = useState(start?.questionCode ?? "");
  const [out, setOut] = useState<"production" | "field">("production");
  const seeded = useRef(false);

  // Opened from a question: the path to it; else a fresh sign of the category.
  useEffect(() => {
    if (!idx || seeded.current) return;
    seeded.current = true;
    if (start?.typeCode && start.questionCode) {
      setLine(seedPath(idx, start.typeCode, start.questionCode));
      return;
    }
    const cat = categoryCode || categories[0]?.code || "";
    setCategoryCode(cat);
    if (cat) setLine(testSign(idx, cat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`q-${focus}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus, line]);

  if (!setup || !idx) return <div className="sbp-muted">Loading…</div>;
  const restart = (cat = categoryCode) => {
    setLine(cat ? testSign(idx, cat) : null);
    setErrors({});
    setNotice("");
    setFocus("");
  };

  const ev = line ? evaluate(idx, line, detail) : null;
  const shownLine = ev?.line ?? null;
  const type = shownLine ? idx.signType(shownLine.signTypeCode) : undefined;
  const questions = shownLine ? idx.questions(shownLine.signTypeCode) : [];

  const onAnswer = (code: string, input: string, sizes?: number[]) => {
    if (!line) return;
    try {
      const res = answerQuestion(idx, line, detail, code, input, sizes);
      setLine(res.evaluation.line);
      setErrors({ ...errors, [code]: "" });
      const msgs: string[] = [];
      if (res.evaluation.cleared.length) msgs.push(`Cleared because they no longer apply: ${res.evaluation.cleared.map((c) => `${c.prompt} (was ${c.value})`).join("; ")}`);
      if (res.message) msgs.push(res.message);
      setNotice(msgs.join(" "));
      setFocus("");
    } catch (e) {
      setErrors({ ...errors, [code]: e instanceof Error ? e.message : String(e) });
    }
  };

  const spec = { ...TEST_SPEC, detailLevel: detail };
  let n = 0;
  let lastSection = "";
  return (
    <div className="sbp-setup-split" style={{ gridTemplateColumns: "minmax(0, 1fr) 440px" }}>
      <div className="sbp-card" data-tour="test-path">
        <div className="sbp-row" style={{ flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div className="sbp-field" style={{ minWidth: 240 }}>
            <label>Category</label>
            <select
              className="sbp-input"
              value={categoryCode}
              onChange={(e) => {
                setCategoryCode(e.target.value);
                restart(e.target.value);
              }}
            >
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.description}
                </option>
              ))}
            </select>
          </div>
          <div className="sbp-tabs" style={{ margin: 0 }}>
            <button type="button" className={`sbp-tab${detail === "opportunity" ? " sbp-tab--on" : ""}`} onClick={() => setDetail("opportunity")}>
              Opportunity details
            </button>
            <button type="button" className={`sbp-tab${detail === "full" ? " sbp-tab--on" : ""}`} onClick={() => setDetail("full")}>
              Job details
            </button>
          </div>
          <div className="sbp-spacer" />
          <label className="sbp-check" title="List the questions that aren't asked too, greyed out with the reason">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show hidden questions
          </label>
          <button type="button" className="btn-secondary" onClick={() => restart()}>
            Start over
          </button>
        </div>
        <p className="sbp-muted" style={{ fontSize: 12, margin: "8px 0" }}>
          A test sign that's never saved, using the setup as it is right now — edits on the other tabs show here straight away. Answer as a salesperson would.
        </p>
        {shownLine && (
          <div className="sbp-banner" style={{ marginBottom: 8 }}>
            <b>Sign type:</b>{" "}
            {shownLine.typeDecided && type ? (
              <>
                {type.description} <span className="sbp-muted">({type.code})</span>
              </>
            ) : (
              <span className="sbp-muted">not decided yet — answer the first questions</span>
            )}
            {" · "}
            <b>Spec Code:</b> <span className="sbp-code">{shownLine.specCode || "—"}</span>
            {shownLine.specReferenceCode && (
              <>
                {" · "}
                <b>Reference page:</b> {shownLine.specReferenceCode}
              </>
            )}
            {ev && (
              <span className="sbp-muted">
                {" · "}
                {ev.missingRequired ? `${ev.missingRequired} required left` : "all required answered"}
              </span>
            )}
          </div>
        )}
        {notice && <div className="sbp-banner sbp-banner--warn">{notice}</div>}
        {shownLine &&
          ev &&
          questions.map((q) => {
            const st = ev.states[q.code];
            const visible = !!st?.visible;
            if (!visible && !showHidden) return null;
            const section = idx.sections.find((s) => s.code === q.sectionCode)?.heading ?? q.sectionCode;
            const heading = section !== lastSection ? section : "";
            lastSection = section;
            if (visible) n++;
            return (
              <div key={q.code}>
                {heading && <div className="sbp-section-heading">{heading}</div>}
                {visible ? (
                  <QuestionCard idx={idx} number={n} question={q} state={st!} isNew={q.code === focus} readOnly={false} error={errors[q.code] ?? ""} onAnswer={(i, s) => onAnswer(q.code, i, s)} />
                ) : (
                  <div className={`sbp-path-hidden${q.code === focus ? " sbp-path-hidden--focus" : ""}`} id={`q-${q.code}`}>
                    <div style={{ fontWeight: 700 }}>
                      {q.prompt} <span className="sbp-muted">({q.code})</span>
                    </div>
                    <div style={{ fontSize: 12 }}>{hiddenReason(idx, shownLine, q, st)}</div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <div className="sbp-card sbp-tpl-preview">
        <div className="sbp-tabs" style={{ marginTop: 0 }}>
          <button type="button" className={`sbp-tab${out === "production" ? " sbp-tab--on" : ""}`} onClick={() => setOut("production")}>
            Production
          </button>
          <button type="button" className={`sbp-tab${out === "field" ? " sbp-tab--on" : ""}`} onClick={() => setOut("field")}>
            Field
          </button>
        </div>
        <DescriptionText text={shownLine ? (out === "production" ? buildProduction(idx, spec, [shownLine]) : buildFromTemplates(idx, spec, [shownLine], "field")) : ""} />
      </div>
    </div>
  );
}
