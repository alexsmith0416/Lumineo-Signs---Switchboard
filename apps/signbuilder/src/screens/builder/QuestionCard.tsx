import { useEffect, useState } from "react";
import type { AnswerState, Question, VinylColor } from "../../domain/types";
import type { SetupIndex } from "../../engine/setup-index";
import { formatLength, isOpenDesignValue, isPendingValue, isSurveyValue, sameAnswer, vinylLabel } from "../../engine/values";
import { isRequired } from "../../engine/flow";
import { Modal } from "../../components/ui";

interface Props {
  idx: SetupIndex;
  number: number;
  question: Question;
  state: AnswerState;
  isNew: boolean;
  readOnly: boolean;
  error: string;
  onAnswer: (input: string, sizes?: number[]) => void;
}

/** One question as a step card: choices as buttons, sizes as ft/in boxes,
 *  text and numbers as inputs that save on Enter / leaving the box. */
export default function QuestionCard({ idx, number, question: q, state, isNew, readOnly, error, onAnswer }: Props) {
  const pending = isPendingValue(state.value);
  const cls = ["sbp-step", state.nextStep && "sbp-step--next", isNew && "sbp-step--new", pending && "sbp-step--pending"].filter(Boolean).join(" ");
  let hint = q.hint;
  if (isSurveyValue(state.value)) hint = "Waiting on the site survey — listed under SURVEY NEEDED in the descriptions until answered.";
  if (isOpenDesignValue(state.value)) hint = "Open for design — needs a real answer before the order is released.";

  return (
    <div className={cls} id={`q-${q.code}`}>
      <div className="sbp-step__head">
        <span className="sbp-step__num">{number}</span>
        <span className="sbp-step__prompt">
          {q.prompt}
          {isRequired(q) && <span className="sbp-step__required"> *</span>}
        </span>
        {isNew && <span className="sbp-pill sbp-pill--new">new</span>}
        {state.restricted && <span className="sbp-pill" title="Rules on this sign limit the answers offered here">limited</span>}
      </div>
      <AnswerInput idx={idx} q={q} state={state} readOnly={readOnly} onAnswer={onAnswer} />
      {error && <div className="sbp-step__error">{error}</div>}
      {hint && !error && <div className="sbp-step__hint">{hint}</div>}
    </div>
  );
}

function AnswerInput({ idx, q, state, readOnly, onAnswer }: { idx: SetupIndex; q: Question; state: AnswerState; readOnly: boolean; onAnswer: (input: string, sizes?: number[]) => void }) {
  switch (q.answerType) {
    case "option":
    case "yesno":
      return <Choices idx={idx} q={q} state={state} readOnly={readOnly} onAnswer={onAnswer} />;
    case "dimension":
      return <SizeInput q={q} state={state} readOnly={readOnly} onAnswer={onAnswer} />;
    case "vinyl":
      return <VinylInput idx={idx} q={q} state={state} readOnly={readOnly} onAnswer={onAnswer} />;
    default:
      return <TextInput q={q} state={state} readOnly={readOnly} onAnswer={onAnswer} />;
  }
}

function Choices({ idx, q, state, readOnly, onAnswer }: { idx: SetupIndex; q: Question; state: AnswerState; readOnly: boolean; onAnswer: (input: string) => void }) {
  let options = idx.options(q.signTypeCode, q.code).map((o) => o.value);
  if (q.answerType === "yesno" && options.length === 0) options = ["Yes", "No"];
  if (state.restricted) options = options.filter((v) => isPendingValue(v) || state.allowed.some((a) => sameAnswer(a, v)));
  const isListed = options.some((v) => sameAnswer(v, state.value));
  const [other, setOther] = useState(isListed ? "" : state.value);
  useEffect(() => setOther(isListed ? "" : state.value), [state.value, isListed]);

  // Long lists read better as a dropdown.
  if (options.length > 8) {
    return (
      <div className="sbp-row">
        <select className="sbp-select" disabled={readOnly} value={isListed ? state.value : ""} onChange={(e) => onAnswer(e.target.value)} style={{ minWidth: 280 }}>
          <option value="">— pick —</option>
          {options.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {q.allowFreeText && (
          <input className="sbp-input" placeholder="or type another…" value={other} disabled={readOnly} onChange={(e) => setOther(e.target.value)} onBlur={() => other !== state.value && other.trim() && onAnswer(other)} onKeyDown={(e) => e.key === "Enter" && onAnswer(other)} />
        )}
      </div>
    );
  }
  return (
    <div className="sbp-choices">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          disabled={readOnly}
          className={`sbp-choice${sameAnswer(v, state.value) ? " sbp-choice--on" : ""}${isPendingValue(v) ? " sbp-choice--special" : ""}`}
          onClick={() => onAnswer(sameAnswer(v, state.value) && !q.required ? "" : v)}
        >
          {v}
        </button>
      ))}
      {q.allowFreeText && (
        <input
          className="sbp-input"
          placeholder="Other…"
          value={other}
          disabled={readOnly}
          onChange={(e) => setOther(e.target.value)}
          onBlur={() => other.trim() && other !== state.value && onAnswer(other)}
          onKeyDown={(e) => e.key === "Enter" && other.trim() && onAnswer(other)}
          style={{ width: 180 }}
        />
      )}
    </div>
  );
}

function TextInput({ q, state, readOnly, onAnswer }: { q: Question; state: AnswerState; readOnly: boolean; onAnswer: (input: string) => void }) {
  const [text, setText] = useState(state.value);
  useEffect(() => setText(state.value), [state.value]);
  const commit = () => {
    if (text !== state.value) onAnswer(text);
  };
  return (
    <div className="sbp-row">
      <input
        className="sbp-input"
        style={{ flex: 1, minWidth: 220 }}
        value={text}
        disabled={readOnly}
        placeholder={q.answerType === "number" ? `Number${q.unit ? ` (${q.unit})` : ""}` : "Type the answer"}
        inputMode={q.answerType === "number" ? "decimal" : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {q.allowSurvey && (
        <button type="button" className={`sbp-choice sbp-choice--special${isSurveyValue(state.value) ? " sbp-choice--on" : ""}`} disabled={readOnly} onClick={() => onAnswer("Needs Survey")}>
          Needs Survey
        </button>
      )}
      {q.allowOpenForDesign && (
        <button type="button" className={`sbp-choice sbp-choice--special${isOpenDesignValue(state.value) ? " sbp-choice--on" : ""}`} disabled={readOnly} onClick={() => onAnswer("Open for design")}>
          Open for design
        </button>
      )}
    </div>
  );
}

/** Feet + inches per part (Height / Width / Depth); typing "48x96" in the quick box also works. */
function SizeInput({ q, state, readOnly, onAnswer }: { q: Question; state: AnswerState; readOnly: boolean; onAnswer: (input: string, sizes?: number[]) => void }) {
  const parts = q.dimensionParts || 3;
  const labels = (q.dimensionLabels || "Height|Width|Depth").split("|");
  const split = (inches: number | undefined): [string, string] => {
    if (!inches) return ["", ""];
    const ft = Math.floor(inches / 12);
    const rest = Math.round((inches - ft * 12) * 16) / 16;
    return [ft ? String(ft) : "", rest ? String(rest) : ft ? "0" : ""];
  };
  const [boxes, setBoxes] = useState<[string, string][]>(() => Array.from({ length: parts }, (_, i) => split(state.sizes[i])));
  useEffect(() => setBoxes(Array.from({ length: parts }, (_, i) => split(state.sizes[i]))), [state.value, parts]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: [string, string][]) => {
    const sizes = next.map(([ft, inch]) => (Number(ft) || 0) * 12 + (Number(inch) || 0));
    if (sizes.every((s) => s === 0)) {
      if (state.value) onAnswer("");
      return;
    }
    if (sizes.some((s) => s === 0)) return; // wait until every part is filled
    onAnswer(sizes.map((s) => formatLength(s)).join(" x "), sizes);
  };

  return (
    <div className="sbp-dim">
      {boxes.map(([ft, inch], i) => (
        <div className="sbp-dim__part" key={i}>
          <span className="sbp-caption">{labels[i] ?? `Size ${i + 1}`}</span>
          <div className="sbp-dim__boxes">
            <input
              className="sbp-input"
              inputMode="decimal"
              placeholder="ft"
              value={ft}
              disabled={readOnly}
              onChange={(e) => setBoxes(boxes.map((b, j) => (j === i ? [e.target.value, b[1]] : b)))}
              onBlur={() => commit(boxes)}
            />
            <span className="sbp-muted">’</span>
            <input
              className="sbp-input"
              inputMode="decimal"
              placeholder="in"
              value={inch}
              disabled={readOnly}
              onChange={(e) => setBoxes(boxes.map((b, j) => (j === i ? [b[0], e.target.value] : b)))}
              onBlur={() => commit(boxes)}
              onKeyDown={(e) => e.key === "Enter" && commit(boxes)}
            />
            <span className="sbp-muted">”</span>
          </div>
        </div>
      ))}
      {state.value && <span className="sbp-code">{state.value}</span>}
      {q.allowSurvey && (
        <button type="button" className={`sbp-choice sbp-choice--special${isSurveyValue(state.value) ? " sbp-choice--on" : ""}`} disabled={readOnly} onClick={() => onAnswer("Needs Survey")}>
          Needs Survey
        </button>
      )}
    </div>
  );
}

function VinylInput({ idx, q, state, readOnly, onAnswer }: { idx: SetupIndex; q: Question; state: AnswerState; readOnly: boolean; onAnswer: (input: string) => void }) {
  const [open, setOpen] = useState(false);
  const colors = idx.data.vinylColors.filter((c) => !q.vinylSeries || c.series === q.vinylSeries).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="sbp-row">
      <span style={{ flex: 1 }}>{state.value || <span className="sbp-muted">No colors picked</span>}</span>
      <button type="button" className="btn-secondary" disabled={readOnly} onClick={() => setOpen(true)}>
        Pick colors
      </button>
      {open && <VinylPicker colors={colors} value={state.value} series={q.vinylSeries} onClose={() => setOpen(false)} onDone={(v) => { setOpen(false); onAnswer(v); }} />}
    </div>
  );
}

const colorLabel = (c: VinylColor): string => vinylLabel(c);

function VinylPicker({ colors, value, series, onClose, onDone }: { colors: VinylColor[]; value: string; series: string; onClose: () => void; onDone: (v: string) => void }) {
  const [picked, setPicked] = useState<string[]>(() => value.split(",").map((s) => s.trim()).filter(Boolean));
  const [search, setSearch] = useState("");
  const shown = colors.filter((c) => colorLabel(c).toLowerCase().includes(search.toLowerCase()));
  const toggle = (label: string) => setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
  return (
    <Modal
      title={`Vinyl colors${series ? ` – 3M ${series}` : ""}`}
      onClose={onClose}
      wide
      actions={
        <button type="button" className="btn-primary" onClick={() => onDone(picked.join(", "))}>
          Use {picked.length} color{picked.length === 1 ? "" : "s"}
        </button>
      }
    >
      <input className="sbp-input" placeholder="Search colors…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
      {colors.length === 0 && <div className="sbp-muted">No vinyl colors in the setup yet — they come over with the import from Business Central.</div>}
      <div className="sbp-swatches">
        {shown.map((c) => {
          const label = colorLabel(c);
          return (
            <button key={`${c.series}-${c.code}`} type="button" className={`sbp-swatch${picked.includes(label) ? " sbp-swatch--on" : ""}`} onClick={() => toggle(label)}>
              <span className="sbp-swatch__chip" style={{ background: c.hex || "transparent" }} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
