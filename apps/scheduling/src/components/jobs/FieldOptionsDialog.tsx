import { useState } from "react";
import { OptionsEditor } from "./CustomFieldDialogs";
import { builtinIsMulti, builtinOptions, canToggleMulti, defaultBg } from "./field-options";
import { BUILTIN_EDITS } from "./jobs-editable";
import { JOB_FIELDS } from "./jobs-fields";
import { useFieldOptionsStore } from "../../store/field-options-store";

/**
 * "Edit field" for a built-in column. Any column: its NAME (shown everywhere in
 * the app; reset brings back the default). Choice columns (Current Status,
 * Priority, Hold, Vendor, …) also: drag the options into the order you want —
 * the dropdown shows them in that order and the column sorts and groups by it —
 * add new ones, rename or remove them, pick colours, and (plain tracking
 * choices) switch between Single and Multi Select. Saved for everyone.
 * `seed` = values in use, for columns with no fixed list (Sales, Region…).
 */
export default function FieldOptionsDialog({
  field,
  label,
  seed,
  onClose,
}: {
  field: string;
  label: string;
  seed: string[];
  onClose: () => void;
}) {
  const override = useFieldOptionsStore((s) => s.overrides[field]);
  const save = useFieldOptionsStore((s) => s.save);
  const defaultLabel = JOB_FIELDS[field]?.label ?? field;
  const isChoice = JOB_FIELDS[field]?.type === "badge" || !!BUILTIN_EDITS[field]?.field.opts;
  const toggle = canToggleMulti(field);
  const defaultMulti = BUILTIN_EDITS[field]?.field.type === "multiselect";
  const [name, setName] = useState(label);
  const [multi, setMulti] = useState(() => builtinIsMulti(field, override));
  const [draft, setDraft] = useState<{ opts?: string[]; optColors?: Record<string, string> }>(() => {
    const opts = builtinOptions(field, override);
    const list = opts.length ? opts : seed;
    return {
      opts: list,
      // Every option's current colour, so the swatches show what the badges look like.
      optColors: Object.fromEntries(list.map((o) => [o, override?.colors?.[o] ?? defaultBg(field, o)])),
    };
  });

  const done = () => {
    const trimmed = name.trim();
    const next = {
      ...(override ?? {}),
      // Stored only when it differs from the default, so "reset" really resets.
      label: trimmed && trimmed !== defaultLabel ? trimmed : undefined,
      multi: toggle && multi !== defaultMulti ? multi : undefined,
    };
    if (isChoice) {
      next.opts = [...new Set((draft.opts ?? []).map((o) => o.trim()).filter(Boolean))];
      // Only keep colours that differ from the defaults.
      next.colors = Object.fromEntries(
        Object.entries(draft.optColors ?? {}).filter(([o, c]) => next.opts!.includes(o) && c !== defaultBg(field, o)),
      );
    }
    save(field, next);
    onClose();
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel cf-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Edit field · {label}</div>
        <div className="slide-over__body cf-dialog__body">
          <div className="cf-dialog__label">Field name</div>
          <div className="cf-dialog__name-row">
            <input className="form-field__input" autoFocus value={name} placeholder={defaultLabel}
              onChange={(e) => setName(e.target.value)} />
            {name.trim() !== defaultLabel && (
              <button type="button" className="btn-secondary" title={`Back to “${defaultLabel}”`} onClick={() => setName(defaultLabel)}>
                Reset
              </button>
            )}
          </div>
          <div className="cf-dialog__hint">
            Renames the column in every view, the filters and the job panel, for everyone. The job data doesn't change.
          </div>

          {toggle && (
            <>
              <div className="cf-dialog__label">Field type</div>
              <div className="cf-dialog__types">
                {([false, true] as const).map((m) => (
                  <button key={String(m)} type="button" className={`cf-dialog__type-btn${multi === m ? " cf-dialog__type-btn--on" : ""}`}
                    onClick={() => setMulti(m)}>
                    <span className="cf-dialog__type-icon">{m ? "▼▼" : "▼"}</span>
                    {m ? "Multi Select" : "Single Select"}
                  </button>
                ))}
              </div>
              {multi !== builtinIsMulti(field, override) && (
                <div className="cf-dialog__hint">
                  {multi
                    ? "Each job can now pick several options. Existing values are kept."
                    : "Each job picks one option. Jobs that already have several keep them until someone changes the cell."}
                </div>
              )}
            </>
          )}

          {isChoice && (
            <>
              <p className="billing-periods-panel__note">
                Drag <strong>⠿</strong> to reorder — the dropdown lists the options in this order, and sorting or grouping by{" "}
                {name.trim() || defaultLabel} follows it. Add new options at the bottom. Renaming or removing an option doesn't
                change jobs that already use it. Saved for everyone.
              </p>
              <OptionsEditor def={draft} colors onChange={(p) => setDraft({ ...draft, ...p })} colorOf={(o) => draft.optColors?.[o] ?? defaultBg(field, o)} />
            </>
          )}
        </div>
        <div className="users-admin__footer" style={{ gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={done}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
