import { useEffect, useMemo, useRef, useState } from "react";
import type { OutputType, Question, Spec, TemplateLine } from "../../domain/types";
import { buildFromTemplates, templateSentence } from "../../engine/descriptions";
import type { SetupIndex } from "../../engine/setup-index";
import {
  addTemplateLine,
  copyTemplateFrom,
  deleteTemplateLine,
  FIXED_TOKENS,
  linesOf,
  moveTemplateLine,
  questionsUsed,
  replaceQuestionInLine,
  sampleSign,
  suggestReplacements,
  templateLineProblems,
  updateTemplateLine,
  type TemplatePatch,
} from "../../setup/template-ops";
import { useSetupStore } from "../../store/setup-store";
import { DescriptionText } from "../builder/DescriptionPreview";
import { TypePicker } from "./setup-ui";

const isList = (q: Question) => q.answerType === "option" || q.answerType === "yesno";
const OUTPUT_NAMES: Record<Exclude<OutputType, "production">, string> = { field: "Field Description", extended: "Extended Description" };

const SAMPLE_SPEC: Spec = {
  id: "preview", number: "SAMPLE", description: "", purpose: "opportunity", status: "draft", detailLevel: "full", opportunityNo: "", jobNo: "J-0000",
  projectId: "", customerNo: "", customerName: "", contactName: "", designReference: "D-1234", jobDetailNotes: "", createdAt: "", createdBy: "",
  modifiedAt: "", lastGeneratedAt: "", approvedBy: "", approvedAt: "",
};

/** Setup → Descriptions: the sentences a sign type's Field (and Extended)
 *  Description is built from — each line with when it prints — and a live
 *  preview on a sample sign whose answers you can change. */
export default function Descriptions({ typeCode, setTypeCode }: { typeCode: string; setTypeCode: (c: string) => void }) {
  const setup = useSetupStore((s) => s.setup);
  const idx = useSetupStore((s) => s.idx);
  const replace = useSetupStore((s) => s.replace);
  const [out, setOut] = useState<"field" | "extended">("field");
  const [open, setOpen] = useState<number | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [partNumbers, setPartNumbers] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);

  useEffect(() => {
    setOpen(null);
    setPicks({});
    setCopying(null);
  }, [typeCode, out]);

  const lines = useMemo(() => (setup ? linesOf(setup, typeCode, out) : []), [setup, typeCode, out]);
  const sample = useMemo(() => (idx && typeCode ? sampleSign(idx, typeCode, picks) : null), [idx, typeCode, picks]);

  if (!setup || !idx) return <div className="sbp-muted">Loading…</div>;
  const typeName = (c: string) => setup.signTypes.find((t) => t.code === c)?.description ?? c;
  const outName = OUTPUT_NAMES[out];
  const edit = (lineNo: number, patch: TemplatePatch, what = "Edit") => replace(updateTemplateLine(setup, typeCode, out, lineNo, patch), `${what} ${typeCode} ${outName} line`);
  const add = (after?: number) => {
    const r = addTemplateLine(setup, typeCode, out, after);
    replace(r.setup, `Add ${typeCode} ${outName} line`);
    setOpen(r.lineNo);
  };
  const move = (lineNo: number, dir: -1 | 1) => {
    const i = lines.findIndex((l) => l.lineNo === lineNo);
    const other = lines[i + dir];
    if (!other) return;
    replace(moveTemplateLine(setup, typeCode, out, lineNo, dir), `Move ${typeCode} ${outName} line`);
    setOpen(other.lineNo);
  };
  const remove = (lineNo: number) => {
    replace(deleteTemplateLine(setup, typeCode, out, lineNo), `Delete ${typeCode} ${outName} line`);
    setOpen(null);
  };

  // Questions the template looks at (for the sample's answer pickers).
  const used = [...new Set(lines.flatMap(questionsUsed))]
    .map((c) => idx.question(typeCode, c))
    .filter((q): q is Question => !!q && isList(q))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const problemCount = lines.reduce((n, l) => n + templateLineProblems(idx, l).length, 0);
  const copySources = setup.signTypes.filter((t) => t.code !== typeCode && !t.isBlock && linesOf(setup, t.code, out).length > 0);

  return (
    <div className="sbp-setup-split" style={{ gridTemplateColumns: "minmax(0, 1fr) 440px" }}>
      <div className="sbp-card" data-tour="descriptions">
        <TypePicker setup={setup} typeCode={typeCode} onChange={setTypeCode} />
        <div className="sbp-tabs" style={{ marginTop: 10 }}>
          {(Object.keys(OUTPUT_NAMES) as ("field" | "extended")[]).map((o) => (
            <button key={o} type="button" className={`sbp-tab${out === o ? " sbp-tab--on" : ""}`} onClick={() => setOut(o)}>
              {OUTPUT_NAMES[o]} ({linesOf(setup, typeCode, o).length})
            </button>
          ))}
          <div className="sbp-spacer" />
          {problemCount > 0 && <span className="sbp-pill sbp-pill--warn">{problemCount} to fix</span>}
          <button type="button" className="btn-secondary" onClick={() => setCopying(copySources[0]?.code ?? "")} disabled={copySources.length === 0}>
            Copy from another sign type…
          </button>
        </div>
        <p className="sbp-muted" style={{ fontSize: 12, marginTop: 0 }}>
          The {outName} is these sentences in order, each printed only when its condition is met. <b>{"{…}"}</b> boxes are filled with the sign's answers — a
          sentence whose box comes out blank is left out. Click a line to edit it.
        </p>

        {copying !== null && (
          <div className="sbp-banner" style={{ marginBottom: 10 }}>
            <div className="sbp-row" style={{ flexWrap: "wrap" }}>
              <span>Replace this {outName} with the one from</span>
              <select className="sbp-input" style={{ width: 320 }} value={copying} onChange={(e) => setCopying(e.target.value)}>
                {copySources.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.description} ({t.code}) – {linesOf(setup, t.code, out).length} lines
                  </option>
                ))}
              </select>
              <div className="sbp-spacer" />
              <button type="button" className="btn-secondary" onClick={() => setCopying(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  replace(copyTemplateFrom(setup, copying, typeCode, out), `Copy ${outName} from ${copying} to ${typeCode}`);
                  setCopying(null);
                }}
              >
                Replace {lines.length} line{lines.length === 1 ? "" : "s"}
              </button>
            </div>
            <div className="sbp-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Lines that use questions {typeName(typeCode)} doesn't have are marked so you can fix them. Undo puts the old lines back.
            </div>
          </div>
        )}

        {lines.length === 0 && <div className="sbp-muted" style={{ margin: "10px 0" }}>No {outName} lines on this sign type yet.</div>}
        <div className="sbp-tpl-list">
          {lines.map((l, i) => {
            const printed = sample ? templateSentence(idx, SAMPLE_SPEC, sample, l, partNumbers) : null;
            return (
              <TemplateRow
                key={`${typeCode}|${out}|${l.lineNo}`}
                idx={idx}
                line={l}
                printed={printed !== null}
                open={open === l.lineNo}
                first={i === 0}
                last={i === lines.length - 1}
                onToggle={() => setOpen(open === l.lineNo ? null : l.lineNo)}
                onEdit={(p, what) => edit(l.lineNo, p, what)}
                onMove={(d) => move(l.lineNo, d)}
                onAddBelow={() => add(l.lineNo)}
                onDelete={() => remove(l.lineNo)}
              />
            );
          })}
        </div>
        <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={() => add()}>
          + Add line at the end
        </button>
      </div>

      <div className="sbp-card sbp-tpl-preview" data-tour="descriptions-preview">
        <div className="sbp-row">
          <div className="sbp-caption">Preview – sample {typeName(typeCode)}</div>
          <div className="sbp-spacer" />
          <label className="sbp-check" title="Print the BC part # after each linked material">
            <input type="checkbox" checked={partNumbers} onChange={(e) => setPartNumbers(e.target.checked)} /> Part #s
          </label>
        </div>
        <DescriptionText text={sample ? buildFromTemplates(idx, SAMPLE_SPEC, [sample], out, { partNumbers }) : ""} />
        {used.length > 0 && (
          <>
            <div className="sbp-row" style={{ margin: "12px 0 4px" }}>
              <div className="sbp-caption">Try other answers</div>
              <div className="sbp-spacer" />
              {Object.keys(picks).length > 0 && (
                <button type="button" className="btn-secondary" onClick={() => setPicks({})}>
                  Reset
                </button>
              )}
            </div>
            <div className="sbp-tpl-picks">
              {used.map((q) => {
                const a = sample?.answers[q.code];
                const shown = !!a?.e;
                return (
                  <div key={q.code} className="sbp-field">
                    <label title={q.code}>
                      {q.outputLabel || q.prompt}
                      {!shown && <span className="sbp-muted"> – not asked with these answers</span>}
                    </label>
                    <select
                      className="sbp-input"
                      disabled={!shown}
                      value={shown ? (a?.v ?? "") : ""}
                      onChange={(e) => setPicks({ ...picks, [q.code]: e.target.value })}
                    >
                      {!shown && <option value="">—</option>}
                      {idx.options(typeCode, q.code).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.value}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="sbp-muted" style={{ fontSize: 11, marginTop: 8 }}>
          Every other question takes its default or first answer; typed answers show as [Label]. Lines marked “not printed” in the list are left out for these
          answers.
        </div>
      </div>
    </div>
  );
}

function TemplateRow({
  idx,
  line,
  printed,
  open,
  first,
  last,
  onToggle,
  onEdit,
  onMove,
  onAddBelow,
  onDelete,
}: {
  idx: SetupIndex;
  line: TemplateLine;
  printed: boolean;
  open: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onEdit: (p: TemplatePatch, what?: string) => void;
  onMove: (dir: -1 | 1) => void;
  onAddBelow: () => void;
  onDelete: () => void;
}) {
  const problems = templateLineProblems(idx, line);
  const type = line.signTypeCode;
  return (
    <div className={`sbp-tpl${open ? " sbp-tpl--on" : ""}${problems.length ? " sbp-tpl--bad" : ""}`}>
      <div className="sbp-tpl__head" onClick={onToggle}>
        <div className="sbp-tpl__when">
          {describeWhen(idx, line)}
          {line.newParagraph && <span className="sbp-pill" title="Starts a new paragraph">¶ new paragraph</span>}
          {!printed && <span className="sbp-pill" title="Left out of the preview's sample sign">not printed</span>}
        </div>
        <div className="sbp-tpl__text">{line.text ? <TokenText idx={idx} type={type} text={line.text} /> : <span className="sbp-muted">(blank line)</span>}</div>
      </div>
      {problems.map((p, i) => (
        <div key={i} className="sbp-banner sbp-banner--warn" style={{ margin: "6px 0 0" }}>
          <div>This line {p.text}</div>
          {p.kind === "missingQuestion" && <ReplaceMissing idx={idx} line={line} code={p.code} onEdit={onEdit} onDelete={onDelete} />}
        </div>
      ))}
      {open && <LineEditor idx={idx} line={line} first={first} last={last} onEdit={onEdit} onMove={onMove} onAddBelow={onAddBelow} onDelete={onDelete} />}
    </div>
  );
}

/** Quick fixes for a question the sign type doesn't have. */
function ReplaceMissing({ idx, line, code, onEdit, onDelete }: { idx: SetupIndex; line: TemplateLine; code: string; onEdit: (p: TemplatePatch, what?: string) => void; onDelete: () => void }) {
  const type = line.signTypeCode;
  const suggestions = suggestReplacements(idx, type, code);
  const use = (to: string) => onEdit(replaceQuestionInLine(line, code, to), `Use ${to} for ${code} in`);
  return (
    <div className="sbp-row" style={{ flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      <span className="sbp-muted" style={{ fontSize: 12 }}>Use instead:</span>
      {suggestions.map((q) => (
        <button key={q.code} type="button" className="btn-secondary" onClick={() => use(q.code)} title={q.code}>
          {q.prompt}
        </button>
      ))}
      <select className="sbp-input" style={{ width: 220 }} value="" onChange={(e) => e.target.value && use(e.target.value)}>
        <option value="">{suggestions.length ? "Another question…" : "Pick a question…"}</option>
        {idx.questions(type).map((q) => (
          <option key={q.code} value={q.code}>
            {q.prompt} ({q.code})
          </option>
        ))}
      </select>
      <span className="sbp-muted" style={{ fontSize: 12 }}>or</span>
      <button type="button" className="btn-secondary" onClick={onDelete}>
        Delete the line
      </button>
    </div>
  );
}

function LineEditor({
  idx,
  line,
  first,
  last,
  onEdit,
  onMove,
  onAddBelow,
  onDelete,
}: {
  idx: SetupIndex;
  line: TemplateLine;
  first: boolean;
  last: boolean;
  onEdit: (p: TemplatePatch, what?: string) => void;
  onMove: (dir: -1 | 1) => void;
  onAddBelow: () => void;
  onDelete: () => void;
}) {
  const type = line.signTypeCode;
  const [text, setText] = useState(line.text);
  const [lowerCase, setLowerCase] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef(line.text.length);
  useEffect(() => setText(line.text), [line.text]);
  const commit = (v: string) => v !== line.text && onEdit({ text: v });
  const insert = (token: string) => {
    const at = Math.min(caret.current, text.length);
    const v = text.slice(0, at) + token + text.slice(at);
    setText(v);
    commit(v);
    caret.current = at + token.length;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(caret.current, caret.current);
    });
  };
  const questions = idx.questions(type);

  return (
    <div className="sbp-tpl__editor">
      <div className="sbp-field">
        <label>Sentence</label>
        <textarea
          ref={ref}
          className="sbp-input"
          rows={2}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onSelect={(e) => (caret.current = (e.target as HTMLTextAreaElement).selectionStart)}
          onBlur={(e) => {
            caret.current = e.target.selectionStart;
            commit(text);
          }}
        />
      </div>
      <div className="sbp-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        <select className="sbp-input" style={{ width: 300 }} value="" onChange={(e) => e.target.value && insert(e.target.value)}>
          <option value="">Insert an answer at the cursor…</option>
          <optgroup label="Answer to">
            {questions.map((q) => (
              <option key={q.code} value={`{${lowerCase ? "LQ" : "Q"}:${q.code}}`}>
                {q.prompt} ({q.code})
              </option>
            ))}
          </optgroup>
          <optgroup label="Sign / job">
            {FIXED_TOKENS.map((f) => (
              <option key={f.token} value={`{${f.token}}`}>
                {f.means} {`{${f.token}}`}
              </option>
            ))}
          </optgroup>
        </select>
        <label className="sbp-check" title="Insert the answer in lower case — for mid-sentence answers, e.g. “Remove existing sign and {LQ:REMOVE_DISPOSE}.”">
          <input type="checkbox" checked={lowerCase} onChange={(e) => setLowerCase(e.target.checked)} /> in lower case
        </label>
        <span className="sbp-muted" style={{ fontSize: 11 }}>\n in the text starts a new line.</span>
      </div>

      <ConditionEditor
        label="Print only when"
        idx={idx}
        type={type}
        question={line.conditionQuestion}
        values={line.conditionValues}
        onChange={(q, v) => onEdit({ conditionQuestion: q, conditionValues: v }, "Change condition of")}
      />
      {(line.conditionQuestion || line.andConditionQuestion) && (
        <ConditionEditor
          label="…and when"
          idx={idx}
          type={type}
          question={line.andConditionQuestion}
          values={line.andConditionValues}
          onChange={(q, v) => onEdit({ andConditionQuestion: q, andConditionValues: v }, "Change condition of")}
        />
      )}

      <div className="sbp-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        <label className="sbp-check">
          <input type="checkbox" checked={line.newParagraph} onChange={(e) => onEdit({ newParagraph: e.target.checked })} /> Start a new paragraph
        </label>
        <div className="sbp-spacer" />
        <button type="button" className="btn-secondary" disabled={first} onClick={() => onMove(-1)} title="Move up">
          ↑
        </button>
        <button type="button" className="btn-secondary" disabled={last} onClick={() => onMove(1)} title="Move down">
          ↓
        </button>
        <button type="button" className="btn-secondary" onClick={onAddBelow}>
          + Add line below
        </button>
        <button type="button" className="btn-secondary" onClick={onDelete}>
          Delete line
        </button>
      </div>
    </div>
  );
}

/** "When [question] is / is not [answers] / is answered" → Condition Question + Values ("a|b", "!a|b", "" = answered). */
export function ConditionEditor({
  label,
  emptyLabel,
  idx,
  type,
  question,
  values,
  onChange,
}: {
  label: string;
  /** The "no condition" choice, e.g. "— always print —". */
  emptyLabel?: string;
  idx: SetupIndex;
  type: string;
  question: string;
  values: string;
  onChange: (question: string, values: string) => void;
}) {
  const negate = values.startsWith("!");
  const list = (negate ? values.slice(1) : values).split("|").map((v) => v.trim()).filter(Boolean);
  const [mode, setMode] = useState<"answered" | "is" | "not">(negate ? "not" : list.length ? "is" : "answered");
  // "is" with nothing ticked yet stays "is" (it saves as "is answered" until a box is ticked).
  useEffect(() => {
    if (values) setMode(negate ? "not" : "is");
  }, [values]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!values) setMode("answered");
  }, [question]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = question ? idx.question(type, question) : undefined;
  const answers = q && isList(q) ? idx.options(type, q.code).map((o) => o.value) : [];
  const encode = (m: typeof mode, vs: string[]) => (m === "answered" || vs.length === 0 ? "" : (m === "not" ? "!" : "") + vs.join("|"));
  const toggle = (a: string, on: boolean) => {
    const next = on ? [...list, a] : list.filter((x) => x.toLowerCase() !== a.toLowerCase());
    onChange(question, encode(mode, next));
  };
  const odd = list.filter((v) => !answers.some((a) => a.toLowerCase() === v.toLowerCase()));

  return (
    <div className="sbp-tpl__cond">
      <div className="sbp-row" style={{ flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, minWidth: 110 }}>{label}</span>
        <select className="sbp-input" style={{ width: 280 }} value={question} onChange={(e) => onChange(e.target.value, "")}>
          <option value="">{emptyLabel ?? (label === "Print only when" ? "— always print —" : "— no second condition —")}</option>
          {question && !q && <option value={question}>{question} (not on this sign type)</option>}
          {idx.questions(type).map((x) => (
            <option key={x.code} value={x.code}>
              {x.prompt} ({x.code})
            </option>
          ))}
        </select>
        {question && (
          <select
            className="sbp-input"
            style={{ width: 150 }}
            value={mode}
            onChange={(e) => {
              const m = e.target.value as typeof mode;
              setMode(m);
              onChange(question, encode(m, list));
            }}
          >
            <option value="answered">is answered</option>
            <option value="is">is</option>
            <option value="not">is not</option>
          </select>
        )}
      </div>
      {question && mode !== "answered" && (
        <div className="sbp-checks" style={{ marginLeft: 118 }}>
          {answers.map((a) => (
            <label key={a} className="sbp-check">
              <input type="checkbox" checked={list.some((v) => v.toLowerCase() === a.toLowerCase())} onChange={(e) => toggle(a, e.target.checked)} /> {a}
            </label>
          ))}
          {odd.map((v) => (
            <label key={v} className="sbp-check" title="Not one of its answers">
              <input type="checkbox" checked onChange={() => toggle(v, false)} /> <s>{v}</s>
            </label>
          ))}
          {(!q || !isList(q)) && (
            <input
              className="sbp-input"
              style={{ width: 300 }}
              defaultValue={list.join("|")}
              placeholder="Answers, separated by |"
              onBlur={(e) => onChange(question, encode(mode, e.target.value.split("|").map((v) => v.trim()).filter(Boolean)))}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function describeWhen(idx: SetupIndex, line: Pick<TemplateLine, "signTypeCode" | "conditionQuestion" | "conditionValues" | "andConditionQuestion" | "andConditionValues">): string {
  const one = (code: string, values: string) => {
    const q = idx.question(line.signTypeCode, code);
    const name = q ? `“${q.outputLabel || q.prompt}”` : `${code} (missing)`;
    if (!values) return `${name} is answered`;
    const not = values.startsWith("!");
    const list = (not ? values.slice(1) : values).split("|").map((v) => v.trim()).filter(Boolean);
    return `${name} ${not ? "is not" : "is"} ${list.join(" or ")}`;
  };
  const parts: string[] = [];
  if (line.conditionQuestion) parts.push(one(line.conditionQuestion, line.conditionValues));
  if (line.andConditionQuestion) parts.push(one(line.andConditionQuestion, line.andConditionValues));
  return parts.length ? `When ${parts.join(" and ")}` : "Always";
}

/** The sentence with its {…} boxes shown as chips named after the question. */
function TokenText({ idx, type, text }: { idx: SetupIndex; type: string; text: string }) {
  return (
    <>
      {text.split(/(\{[^}]*\})/g).map((part, i) => {
        const m = /^\{([^}]*)\}$/.exec(part);
        if (!m) return <span key={i}>{part}</span>;
        const tok = m[1]!.trim().toUpperCase();
        const qm = /^(L?Q):(.*)$/.exec(tok);
        if (qm) {
          const q = idx.question(type, qm[2]!.trim());
          return (
            <span key={i} className={`sbp-tpl__tok${q ? "" : " sbp-tpl__tok--bad"}`} title={part}>
              {q ? q.outputLabel || q.prompt : `${qm[2]} (missing)`}
              {qm[1] === "LQ" ? " · lower case" : ""}
            </span>
          );
        }
        const f = FIXED_TOKENS.find((x) => x.token === tok);
        return (
          <span key={i} className={`sbp-tpl__tok${f ? " sbp-tpl__tok--fixed" : " sbp-tpl__tok--bad"}`} title={part}>
            {f ? f.means : part}
          </span>
        );
      })}
    </>
  );
}
