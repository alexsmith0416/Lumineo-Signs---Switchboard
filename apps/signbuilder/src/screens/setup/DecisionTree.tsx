import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { AnswerType, Question, Scope, Stage } from "../../domain/types";
import { SetupIndex } from "../../engine/setup-index";
import { checkSetup } from "../../setup/check-setup";
import { describeItems, suggestItems } from "../../setup/item-match";
import {
  addDefaultRule,
  addOption,
  addQuestion,
  addRule,
  deleteQuestion,
  moveOption,
  questionCodeError,
  removeDefaultRule,
  removeOption,
  removeRule,
  shownWhen,
  updateOption,
  updateQuestion,
  type QuestionPatch,
} from "../../setup/question-ops";
import { useSetupStore } from "../../store/setup-store";
import CopyQuestions from "./CopyQuestions";
import { CommitInput, TypePicker } from "./setup-ui";

const ANSWER_TYPES: [AnswerType, string][] = [
  ["option", "Pick list"],
  ["yesno", "Yes / No"],
  ["text", "Text"],
  ["number", "Number"],
  ["dimension", "Size (feet & inches)"],
  ["vinyl", "Vinyl color(s)"],
];
const STAGES: [Stage, string][] = [
  ["opportunity", "Opportunity (core)"],
  ["job", "Job details"],
  ["later", "Later (not required)"],
  ["notAsked", "Not asked"],
];
const isList = (q: Question) => q.answerType === "option" || q.answerType === "yesno";

/** Setup → Questions: a sign type's questions in order, each with when it's
 *  asked; click one to edit it, its answers (with how each prints and its BC
 *  item) and its rules (shown when / answers offered / defaults). */
export default function DecisionTree({
  initialCode,
  typeCode,
  setTypeCode,
  onOpenMatrix,
  onShowPath,
}: {
  initialCode?: string;
  typeCode: string;
  setTypeCode: (c: string) => void;
  onOpenMatrix: (trigger: string, target?: string) => void;
  onShowPath: (typeCode: string, questionCode: string) => void;
}) {
  const setup = useSetupStore((s) => s.setup);
  const idx = useMemo(() => (setup ? new SetupIndex(setup) : null), [setup]);
  const [code, setCode] = useState(initialCode ?? "");
  const [adding, setAdding] = useState<{ code: string; prompt: string; error: string } | null>(null);
  const replace = useSetupStore((s) => s.replace);
  // Copy mode: tick questions, then copy them to other sign types.
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    setPicked(null);
    setCopied("");
  }, [typeCode]);

  const questions = idx?.questions(typeCode) ?? [];
  useEffect(() => {
    if (!questions.some((q) => q.code === code)) setCode(questions[0]?.code ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCode, questions.length]);

  if (!setup || !idx) return <div className="sbp-muted">Loading…</div>;
  const current = questions.find((q) => q.code === code);

  const runAdd = () => {
    if (!adding) return;
    const err = questionCodeError(setup, typeCode, adding.code);
    if (err) return setAdding({ ...adding, error: err });
    replace(addQuestion(setup, typeCode, adding.code, adding.prompt, current), `Add question ${adding.code.toUpperCase()}`);
    setCode(adding.code.trim().toUpperCase());
    setAdding(null);
  };

  // Group by section, in section order then sort order.
  const sections = idx.sections;
  const bySection = sections.map((s) => ({ s, qs: questions.filter((q) => q.sectionCode === s.code) })).filter((g) => g.qs.length);
  const orphans = questions.filter((q) => !sections.some((s) => s.code === q.sectionCode));

  return (
    <div className="sbp-setup-split" style={{ gridTemplateColumns: "380px 1fr" }}>
      <div className="sbp-card" data-tour="decision-tree">
        <TypePicker setup={setup} typeCode={typeCode} onChange={setTypeCode} />
        <div className="sbp-row" style={{ margin: "10px 0 4px" }}>
          <div className="sbp-caption">{questions.length} questions</div>
          <div className="sbp-spacer" />
          {picked ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setPicked(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={picked.size === 0} onClick={() => setCopying(true)}>
                Copy {picked.size}…
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary" title="Copy questions to other sign types" onClick={() => setPicked(new Set(current ? [current.code] : []))}>
                Copy to…
              </button>
              <button type="button" className="btn-secondary" onClick={() => setAdding({ code: "", prompt: "", error: "" })}>
                + Add question
              </button>
            </>
          )}
        </div>
        {picked && <div className="sbp-muted" style={{ fontSize: 12, marginBottom: 4 }}>Tick the questions to copy, then <b>Copy</b>.</div>}
        {copied && <div className="sbp-banner sbp-banner--ok" style={{ fontSize: 12 }}>{copied}</div>}
        {adding && (
          <div className="sbp-banner">
            <div className="sbp-field">
              <label>Code (used by rules and templates)</label>
              <input className="sbp-input" value={adding.code} maxLength={30} onChange={(e) => setAdding({ ...adding, code: e.target.value.toUpperCase(), error: "" })} placeholder="e.g. FACE_FRAME" />
            </div>
            <div className="sbp-field">
              <label>Question</label>
              <input className="sbp-input" value={adding.prompt} onChange={(e) => setAdding({ ...adding, prompt: e.target.value })} placeholder="e.g. Face frame material" />
            </div>
            <div className="sbp-muted" style={{ fontSize: 12 }}>Added {current ? `after “${current.prompt}”` : "at the end"}, in the same section.</div>
            {adding.error && <div className="sbp-banner sbp-banner--error">{adding.error}</div>}
            <div className="sbp-row">
              <button type="button" className="btn-secondary" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={runAdd}>
                Add
              </button>
            </div>
          </div>
        )}
        <div className="sbp-tree">
          {[...bySection, ...(orphans.length ? [{ s: { code: "", heading: "(no section)", sortOrder: 9999 }, qs: orphans }] : [])].map(({ s, qs }) => (
            <div key={s.code}>
              <div className="sbp-tree__section">{s.heading}</div>
              {qs.map((q) => (
                <div key={q.code} className={`sbp-tree__q${q.code === code ? " sbp-tree__q--on" : ""}`} onClick={() => setCode(q.code)}>
                  <div className="sbp-row" style={{ gap: 6 }}>
                    {picked && (
                      <input
                        type="checkbox"
                        checked={picked.has(q.code)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const n = new Set(picked);
                          if (e.target.checked) n.add(q.code);
                          else n.delete(q.code);
                          setPicked(n);
                        }}
                      />
                    )}
                    <span style={{ fontWeight: 700, flex: 1 }}>{q.prompt}</span>
                    {q.scope === "conditional" && <span className="sbp-pill">if</span>}
                    {q.picksSignType && <span className="sbp-pill sbp-pill--submitted">type</span>}
                    {idx.defaultRulesTo(typeCode, q.code).length > 0 && <span className="sbp-pill sbp-pill--new">default</span>}
                  </div>
                  <div className="sbp-muted" style={{ fontSize: 11 }}>
                    {q.code} · {shownWhen(idx, q)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {copying && picked && (
        <CopyQuestions
          fromType={typeCode}
          codes={questions.filter((q) => picked.has(q.code)).map((q) => q.code)}
          onClose={() => setCopying(false)}
          onDone={(msg) => {
            setCopying(false);
            setPicked(null);
            setCopied(msg);
          }}
        />
      )}
      {current ? (
        <QuestionEditor key={`${typeCode}|${current.code}`} idx={idx} q={current} onDeleted={() => setCode("")} onOpenMatrix={onOpenMatrix} onShowPath={onShowPath} />
      ) : (
        <div className="sbp-card sbp-muted">No questions on this sign type yet.</div>
      )}
    </div>
  );
}

/** Everything about one question: details, answers, rules. Also opened from
 *  Test & Path (without the Show path / Rule Matrix buttons). */
export function QuestionEditor({
  idx,
  q,
  onDeleted,
  onOpenMatrix,
  onShowPath,
}: {
  idx: SetupIndex;
  q: Question;
  onDeleted: () => void;
  onOpenMatrix?: (trigger: string, target?: string) => void;
  onShowPath?: (typeCode: string, questionCode: string) => void;
}) {
  const setup = idx.data;
  const replace = useSetupStore((s) => s.replace);
  const type = q.signTypeCode;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: QuestionPatch, label = `Edit ${q.code}`) => replace(updateQuestion(setup, type, q.code, patch), label);

  const earlier = idx.questions(type).filter((x) => x.sortOrder < q.sortOrder);
  const earlierLists = earlier.filter(isList);
  const answers = idx.options(type, q.code);
  const issues = useMemo(() => checkSetup(setup, { signTypeCode: type }).filter((i) => i.questionCode === q.code), [setup, type, q.code]);

  return (
    <div className="sbp-card">
      <div className="sbp-row" style={{ marginBottom: 8 }}>
        <div>
          <div className="sbp-caption">Question · {q.code}</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{q.prompt}</div>
          <div className="sbp-muted" style={{ fontSize: 12 }}>Shown: {shownWhen(idx, q)}</div>
        </div>
        <div className="sbp-spacer" />
        {onShowPath && (
          <button type="button" className="btn-secondary" onClick={() => onShowPath(type, q.code)} title="Try it: a test sign with the answers that bring this question up">
            Show path
          </button>
        )}
        {isList(q) && onOpenMatrix && (
          <button type="button" className="btn-secondary" onClick={() => onOpenMatrix(q.code)} title="What each answer brings up, and the defaults it sets">
            Rule Matrix
          </button>
        )}
        <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
          Delete
        </button>
      </div>

      {issues.map((i, n) => (
        <div key={n} className={`sbp-banner ${i.severity === "error" ? "sbp-banner--error" : "sbp-banner--warn"}`}>
          {i.text} <span className="sbp-muted">→ {i.fix}</span>
        </div>
      ))}

      <details open className="sbp-editor-group">
        <summary>Details</summary>
        <div className="sbp-grid-fields">
          <Field label="Question (as asked)">
            <CommitInput value={q.prompt} onCommit={(v) => set({ prompt: v })} />
          </Field>
          <Field label="Label in the Production Description">
            <CommitInput value={q.outputLabel} placeholder={q.prompt} onCommit={(v) => set({ outputLabel: v })} />
          </Field>
          <Field label="Section">
            <select className="sbp-input" value={q.sectionCode} onChange={(e) => set({ sectionCode: e.target.value })}>
              {idx.sections.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.heading}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order (sort)">
            <CommitInput value={String(q.sortOrder)} onCommit={(v) => set({ sortOrder: Number(v) || q.sortOrder })} />
          </Field>
          <Field label="Answer type">
            <select className="sbp-input" value={q.answerType} onChange={(e) => set({ answerType: e.target.value as AnswerType })}>
              {ANSWER_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Asked at">
            <select className="sbp-input" value={q.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>
              {STAGES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Asked">
            <select className="sbp-input" value={q.scope} onChange={(e) => set({ scope: e.target.value as Scope })}>
              <option value="global">Always</option>
              <option value="conditional">Only when a rule shows it</option>
            </select>
          </Field>
          <Field label="Default answer">
            {isList(q) && !q.allowFreeText ? (
              <select className="sbp-input" value={q.defaultValue} onChange={(e) => set({ defaultValue: e.target.value })}>
                <option value="">— none —</option>
                {answers.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value}
                  </option>
                ))}
              </select>
            ) : (
              <CommitInput value={q.defaultValue} onCommit={(v) => set({ defaultValue: v })} />
            )}
          </Field>
          <Field label="Hint (under the question)">
            <CommitInput value={q.hint} onCommit={(v) => set({ hint: v })} />
          </Field>
          {q.answerType === "dimension" && (
            <>
              <Field label="Size parts (1–3)">
                <CommitInput value={String(q.dimensionParts)} onCommit={(v) => set({ dimensionParts: Math.max(1, Math.min(3, Number(v) || 2)) })} />
              </Field>
              <Field label="Size labels (Height|Width|Depth)">
                <CommitInput value={q.dimensionLabels} onCommit={(v) => set({ dimensionLabels: v })} />
              </Field>
            </>
          )}
          {q.answerType === "vinyl" && (
            <Field label="Vinyl series (blank = all)">
              <CommitInput value={q.vinylSeries} onCommit={(v) => set({ vinylSeries: v })} />
            </Field>
          )}
          {(q.answerType === "number" || q.answerType === "text") && (
            <Field label="Unit">
              <CommitInput value={q.unit} onCommit={(v) => set({ unit: v })} />
            </Field>
          )}
        </div>
        <div className="sbp-checks">
          <Check label="Required" checked={q.required} onChange={(v) => set({ required: v })} />
          <Check label="Typed answers allowed (Other…)" checked={q.allowFreeText} onChange={(v) => set({ allowFreeText: v })} />
          <Check label="Prints in the Production Description" checked={q.inProduction} onChange={(v) => set({ inProduction: v })} />
          <Check label="Shown with the question before it" checked={q.showWithPrevious} onChange={(v) => set({ showWithPrevious: v })} />
          <Check label="Needs Survey allowed" checked={q.allowSurvey} onChange={(v) => set({ allowSurvey: v })} />
          <Check label="Open for design allowed" checked={q.allowOpenForDesign} onChange={(v) => set({ allowOpenForDesign: v })} />
          <Check label="Picks the sign type" checked={q.picksSignType} onChange={(v) => set({ picksSignType: v })} />
        </div>
        <div className="sbp-grid-fields" style={{ marginTop: 8 }}>
          <Field label="Production line format (%1 = answer, %2 = label; blank = • Label: answer)">
            <CommitInput value={q.productionFormat} placeholder="• %2: %1" onCommit={(v) => set({ productionFormat: v })} />
          </Field>
          <Field label="Note printed under it (indented)">
            <CommitInput value={q.productionSubNote} onCommit={(v) => set({ productionSubNote: v })} />
          </Field>
          <Field label="Also requires (question)">
            <select className="sbp-input" value={q.alsoRequiresQuestion} onChange={(e) => set({ alsoRequiresQuestion: e.target.value, alsoRequiresValues: "" })}>
              <option value="">— nothing else —</option>
              {earlier.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.prompt} ({x.code})
                </option>
              ))}
            </select>
          </Field>
          {q.alsoRequiresQuestion && (
            <Field label="…to be (answers with |, ! = not; blank = answered)">
              <CommitInput value={q.alsoRequiresValues} onCommit={(v) => set({ alsoRequiresValues: v })} />
            </Field>
          )}
        </div>
      </details>

      {isList(q) && <AnswersEditor idx={idx} q={q} />}

      <RulesEditor idx={idx} q={q} earlierLists={earlierLists} onOpenMatrix={onOpenMatrix} />

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${q.code}?`}
          message={`“${q.prompt}” is removed from this sign type with its ${answers.length} answers and every rule on or about it. Undo (top of Setup) brings it back this session.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            replace(deleteQuestion(setup, type, q.code), `Delete question ${q.code}`);
            setConfirmDelete(false);
            onDeleted();
          }}
        />
      )}
    </div>
  );
}

function AnswersEditor({ idx, q }: { idx: SetupIndex; q: Question }) {
  const setup = idx.data;
  const replace = useSetupStore((s) => s.replace);
  const type = q.signTypeCode;
  const answers = idx.options(type, q.code);
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");
  const items = setup.items ?? [];
  const described = useMemo(() => describeItems(items), [items]);
  const itemName = (no?: string) => (no ? items.find((i) => i.no === no)?.name ?? "" : "");

  const edit = (value: string, patch: Parameters<typeof updateOption>[4], label: string) => {
    try {
      if (patch.value !== undefined && patch.value.trim() === "") throw new Error("An answer can't be blank — use ✕ to remove it.");
      if (patch.value !== undefined && answers.some((o) => o.value !== value && o.value.toLowerCase() === patch.value!.trim().toLowerCase())) throw new Error(`"${patch.value}" is already an answer.`);
      replace(updateOption(setup, type, q.code, value, patch.value !== undefined ? { ...patch, value: patch.value.trim() } : patch), label);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <details open className="sbp-editor-group">
      <summary>Answers ({answers.length})</summary>
      <p className="sbp-muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>
        <b>Prints as</b> changes only how the answer reads in the descriptions. <b>Own line</b> replaces the question's line for this answer
        (%1 = answer, %2 = label, \n = new line). Renaming an answer renames it in this sign type's rules and defaults too.
      </p>
      {error && <div className="sbp-banner sbp-banner--error">{error}</div>}
      <table className="sbp-table sbp-answers">
        <thead>
          <tr>
            <th></th>
            <th>Answer</th>
            <th>Prints as</th>
            <th>Own line</th>
            <th>BC item</th>
            <th>Code</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {answers.map((o, n) => {
            const s = suggestItems(o.value, items, described);
            return (
              <tr key={o.value}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="sbp-icon-btn" disabled={n === 0} onClick={() => replace(moveOption(setup, type, q.code, o.value, -1), `Move "${o.value}" up`)}>
                    ↑
                  </button>
                  <button type="button" className="sbp-icon-btn" disabled={n === answers.length - 1} onClick={() => replace(moveOption(setup, type, q.code, o.value, 1), `Move "${o.value}" down`)}>
                    ↓
                  </button>
                </td>
                <td>
                  <CommitInput value={o.value} onCommit={(v) => edit(o.value, { value: v }, `Rename "${o.value}"`)} />
                </td>
                <td>
                  <CommitInput value={o.outputText} placeholder="(the answer)" onCommit={(v) => edit(o.value, { outputText: v }, `Print text for "${o.value}"`)} />
                </td>
                <td>
                  <CommitInput value={o.productionFormat} placeholder="(the question's)" onCommit={(v) => edit(o.value, { productionFormat: v }, `Own line for "${o.value}"`)} />
                </td>
                <td>
                  <select className="sbp-input" style={{ maxWidth: 220 }} value={o.itemNo ?? ""} title={itemName(o.itemNo)} onChange={(e) => edit(o.value, { itemNo: e.target.value || undefined }, `Item for "${o.value}"`)}>
                    <option value="">—</option>
                    {o.itemNo && !s.some((x) => x.item.no === o.itemNo) && <option value={o.itemNo}>#{o.itemNo} {itemName(o.itemNo)}</option>}
                    {s.slice(0, 10).map((x) => (
                      <option key={x.item.no} value={x.item.no}>
                        #{x.item.no} {x.item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <CommitInput value={o.codeSegment} style={{ width: 70 }} onCommit={(v) => edit(o.value, { codeSegment: v.toUpperCase() }, `Spec Code for "${o.value}"`)} />
                </td>
                <td>
                  <button type="button" className="sbp-icon-btn" title="Remove this answer (and the rules on it)" onClick={() => replace(removeOption(setup, type, q.code, o.value), `Remove answer "${o.value}"`)}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sbp-row" style={{ marginTop: 8 }}>
        <input className="sbp-input" style={{ maxWidth: 360 }} placeholder="New answer" value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click()} />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            try {
              replace(addOption(setup, type, q.code, newValue), `Add answer "${newValue.trim()}"`);
              setNewValue("");
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Add answer
        </button>
      </div>
    </details>
  );
}

function RulesEditor({ idx, q, earlierLists, onOpenMatrix }: { idx: SetupIndex; q: Question; earlierLists: Question[]; onOpenMatrix?: (trigger: string, target?: string) => void }) {
  const setup = idx.data;
  const replace = useSetupStore((s) => s.replace);
  const type = q.signTypeCode;
  const rules = idx.rulesTo(type, q.code);
  const showRules = rules.filter((r) => r.targetAnswer === "");
  const allowRules = rules.filter((r) => r.targetAnswer !== "");
  const defaults = idx.defaultRulesTo(type, q.code);
  const prompt = (c: string) => idx.question(type, c)?.prompt ?? c;
  const answers = idx.options(type, q.code).map((o) => o.value);

  const [show, setShow] = useState({ trigger: "", answer: "" });
  const [allow, setAllow] = useState({ trigger: "", answer: "", offered: "" });
  const [def, setDef] = useState({ trigger: "", answer: "", value: "" });
  const triggerAnswers = (c: string) => (c ? idx.options(type, c).map((o) => o.value) : []);

  return (
    <details open className="sbp-editor-group" data-tour="question-rules">
      <summary>Rules</summary>

      <div className="sbp-rule-block">
        <div className="sbp-rule-title">Shown when {q.scope === "global" && <span className="sbp-muted">(this question is always asked — set “Asked” to “Only when a rule shows it” to use these)</span>}</div>
        {showRules.length === 0 && <div className="sbp-muted">No rules.</div>}
        {showRules.map((r) => (
          <div key={r.id} className="sbp-rule">
            When <b>{prompt(r.triggerQuestion)}</b> is <b>{r.triggerAnswer || "answered"}</b>
            <button type="button" className="sbp-icon-btn" onClick={() => replace(removeRule(setup, r.id), `Remove a rule on ${q.code}`)}>
              ✕
            </button>
          </div>
        ))}
        <div className="sbp-row sbp-rule-add">
          <TriggerSelect questions={earlierLists} value={show.trigger} onChange={(v) => setShow({ trigger: v, answer: "" })} />
          <AnswerSelect answers={triggerAnswers(show.trigger)} value={show.answer} onChange={(v) => setShow({ ...show, answer: v })} anyLabel="any answer" />
          <button
            type="button"
            className="btn-secondary"
            disabled={!show.trigger}
            onClick={() => {
              replace(addRule(setup, { signTypeCode: type, triggerQuestion: show.trigger, triggerAnswer: show.answer, targetQuestion: q.code, targetAnswer: "" }), `Show ${q.code} when ${show.trigger}`);
              setShow({ trigger: "", answer: "" });
            }}
          >
            Add
          </button>
        </div>
      </div>

      {isList(q) && (
        <div className="sbp-rule-block">
          <div className="sbp-rule-title">Answers offered <span className="sbp-muted">(when a rule applies, only its answers are offered)</span></div>
          {allowRules.length === 0 && <div className="sbp-muted">No limits — every answer is offered.</div>}
          {allowRules.map((r) => (
            <div key={r.id} className="sbp-rule">
              When <b>{prompt(r.triggerQuestion)}</b> is <b>{r.triggerAnswer || "answered"}</b> → offer <b>{r.targetAnswer}</b>
              <button type="button" className="sbp-icon-btn" onClick={() => replace(removeRule(setup, r.id), `Remove a rule on ${q.code}`)}>
                ✕
              </button>
            </div>
          ))}
          <div className="sbp-row sbp-rule-add">
            <TriggerSelect questions={earlierLists} value={allow.trigger} onChange={(v) => setAllow({ trigger: v, answer: "", offered: allow.offered })} />
            <AnswerSelect answers={triggerAnswers(allow.trigger)} value={allow.answer} onChange={(v) => setAllow({ ...allow, answer: v })} anyLabel="any answer" />
            <span>→ offer</span>
            <AnswerSelect answers={answers} value={allow.offered} onChange={(v) => setAllow({ ...allow, offered: v })} />
            <button
              type="button"
              className="btn-secondary"
              disabled={!allow.trigger || !allow.offered}
              onClick={() => {
                replace(addRule(setup, { signTypeCode: type, triggerQuestion: allow.trigger, triggerAnswer: allow.answer, targetQuestion: q.code, targetAnswer: allow.offered }), `Limit ${q.code}`);
                setAllow({ trigger: allow.trigger, answer: allow.answer, offered: "" });
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="sbp-rule-block">
        <div className="sbp-rule-title">
          Defaults <span className="sbp-muted">(the answer it starts with, by an earlier answer — until someone picks their own)</span>
        </div>
        {defaults.length === 0 && <div className="sbp-muted">No default rules — it starts as “{q.defaultValue || "blank"}”.</div>}
        {defaults.map((r) => (
          <div key={r.id} className="sbp-rule">
            When <b>{prompt(r.triggerQuestion)}</b> is <b>{r.triggerAnswer || "answered"}</b> → starts as <b>{r.value}</b>
            <button type="button" className="sbp-icon-btn" onClick={() => replace(removeDefaultRule(setup, r.id), `Remove a default on ${q.code}`)}>
              ✕
            </button>
          </div>
        ))}
        <div className="sbp-row sbp-rule-add">
          <TriggerSelect questions={earlierLists} value={def.trigger} onChange={(v) => setDef({ trigger: v, answer: "", value: def.value })} />
          <AnswerSelect answers={triggerAnswers(def.trigger)} value={def.answer} onChange={(v) => setDef({ ...def, answer: v })} anyLabel="any answer" />
          <span>→ starts as</span>
          {isList(q) ? (
            <AnswerSelect answers={answers} value={def.value} onChange={(v) => setDef({ ...def, value: v })} />
          ) : (
            <input className="sbp-input" style={{ maxWidth: 200 }} value={def.value} onChange={(e) => setDef({ ...def, value: e.target.value })} />
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={!def.trigger || !def.value}
            onClick={() => {
              replace(addDefaultRule(setup, { signTypeCode: type, triggerQuestion: def.trigger, triggerAnswer: def.answer, targetQuestion: q.code, value: def.value }), `Default for ${q.code}`);
              setDef({ trigger: def.trigger, answer: "", value: "" });
            }}
          >
            Add
          </button>
          {def.trigger && onOpenMatrix && (
            <button type="button" className="btn-secondary" onClick={() => onOpenMatrix(def.trigger, q.code)}>
              Set all in the Defaults matrix
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

function TriggerSelect({ questions, value, onChange }: { questions: Question[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="sbp-input" style={{ maxWidth: 240 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">When question…</option>
      {questions.map((x) => (
        <option key={x.code} value={x.code}>
          {x.prompt} ({x.code})
        </option>
      ))}
    </select>
  );
}

function AnswerSelect({ answers, value, onChange, anyLabel }: { answers: string[]; value: string; onChange: (v: string) => void; anyLabel?: string }) {
  return (
    <select className="sbp-input" style={{ maxWidth: 220 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{anyLabel ?? "answer…"}</option>
      {answers.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sbp-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sbp-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
