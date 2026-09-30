import { useEffect, useRef, useState } from "react";
import { contrastText, normalizeValue, optionColor, type CustomFieldDef } from "../../services/custom-fields";

/**
 * Edits one custom field value — used in a Jobs grid cell (inline) and in the
 * job panel. Text-like fields save on Enter / leaving the box (Esc cancels);
 * dates, checkboxes and selects save as soon as they change. `onDone` is
 * called when the inline editor should close.
 */
export default function CustomValueEditor({
  def,
  value,
  onSave,
  onDone,
  inline = false,
}: {
  def: CustomFieldDef;
  value: unknown;
  onSave: (value: unknown) => void;
  onDone?: () => void;
  inline?: boolean;
}) {
  const save = (raw: unknown) => {
    const next = normalizeValue(def, raw);
    if (JSON.stringify(next ?? null) !== JSON.stringify(normalizeValue(def, value) ?? null)) onSave(next);
  };

  switch (def.type) {
    case "bool":
      return (
        <input
          type="checkbox"
          className="cf-edit__check"
          checked={value === true}
          autoFocus={inline}
          onChange={(e) => {
            save(e.target.checked);
            onDone?.();
          }}
        />
      );
    case "date":
      return (
        <input
          type="date"
          className="form-field__input cf-edit__input"
          autoFocus={inline}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => save(e.target.value)}
          onBlur={() => onDone?.()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && onDone?.()}
        />
      );
    case "select":
      return (
        <select
          className="form-field__input cf-edit__input"
          autoFocus={inline}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => {
            save(e.target.value);
            onDone?.();
          }}
          onBlur={() => onDone?.()}
          onKeyDown={(e) => e.key === "Escape" && onDone?.()}
        >
          <option value="">—</option>
          {/* Keep a value that isn't one of the options (e.g. carried over from Airtable). */}
          {[...(typeof value === "string" && value && !(def.opts ?? []).includes(value) ? [value] : []), ...(def.opts ?? [])].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "multiselect":
      return <MultiSelectEditor def={def} value={value} onSave={save} onDone={onDone} inline={inline} />;
    case "formula-date":
      return <span className="jobs-jobpanel__muted">Calculated</span>;
    default:
      return <TextEditor def={def} value={value} onSave={save} onDone={onDone} inline={inline} />;
  }
}

function TextEditor({
  def,
  value,
  onSave,
  onDone,
  inline,
}: {
  def: CustomFieldDef;
  value: unknown;
  onSave: (raw: unknown) => void;
  onDone?: () => void;
  inline: boolean;
}) {
  const initial = value == null ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const cancelled = useRef(false);
  useEffect(() => setDraft(initial), [initial]);

  const commit = () => {
    if (!cancelled.current) onSave(draft);
    cancelled.current = false;
    onDone?.();
  };
  const common = {
    className: `form-field__input cf-edit__input${def.type === "multiline" ? " cf-edit__area" : ""}`,
    autoFocus: inline,
    value: draft,
    onBlur: commit,
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      cancelled.current = true;
      setDraft(initial);
      (e.target as HTMLElement).blur();
    }
    // Enter saves; in Long text, Enter is a new line and Ctrl+Enter saves.
    if (e.key === "Enter" && (def.type !== "multiline" || e.ctrlKey)) (e.target as HTMLElement).blur();
  };

  if (def.type === "multiline") {
    return <textarea {...common} rows={inline ? 4 : 3} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />;
  }
  const inputType =
    def.type === "number" || def.type === "currency"
      ? "number"
      : def.type === "email"
        ? "email"
        : def.type === "phone"
          ? "tel"
          : def.type === "url"
            ? "url"
            : "text";
  return (
    <input
      {...common}
      type={inputType}
      step={def.type === "currency" ? "0.01" : "any"}
      placeholder={def.type === "url" ? "https://…" : def.type === "email" ? "name@company.com" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

function MultiSelectEditor({
  def,
  value,
  onSave,
  onDone,
  inline,
}: {
  def: CustomFieldDef;
  value: unknown;
  onSave: (raw: unknown) => void;
  onDone?: () => void;
  inline: boolean;
}) {
  const chosen = Array.isArray(value) ? (value as string[]) : [];
  const ref = useRef<HTMLDivElement>(null);
  // Inline: close when the user clicks anywhere else.
  useEffect(() => {
    if (!inline) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDone?.();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [inline, onDone]);

  return (
    <div ref={ref} className={`cf-edit__multi${inline ? " cf-edit__multi--pop" : ""}`}>
      {(def.opts ?? []).length === 0 && <span className="jobs-jobpanel__muted">No options — edit the field to add some.</span>}
      {(def.opts ?? []).map((o) => {
        const on = chosen.includes(o);
        const bg = optionColor(def, o);
        return (
          <button
            key={o}
            type="button"
            className={`cf-edit__opt${on ? " cf-edit__opt--on" : ""}`}
            style={on ? { background: bg, color: contrastText(bg), borderColor: bg } : undefined}
            aria-pressed={on}
            onClick={() => onSave(on ? chosen.filter((x) => x !== o) : [...chosen, o])}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
