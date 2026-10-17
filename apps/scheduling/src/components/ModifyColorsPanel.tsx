import { useEffect, useMemo, useState } from "react";
import type { Department } from "../engine/types";
import { useBoardColorsStore } from "../store/board-colors-store";
import { defaultScheme, schemeFor, textFor, type ColorScheme, type ColorScope } from "../services/board-colors";

/**
 * "Modify colors…" (banner right-click, Admin / Ops): a right-side panel that
 * opens on the department / location you right-clicked and lets you switch to
 * any other one on the board. Card background + text and banner background +
 * text, with a live preview; Save applies it for everyone. Saved schemes are
 * named colour sets you can apply to any department / location later.
 */
export default function ModifyColorsPanel({
  scope,
  departments,
  initialId,
  onClose,
}: {
  scope: ColorScope;
  /** The board's departments / locations (raw names; colours come from the store). */
  departments: Department[];
  initialId: string;
  onClose: () => void;
}) {
  const colors = useBoardColorsStore((s) => s.colors);
  const setScheme = useBoardColorsStore((s) => s.setScheme);
  const saveNamed = useBoardColorsStore((s) => s.saveNamed);
  const deleteNamed = useBoardColorsStore((s) => s.deleteNamed);
  const [id, setId] = useState(initialId);
  const dept = departments.find((d) => d.id === id) ?? departments[0];
  const saved = dept ? schemeFor(colors, scope, dept) : null;
  const [draft, setDraft] = useState<ColorScheme | null>(saved);
  const [schemeName, setSchemeName] = useState("");
  // Switching department / location loads its colours into the editor.
  useEffect(() => {
    setDraft(dept ? schemeFor(colors, scope, dept) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dirty = useMemo(() => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  if (!dept || !draft) return null;
  const noun = scope === "installation" ? "location" : "department";
  const isCustom = !!colors[scope][dept.id];

  const set = (k: keyof ColorScheme, v: string) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [k]: v };
      // Picking a background suggests a readable text colour to go with it.
      if (k === "bg") next.text = textFor(v);
      if (k === "header") next.headerText = textFor(v);
      return next;
    });

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel modify-colors" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Modify colors</div>
        <div className="slide-over__body modify-colors__body">
          <div className="modify-colors__list" role="tablist" aria-label={`Choose a ${noun}`}>
            {departments.map((d) => {
              const s = schemeFor(colors, scope, d);
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={d.id === dept.id}
                  className={`modify-colors__chip${d.id === dept.id ? " modify-colors__chip--on" : ""}`}
                  style={{ background: s.header, color: s.headerText }}
                  onClick={() => setId(d.id)}
                >
                  {d.name}
                </button>
              );
            })}
          </div>

          <div className="modify-colors__preview">
            <div className="modify-colors__banner" style={{ background: draft.header, color: draft.headerText }}>
              {dept.name}
            </div>
            <div className="modify-colors__card" style={{ background: draft.bg, color: draft.text }}>
              <strong>J39203</strong> Sample Customer
              <div style={{ fontSize: 11, opacity: 0.85 }}>Install channel letters</div>
            </div>
          </div>

          <div className="modify-colors__grid">
            <ColorField label="Card background" value={draft.bg} onChange={(v) => set("bg", v)} />
            <ColorField label="Card text" value={draft.text} onChange={(v) => set("text", v)} />
            <ColorField label="Banner background" value={draft.header} onChange={(v) => set("header", v)} />
            <ColorField label="Banner text" value={draft.headerText} onChange={(v) => set("headerText", v)} />
          </div>

          <div className="modify-colors__actions">
            <button type="button" className="btn-primary" disabled={!dirty} onClick={() => setScheme(scope, dept.id, draft)}>
              Save {dept.name}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!isCustom && !dirty}
              title="Back to the standard colours"
              onClick={() => {
                setScheme(scope, dept.id, null);
                setDraft(defaultScheme(dept));
              }}
            >
              Reset to default
            </button>
          </div>
          <p className="billing-periods-panel__note">Saved colours apply for everyone, on every week.</p>

          <div className="section-title" style={{ marginTop: 12 }}>Saved color schemes</div>
          {colors.schemes.length === 0 && (
            <p className="billing-periods-panel__note">None yet — name the colours above to keep them for later.</p>
          )}
          <ul className="modify-colors__schemes">
            {colors.schemes.map((s) => (
              <li key={s.name}>
                <span className="modify-colors__swatch" style={{ background: s.bg, color: s.text }}>
                  Aa
                </span>
                <span className="modify-colors__swatch" style={{ background: s.header, color: s.headerText }}>
                  Aa
                </span>
                <span className="modify-colors__scheme-name">{s.name}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setDraft({ bg: s.bg, text: s.text, header: s.header, headerText: s.headerText })}
                  title={`Load "${s.name}" into the editor — then Save`}
                >
                  Use
                </button>
                <button type="button" className="btn-secondary" onClick={() => deleteNamed(s.name)} title="Delete this scheme">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="modify-colors__save-as">
            <input
              className="form-field__input"
              placeholder="Name these colours (e.g. Olathe orange)"
              value={schemeName}
              onChange={(e) => setSchemeName(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={!schemeName.trim()}
              onClick={() => {
                saveNamed({ name: schemeName, ...draft });
                setSchemeName("");
              }}
            >
              Save as scheme
            </button>
          </div>
        </div>
        <div className="slide-over__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="modify-colors__field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}
