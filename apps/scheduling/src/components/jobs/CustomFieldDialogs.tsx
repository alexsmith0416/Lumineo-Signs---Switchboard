import { useState } from "react";
import {
  compatibleTypes,
  contrastText,
  DEFAULT_WIDTH,
  describeFormula,
  FIELD_TYPES,
  formulaBaseOptions,
  OPTION_COLORS,
  optionColor,
  type CustomFieldDef,
  type CustomFieldType,
  type FormulaDateConfig,
  type FormulaUnit,
} from "../../services/custom-fields";
import { useCustomFieldStore } from "../../store/custom-field-store";

type Draft = Omit<CustomFieldDef, "key">;

const blank = (): Draft => ({ label: "", type: "text", width: DEFAULT_WIDTH.text });
const defaultFormula = (): FormulaDateConfig => ({ baseField: "releaseDate", offset: 0, unit: "weeks" });
const iconOf = (t: CustomFieldType) => FIELD_TYPES.find((f) => f.type === t)?.icon ?? "Aa";
const labelOf = (t: CustomFieldType) => FIELD_TYPES.find((f) => f.type === t)?.label ?? t;

/**
 * "Add Fields" — name a field, pick one of the 12 types, set its options or
 * formula; "+ Add another" stages it and starts the next. Done adds them all.
 * New fields are shared with everyone and added to the current view.
 */
export function AddFieldsDialog({ onAdded, onClose }: { onAdded: (keys: string[]) => void; onClose: () => void }) {
  const defs = useCustomFieldStore((s) => s.defs);
  const addFields = useCustomFieldStore((s) => s.addFields);
  const [staged, setStaged] = useState<Draft[]>([]);
  const [current, setCurrent] = useState<Draft>(blank);

  const ready = (d: Draft) =>
    !!d.label.trim() && (d.type !== "select" && d.type !== "multiselect" ? true : (d.opts ?? []).some((o) => o.trim()));
  const clean = (d: Draft): Draft => ({
    ...d,
    label: d.label.trim(),
    ...(d.opts ? { opts: [...new Set(d.opts.map((o) => o.trim()).filter(Boolean))] } : {}),
  });
  const stageCurrent = () => (ready(current) ? [...staged, clean(current)] : staged);

  const done = () => {
    const all = stageCurrent();
    if (all.length) onAdded(addFields(all));
    onClose();
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel cf-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Add fields</div>
        <div className="slide-over__body cf-dialog__body">
          {staged.length > 0 && (
            <div className="cf-dialog__staged">
              <div className="cf-dialog__label">Ready to add ({staged.length})</div>
              {staged.map((f, i) => (
                <div key={i} className="cf-dialog__staged-row">
                  <span className="cf-dialog__icon">{iconOf(f.type)}</span>
                  <span className="cf-dialog__staged-name">{f.label}</span>
                  <span className="cf-dialog__type">{labelOf(f.type)}</span>
                  <button type="button" className="lead-times__icon lead-times__icon--delete" aria-label="Remove"
                    onClick={() => setStaged(staged.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="cf-dialog__label">Field name</div>
          <input
            className="form-field__input"
            autoFocus
            placeholder="e.g. Permit Status"
            value={current.label}
            onChange={(e) => setCurrent({ ...current, label: e.target.value })}
          />

          <div className="cf-dialog__label">Field type</div>
          <div className="cf-dialog__types">
            {FIELD_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                className={`cf-dialog__type-btn${current.type === t.type ? " cf-dialog__type-btn--on" : ""}`}
                onClick={() =>
                  setCurrent({
                    ...current,
                    type: t.type,
                    width: DEFAULT_WIDTH[t.type],
                    // Keep the options when switching between the two select types.
                    opts: t.type === "select" || t.type === "multiselect" ? current.opts ?? [""] : undefined,
                    formula: t.type === "formula-date" ? current.formula ?? defaultFormula() : undefined,
                  })
                }
              >
                <span className="cf-dialog__type-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {(current.type === "select" || current.type === "multiselect") && (
            <OptionsEditor def={current} onChange={(p) => setCurrent({ ...current, ...p })} />
          )}
          {current.type === "formula-date" && (
            <FormulaEditor
              formula={current.formula ?? defaultFormula()}
              defs={defs}
              onChange={(formula) => setCurrent({ ...current, formula })}
            />
          )}
        </div>
        <div className="users-admin__footer" style={{ gap: 8 }}>
          <button
            className="btn-secondary"
            disabled={!ready(current)}
            onClick={() => {
              setStaged(stageCurrent());
              setCurrent(blank());
            }}
          >
            + Add another
          </button>
          <button className="btn-primary" disabled={!staged.length && !ready(current)} onClick={done}>
            Done ✓
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edit a custom field: name, type (within its group — Single ↔ Multi Select,
 * the text types, Number ↔ Currency; values are kept as they are), options +
 * colours, formula; or delete it.
 */
export function EditFieldDialog({ fieldKey, onClose }: { fieldKey: string; onClose: () => void }) {
  const defs = useCustomFieldStore((s) => s.defs);
  const updateField = useCustomFieldStore((s) => s.updateField);
  const deleteField = useCustomFieldStore((s) => s.deleteField);
  const def = defs.find((d) => d.key === fieldKey);
  const [draft, setDraft] = useState<Draft | null>(def ? { ...def } : null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!def || !draft) return null;

  const isSelect = draft.type === "select" || draft.type === "multiselect";
  const types = compatibleTypes(def.type);
  const save = () => {
    const opts = draft.opts ? [...new Set(draft.opts.map((o) => o.trim()).filter(Boolean))] : undefined;
    const optColors = opts && draft.optColors
      ? Object.fromEntries(Object.entries(draft.optColors).filter(([o]) => opts.includes(o)))
      : draft.optColors;
    updateField(def.key, { label: draft.label.trim() || def.label, type: draft.type, opts, optColors, formula: draft.formula });
    onClose();
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel cf-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          Edit field <span className="cf-dialog__type">{iconOf(draft.type)} {labelOf(draft.type)}</span>
        </div>
        <div className="slide-over__body cf-dialog__body">
          <div className="cf-dialog__label">Field name</div>
          <input className="form-field__input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          {types.length > 1 && (
            <>
              <div className="cf-dialog__label">Field type</div>
              <div className="cf-dialog__types">
                {types.map((t) => (
                  <button key={t} type="button" className={`cf-dialog__type-btn${draft.type === t ? " cf-dialog__type-btn--on" : ""}`}
                    onClick={() => setDraft({ ...draft, type: t })}>
                    <span className="cf-dialog__type-icon">{iconOf(t)}</span>
                    {labelOf(t)}
                  </button>
                ))}
              </div>
              {draft.type !== def.type && (
                <div className="cf-dialog__hint">
                  {draft.type === "select" && def.type === "multiselect"
                    ? "Each job picks one option. Jobs that already have several keep them until someone changes the cell."
                    : "Every job keeps its value; only how it's shown and edited changes."}
                </div>
              )}
            </>
          )}
          {isSelect && <OptionsEditor def={draft} colors onChange={(p) => setDraft({ ...draft, ...p })} />}
          {def.type === "formula-date" && (
            <FormulaEditor
              formula={draft.formula ?? defaultFormula()}
              defs={defs.filter((d) => d.key !== def.key)}
              onChange={(formula) => setDraft({ ...draft, formula })}
            />
          )}
          <div className="cf-dialog__danger">
            {confirmDelete ? (
              <>
                <span>Delete “{def.label}” for everyone? Its column disappears from every view.</span>
                <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Keep it</button>
                <button
                  className="btn-danger"
                  onClick={() => {
                    deleteField(def.key);
                    onClose();
                  }}
                >
                  Delete field
                </button>
              </>
            ) : (
              <button className="cf-dialog__delete" onClick={() => setConfirmDelete(true)}>
                Delete this field…
              </button>
            )}
          </div>
        </div>
        <div className="users-admin__footer" style={{ gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

/**
 * An option list: drag ⠿ to reorder (the order the dropdown shows and the
 * column sorts / groups in), rename, remove, add, and — when `colors` — pick
 * each option's colour.
 */
export function OptionsEditor({
  def,
  colors = false,
  onChange,
  colorOf,
}: {
  def: Pick<Draft, "opts" | "optColors">;
  /** Show a colour picker per option (editing an existing field). */
  colors?: boolean;
  onChange: (patch: Pick<Draft, "opts" | "optColors">) => void;
  /** An option's current colour (defaults to the field's own colours). */
  colorOf?: (opt: string) => string;
}) {
  const opts = def.opts ?? [];
  const [picking, setPicking] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const colour = colorOf ?? ((o: string) => optionColor(def, o));
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...opts];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    onChange({ opts: next, optColors: def.optColors });
  };
  const rename = (i: number, next: string) => {
    const old = opts[i]!;
    const optColors = { ...(def.optColors ?? {}) };
    // An option's colour follows it when it's renamed.
    if (old in optColors) {
      optColors[next] = optColors[old]!;
      delete optColors[old];
    }
    onChange({ opts: opts.map((o, j) => (j === i ? next : o)), optColors });
  };
  return (
    <>
      <div className="cf-dialog__label">Options</div>
      {opts.map((o, i) => (
        <div
          key={i}
          className={`cf-dialog__opt${dragFrom === i ? " cf-dialog__opt--dragging" : ""}${
            dragOver === i && dragFrom !== null && dragFrom !== i ? " cf-dialog__opt--over" : ""
          }`}
          onDragOver={(e) => {
            if (dragFrom === null) return;
            e.preventDefault();
            setDragOver(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFrom !== null) move(dragFrom, i);
            setDragFrom(null);
            setDragOver(null);
          }}
        >
          <span
            className="cf-dialog__grip"
            draggable
            title="Drag to reorder"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setDragFrom(i);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
          >
            ⠿
          </span>
          {colors && (
            <button
              type="button"
              className="cf-dialog__swatch"
              title="Colour"
              style={{ background: colour(o) }}
              onClick={() => setPicking(picking === i ? null : i)}
            />
          )}
          <input
            className="form-field__input"
            placeholder={`Option ${i + 1}`}
            value={o}
            onChange={(e) => rename(i, e.target.value)}
          />
          <button type="button" className="lead-times__icon lead-times__icon--delete" aria-label="Remove option"
            onClick={() => onChange({ opts: opts.filter((_, j) => j !== i), optColors: def.optColors })}>✕</button>
          {colors && picking === i && (
            <div className="cf-dialog__palette">
              {OPTION_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="cf-dialog__swatch"
                  style={{ background: c, color: contrastText(c) }}
                  aria-label={c}
                  onClick={() => {
                    onChange({ opts, optColors: { ...(def.optColors ?? {}), [o]: c } });
                    setPicking(null);
                  }}
                >
                  {colour(o) === c ? "✓" : ""}
                </button>
              ))}
              {/* Any colour: the browser's colour picker (applies as you choose). */}
              <label className="cf-dialog__custom-colour" title="Pick any colour">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(colour(o)) ? colour(o) : "#cccccc"}
                  onChange={(e) => onChange({ opts, optColors: { ...(def.optColors ?? {}), [o]: e.target.value } })}
                />
                Custom…
              </label>
              <span className="cf-dialog__preview" style={{ background: colour(o), color: contrastText(colour(o)) }}>
                {o || "Preview"}
              </span>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="jobs-panel__add" onClick={() => onChange({ opts: [...opts, ""], optColors: def.optColors })}>
        + Add option
      </button>
    </>
  );
}

function FormulaEditor({
  formula,
  defs,
  onChange,
}: {
  formula: FormulaDateConfig;
  defs: readonly CustomFieldDef[];
  onChange: (f: FormulaDateConfig) => void;
}) {
  return (
    <>
      <div className="cf-dialog__label">Starts from</div>
      <select className="form-field__input" value={formula.baseField} onChange={(e) => onChange({ ...formula, baseField: e.target.value })}>
        {formulaBaseOptions(defs).map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="cf-dialog__label">Plus / minus</div>
      <div className="cf-dialog__formula">
        <input
          className="form-field__input"
          type="number"
          min={-520}
          max={520}
          value={formula.offset}
          onChange={(e) => onChange({ ...formula, offset: Math.trunc(Number(e.target.value)) || 0 })}
        />
        <select className="form-field__input" value={formula.unit} onChange={(e) => onChange({ ...formula, unit: e.target.value as FormulaUnit })}>
          <option value="days">days</option>
          <option value="workdays">working days</option>
          <option value="weeks">weeks</option>
        </select>
      </div>
      <div className="cf-dialog__hint">{describeFormula(formula, defs)} &nbsp;(use a negative number for “before”)</div>
    </>
  );
}
