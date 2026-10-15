import { useEffect, useMemo, useState } from "react";
import type { SignType } from "../../domain/types";
import { SetupIndex } from "../../engine/setup-index";
import { checkSetup, parseSelectedWhen } from "../../setup/check-setup";
import { duplicateSignType, signTypeCodeError, updateSignType } from "../../setup/sign-type-ops";
import { useSetupStore } from "../../store/setup-store";

type Draft = Omit<SignType, "code" | "isBlock">;

const toDraft = ({ code: _c, isBlock: _b, ...rest }: SignType): Draft => rest;

/** "QUESTION=answer|answer; …" ⇄ a map of question → chosen answers. */
function selectedMap(text: string): Map<string, string[]> {
  return new Map(parseSelectedWhen(text).filter((p) => p.code).map((p) => [p.code, p.values.split("|").map((v) => v.trim()).filter(Boolean)]));
}
function selectedText(order: string[], map: Map<string, string[]>): string {
  const codes = [...order.filter((c) => map.has(c)), ...[...map.keys()].filter((c) => !order.includes(c))];
  return codes
    .filter((c) => (map.get(c) ?? []).length > 0)
    .map((c) => `${c}=${map.get(c)!.join("|")}`)
    .join("; ");
}

/** Setup → Sign Types: each category's sign types, what picks them (Selected
 *  When), their Spec Code and printed names; Duplicate copies a type with all
 *  its questions, rules and templates. */
export default function SignTypes({ initialCode }: { initialCode?: string }) {
  const setup = useSetupStore((s) => s.setup);
  const replace = useSetupStore((s) => s.replace);
  const idx = useMemo(() => (setup ? new SetupIndex(setup) : null), [setup]);

  const categories = useMemo(() => [...(setup?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [setup]);
  const [categoryCode, setCategoryCode] = useState(() => setup?.signTypes.find((t) => t.code === initialCode)?.categoryCode ?? categories[0]?.code ?? "");
  const [code, setCode] = useState(initialCode ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dup, setDup] = useState<{ code: string; description: string; error: string } | null>(null);
  const [saved, setSaved] = useState("");

  const types = useMemo(
    () => (setup?.signTypes ?? []).filter((t) => t.categoryCode === categoryCode && !t.isBlock).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
    [setup, categoryCode],
  );
  const current = setup?.signTypes.find((t) => t.code === code);

  useEffect(() => {
    if (!code && types[0]) setCode(types[0].code);
  }, [code, types]);
  // A fresh form when another sign type is picked (not on every save).
  useEffect(() => {
    setDraft(current ? toDraft(current) : null);
    setDup(null);
    setSaved("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, !!current]);

  // The questions that pick the type: the category's first active type's (all
  // types of a category share them) — or this type's own if it's alone.
  const pickers = useMemo(() => {
    if (!idx || !current) return [];
    const first = idx.typesOfCategory(categoryCode)[0] ?? current;
    return idx.questions(first.code).filter((q) => q.picksSignType).map((q) => ({ q, answers: idx.realOptions(first.code, q.code).map((o) => o.value), from: first.code }));
  }, [idx, current, categoryCode]);

  const dirty = !!(current && draft && JSON.stringify(toDraft(current)) !== JSON.stringify(draft));

  // Check Setup on the draft, so a clash shows before saving.
  const issues = useMemo(() => {
    if (!setup || !current || !draft) return [];
    const preview = updateSignType(setup, current.code, draft);
    return checkSetup(preview, { categoryCode: draft.categoryCode }).filter((i) => i.signTypeCode === current.code);
  }, [setup, current, draft]);

  if (!setup || !idx) return <div className="sbp-muted">Loading…</div>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const map = selectedMap(draft?.selectedWhen ?? "");
  const toggle = (qCode: string, answer: string) => {
    const next = new Map(map);
    const list = next.get(qCode) ?? [];
    next.set(qCode, list.includes(answer) ? list.filter((a) => a !== answer) : [...list, answer]);
    set("selectedWhen", selectedText(pickers.map((p) => p.q.code), next));
  };

  const save = () => {
    if (!current || !draft) return;
    replace(updateSignType(setup, current.code, draft), `Save sign type ${current.code}`);
    if (draft.categoryCode !== categoryCode) setCategoryCode(draft.categoryCode);
    setSaved("Saved.");
  };

  const runDuplicate = () => {
    if (!current || !dup) return;
    const error = signTypeCodeError(setup, dup.code);
    if (error) return setDup({ ...dup, error });
    const next = duplicateSignType(setup, current.code, dup.code, dup.description);
    replace(next, `Duplicate ${current.code} → ${dup.code.trim().toUpperCase()}`);
    setCode(dup.code.trim().toUpperCase());
  };

  const questionCount = (t: SignType) => idx.questions(t.code).length;

  return (
    <div className="sbp-setup-split">
      <div className="sbp-card">
        <div className="sbp-field">
          <label>Category</label>
          <select
            className="sbp-input"
            value={categoryCode}
            onChange={(e) => {
              setCategoryCode(e.target.value);
              setCode("");
            }}
          >
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.description}
                {c.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
        <div className="sbp-caption" style={{ marginTop: 12 }}>
          Sign types
        </div>
        {types.length === 0 && <div className="sbp-muted">No sign types in this category.</div>}
        {types.map((t) => (
          <div key={t.code} className={`sbp-list-item${t.code === code ? " sbp-list-item--on" : ""}`} onClick={() => setCode(t.code)} data-tour="signtype-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{t.description}</div>
              <div className="sbp-muted" style={{ fontSize: 11 }}>
                {t.code} · {questionCount(t)} questions
              </div>
            </div>
            {!t.active && <span className="sbp-pill">inactive</span>}
          </div>
        ))}
      </div>

      {current && draft && (
        <div className="sbp-card">
          <div className="sbp-row" style={{ marginBottom: 10 }}>
            <div>
              <div className="sbp-caption">Sign type</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {current.code} <span className="sbp-code">{[idx.category(draft.categoryCode)?.codePrefix, draft.specCode].filter(Boolean).join("-")}</span>
              </div>
            </div>
            <div className="sbp-spacer" />
            <button type="button" className="btn-secondary" onClick={() => setDup({ code: `${current.code}-2`, description: `${current.description} (copy)`, error: "" })}>
              Duplicate
            </button>
            <button type="button" className="btn-secondary" disabled={!dirty} onClick={() => setDraft(toDraft(current))}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={!dirty} onClick={save}>
              Save
            </button>
          </div>
          {saved && !dirty && <div className="sbp-banner sbp-banner--ok">{saved}</div>}

          {dup && (
            <div className="sbp-banner">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Duplicate {current.code}</div>
              <div className="sbp-grid-fields">
                <div className="sbp-field">
                  <label>New code</label>
                  <input className="sbp-input" value={dup.code} maxLength={20} onChange={(e) => setDup({ ...dup, code: e.target.value.toUpperCase(), error: "" })} />
                </div>
                <div className="sbp-field">
                  <label>Description</label>
                  <input className="sbp-input" value={dup.description} onChange={(e) => setDup({ ...dup, description: e.target.value })} />
                </div>
              </div>
              <p className="sbp-muted" style={{ fontSize: 12, margin: "6px 0" }}>
                Copies all {questionCount(current)} questions with their answers, Spec Rules, Field Description lines and reference rules. The copy starts <b>inactive</b> with
                no Selected When — set those, then Save.
              </p>
              {dup.error && <div className="sbp-banner sbp-banner--error">{dup.error}</div>}
              <div className="sbp-row">
                <button type="button" className="btn-secondary" onClick={() => setDup(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={runDuplicate}>
                  Duplicate
                </button>
              </div>
            </div>
          )}

          <div className="sbp-grid-fields">
            <div className="sbp-field">
              <label>Description</label>
              <input className="sbp-input" value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="sbp-field">
              <label>Name in the descriptions ({"{TYPE}"})</label>
              <input className="sbp-input" value={draft.outputName} onChange={(e) => set("outputName", e.target.value)} />
            </div>
            <div className="sbp-field">
              <label>Variant name</label>
              <input className="sbp-input" value={draft.variantName} onChange={(e) => set("variantName", e.target.value)} />
            </div>
            <div className="sbp-field">
              <label>Spec Code segment</label>
              <input className="sbp-input" value={draft.specCode} maxLength={10} onChange={(e) => set("specCode", e.target.value.toUpperCase())} />
            </div>
            <div className="sbp-field">
              <label>Category</label>
              <select className="sbp-input" value={draft.categoryCode} onChange={(e) => set("categoryCode", e.target.value)}>
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="sbp-field">
              <label>Sort order</label>
              <input className="sbp-input" type="number" value={draft.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
            </div>
          </div>
          <label className="sbp-check" style={{ margin: "8px 0 14px" }}>
            <input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /> Active — offered when someone specs a sign
          </label>

          <div className="sbp-caption" data-tour="selected-when">
            Selected when
          </div>
          <p className="sbp-muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>
            The answers to the category's first questions that pick this sign type. Pick one or more answers per question (more than one = any of them).
          </p>
          {pickers.length === 0 && <div className="sbp-muted">This category has no type-picking questions.</div>}
          {pickers.map(({ q, answers }) => (
            <div key={q.code} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                {q.prompt} <span className="sbp-muted">({q.code})</span>
              </div>
              <div className="sbp-choices">
                {answers.map((a) => (
                  <button key={a} type="button" className={`sbp-choice${(map.get(q.code) ?? []).includes(a) ? " sbp-choice--on" : ""}`} onClick={() => toggle(q.code, a)}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="sbp-field" style={{ marginTop: 6 }}>
            <label>As text</label>
            <input className="sbp-input" value={draft.selectedWhen} placeholder="e.g. LIT=Yes; WORK=New cabinet" onChange={(e) => set("selectedWhen", e.target.value)} />
          </div>

          <div className="sbp-caption" style={{ marginTop: 14 }}>
            Check
          </div>
          {issues.length === 0 ? (
            <div className="sbp-banner sbp-banner--ok">No problems found for this sign type.</div>
          ) : (
            issues.map((i, n) => (
              <div key={n} className={`sbp-banner ${i.severity === "error" ? "sbp-banner--error" : "sbp-banner--warn"}`}>
                <div>{i.text}</div>
                <div className="sbp-muted" style={{ fontSize: 12 }}>→ {i.fix}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
