import { useEffect, useMemo, useState } from "react";
import { useCustomFieldStore } from "../store/custom-field-store";
import { useFieldOptionsStore } from "../store/field-options-store";
import { grantableFields, type GrantableField } from "./jobs/jobs-grantable-fields";

/**
 * Pick exactly which Jobs-list fields one login may edit (Settings → Users →
 * Manage users → "Jobs edits"). Anything not ticked stays read-only for them,
 * and they never get the list's structure (views, Fields, field options).
 */
export default function JobEditFieldsDialog({
  email,
  initial,
  canSeeMoney,
  onSave,
  onClose,
}: {
  email: string;
  initial: readonly string[];
  /** The login's role can see $ — otherwise Currency fields are hidden from it. */
  canSeeMoney: boolean;
  onSave: (keys: string[]) => void;
  onClose: () => void;
}) {
  const defs = useCustomFieldStore((s) => s.defs);
  const loadDefs = useCustomFieldStore((s) => s.load);
  const defsLoaded = useCustomFieldStore((s) => s.loaded);
  // Built-in columns renamed with "Edit field…" show under their new names.
  const overrides = useFieldOptionsStore((s) => s.overrides);
  const loadOverrides = useFieldOptionsStore((s) => s.load);
  useEffect(() => {
    void loadDefs();
    void loadOverrides();
  }, [loadDefs, loadOverrides]);

  const fields = useMemo(() => {
    const renamed = Object.fromEntries(Object.entries(overrides).flatMap(([k, o]) => (o.label ? [[k, o.label]] : [])));
    return grantableFields(defs, renamed).filter((f) => !f.money || canSeeMoney);
  }, [defs, overrides, canSeeMoney]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial));
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = q ? fields.filter((f) => f.label.toLowerCase().includes(q)) : fields;
  const groups = (["Job", "Columns", "Custom fields"] as const)
    .map((g) => [g, shown.filter((f) => f.group === g)] as [string, GrantableField[]])
    .filter(([, list]) => list.length);
  // A grant for a field that no longer exists (deleted custom field) is kept
  // until saved, but not shown or counted.
  const known = new Set(fields.map((f) => f.key));
  const count = [...picked].filter((k) => known.has(k)).length;

  const toggle = (key: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card jobedit-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__title">Jobs edits · {email}</div>
        <div className="modal-card__body">
          Tick the Jobs-list fields this person may change. Everything else stays view only, and they can&apos;t
          change views, columns or field options.
        </div>
        <div className="jobedit-dialog__tools">
          <input
            className="form-field__input"
            type="search"
            placeholder="Search fields…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={() => setPicked(new Set())} disabled={!count}>
            Clear
          </button>
        </div>
        <div className="jobedit-dialog__list">
          {groups.map(([group, list]) => (
            <div key={group} className="jobedit-dialog__group">
              <div className="jobedit-dialog__group-label">{group}</div>
              {list.map((f) => (
                <label key={f.key} className="jobedit-dialog__item">
                  <input type="checkbox" checked={picked.has(f.key)} onChange={() => toggle(f.key)} />
                  <span>
                    {f.label}
                    {f.hint && <span className="jobedit-dialog__hint">{f.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          ))}
          {!groups.length && <div className="jobedit-dialog__hint">No field matches “{search}”.</div>}
        </div>
        <div className="modal-card__actions">
          <span className="jobedit-dialog__count">{count ? `${count} field${count === 1 ? "" : "s"}` : "View only"}</span>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              // Drop grants for deleted fields — but only once the custom fields
              // have loaded, so a slow load can't wipe someone's custom grants.
              onSave(defsLoaded ? [...picked].filter((k) => known.has(k)) : [...picked]);
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
