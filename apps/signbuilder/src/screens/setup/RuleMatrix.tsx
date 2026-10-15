import { useEffect, useMemo, useState } from "react";
import type { Question } from "../../domain/types";
import { SetupIndex } from "../../engine/setup-index";
import { copyDefaults, setDefaultFor, setShowRule, typesWithBoth } from "../../setup/question-ops";
import { useSetupStore } from "../../store/setup-store";
import { TypePicker } from "./setup-ui";

type Mode = "show" | "defaults";
const isList = (q: Question) => q.answerType === "option" || q.answerType === "yesno";

/** Setup → Rules. "Shown when": pick a question; tick which later questions
 *  each of its answers brings up. "Defaults": pick a question and a later one;
 *  set what the later one starts as for each answer — e.g. Face material →
 *  Face frame material — and copy that to the other sign types. */
export default function RuleMatrix({
  typeCode,
  setTypeCode,
  trigger,
  setTrigger,
  target,
  setTarget,
  mode,
  setMode,
}: {
  typeCode: string;
  setTypeCode: (c: string) => void;
  trigger: string;
  setTrigger: (c: string) => void;
  target: string;
  setTarget: (c: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const setup = useSetupStore((s) => s.setup);
  const replace = useSetupStore((s) => s.replace);
  const idx = useMemo(() => (setup ? new SetupIndex(setup) : null), [setup]);
  const [copyTo, setCopyTo] = useState<Set<string> | null>(null);
  const [copied, setCopied] = useState("");

  const questions = idx?.questions(typeCode) ?? [];
  const triggers = questions.filter(isList);
  const trig = questions.find((q) => q.code === trigger);
  useEffect(() => {
    if (!trig && triggers[0]) setTrigger(triggers[0].code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCode, trig]);
  useEffect(() => {
    setCopyTo(null);
    setCopied("");
  }, [typeCode, trigger, target]);

  if (!setup || !idx) return <div className="sbp-muted">Loading…</div>;
  const later = trig ? questions.filter((q) => q.sortOrder > trig.sortOrder) : [];
  const answers = trig ? idx.options(typeCode, trig.code).map((o) => o.value) : [];

  return (
    <div className="sbp-card" data-tour="rule-matrix">
      <div className="sbp-row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div style={{ minWidth: 420, flex: 1 }}>
          <TypePicker setup={setup} typeCode={typeCode} onChange={setTypeCode} />
        </div>
        <div className="sbp-field" style={{ minWidth: 260 }}>
          <label>When the answer to</label>
          <select className="sbp-input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {triggers.map((q) => (
              <option key={q.code} value={q.code}>
                {q.prompt} ({q.code})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sbp-tabs" style={{ marginTop: 10 }}>
        <button type="button" className={`sbp-tab${mode === "show" ? " sbp-tab--on" : ""}`} onClick={() => setMode("show")}>
          Shown when — questions it brings up
        </button>
        <button type="button" className={`sbp-tab${mode === "defaults" ? " sbp-tab--on" : ""}`} onClick={() => setMode("defaults")} data-tour="defaults-matrix">
          Defaults — what a later answer starts as
        </button>
      </div>

      {!trig && <div className="sbp-muted">This sign type has no pick-list questions.</div>}

      {trig && mode === "show" && (
        <>
          <p className="sbp-muted" style={{ fontSize: 12, marginTop: 0 }}>
            Tick a box to ask the question when <b>{trig.prompt}</b> has that answer. <b>Any</b> = whatever the answer. Only questions set to “Only when a rule
            shows it” (marked <span className="sbp-pill">if</span>) need a tick — the others are always asked.
          </p>
          <div className="sbp-matrix-wrap">
            <table className="sbp-table sbp-matrix">
              <thead>
                <tr>
                  <th>Later question</th>
                  <th title="Any answer">Any</th>
                  {answers.map((a) => (
                    <th key={a} title={a}>
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {later.map((q) => {
                  const rules = idx.rulesTo(typeCode, q.code).filter((r) => r.triggerQuestion === trig.code && r.targetAnswer === "");
                  const on = (a: string) => rules.some((r) => r.triggerAnswer.toLowerCase() === a.toLowerCase());
                  return (
                    <tr key={q.code} className={q.scope === "conditional" ? "" : "sbp-matrix__always"}>
                      <td>
                        {q.prompt} {q.scope === "conditional" && <span className="sbp-pill">if</span>}
                        <div className="sbp-muted" style={{ fontSize: 10 }}>{q.code}</div>
                      </td>
                      {["", ...answers].map((a) => (
                        <td key={a || "*"} className="sbp-matrix__cell">
                          <input
                            type="checkbox"
                            checked={on(a)}
                            onChange={(e) => replace(setShowRule(setup, typeCode, trig.code, a, q.code, e.target.checked), `${e.target.checked ? "Show" : "Don't show"} ${q.code} for ${trig.code}=${a || "any"}`)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {trig && mode === "defaults" && (
        <>
          <div className="sbp-row" style={{ flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
            <div className="sbp-field" style={{ minWidth: 300 }}>
              <label>…sets the default of</label>
              <select className="sbp-input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Pick a later question…</option>
                {later.map((q) => (
                  <option key={q.code} value={q.code}>
                    {q.prompt} ({q.code}){idx.defaultRulesTo(typeCode, q.code).some((r) => r.triggerQuestion === trig.code) ? " ●" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {target && <DefaultsTable idx={idx} typeCode={typeCode} trigger={trig} targetCode={target} answers={answers} />}
          {target && (
            <div className="sbp-banner" style={{ marginTop: 12 }}>
              {(() => {
                const others = typesWithBoth(setup, typeCode, trig.code, target);
                const typeName = (c: string) => setup.signTypes.find((t) => t.code === c)?.description ?? c;
                if (others.length === 0) return <span className="sbp-muted">No other sign type has both of these questions.</span>;
                if (!copyTo)
                  return (
                    <div className="sbp-row">
                      <span>
                        {others.length} other sign type{others.length === 1 ? " has" : "s have"} both questions.
                      </span>
                      <div className="sbp-spacer" />
                      {copied && <span className="sbp-muted">{copied}</span>}
                      <button type="button" className="btn-secondary" onClick={() => setCopyTo(new Set(others))}>
                        Copy these defaults to other sign types…
                      </button>
                    </div>
                  );
                return (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Copy to (replaces their defaults for this pair):</div>
                    <div className="sbp-checks">
                      {others.map((c) => (
                        <label key={c} className="sbp-check">
                          <input
                            type="checkbox"
                            checked={copyTo.has(c)}
                            onChange={(e) => {
                              const n = new Set(copyTo);
                              if (e.target.checked) n.add(c);
                              else n.delete(c);
                              setCopyTo(n);
                            }}
                          />
                          {typeName(c)} <span className="sbp-muted">({c})</span>
                        </label>
                      ))}
                    </div>
                    <div className="sbp-row" style={{ marginTop: 8 }}>
                      <button type="button" className="btn-secondary" onClick={() => setCopyTo(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={copyTo.size === 0}
                        onClick={() => {
                          replace(copyDefaults(setup, typeCode, trig.code, target, [...copyTo]), `Copy ${trig.code} → ${target} defaults to ${copyTo.size} sign types`);
                          setCopied(`Copied to ${copyTo.size} sign type${copyTo.size === 1 ? "" : "s"}. Check Setup flags any answer they don't offer.`);
                          setCopyTo(null);
                        }}
                      >
                        Copy to {copyTo.size}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DefaultsTable({ idx, typeCode, trigger, targetCode, answers }: { idx: SetupIndex; typeCode: string; trigger: Question; targetCode: string; answers: string[] }) {
  const replace = useSetupStore((s) => s.replace);
  const target = idx.question(typeCode, targetCode);
  if (!target) return null;
  const rules = idx.defaultRulesTo(typeCode, targetCode).filter((r) => r.triggerQuestion === trigger.code);
  const valueFor = (a: string) => rules.find((r) => r.triggerAnswer.toLowerCase() === a.toLowerCase())?.value ?? "";
  const targetAnswers = idx.options(typeCode, targetCode).map((o) => o.value);
  const set = (a: string, v: string) =>
    replace(setDefaultFor(idx.data, typeCode, trigger.code, a, targetCode, v), `Default ${targetCode} for ${trigger.code}=${a || "any"}`);

  return (
    <table className="sbp-table" style={{ maxWidth: 900 }}>
      <thead>
        <tr>
          <th>When {trigger.prompt} is</th>
          <th>{target.prompt} starts as</th>
        </tr>
      </thead>
      <tbody>
        {[...answers, ""].map((a) => {
          const v = valueFor(a);
          return (
            <tr key={a || "*"}>
              <td style={{ fontWeight: a ? 600 : 400 }}>{a || <span className="sbp-muted">any other answer</span>}</td>
              <td>
                {isList(target) ? (
                  <select className="sbp-input" value={v} onChange={(e) => set(a, e.target.value)}>
                    <option value="">{a ? `— its usual default (${target.defaultValue || "blank"}) —` : "— no default for other answers —"}</option>
                    {v && !targetAnswers.includes(v) && <option value={v}>{v} (not one of its answers)</option>}
                    {targetAnswers.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="sbp-input" defaultValue={v} placeholder={target.defaultValue || "blank"} onBlur={(e) => e.target.value !== v && set(a, e.target.value)} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
