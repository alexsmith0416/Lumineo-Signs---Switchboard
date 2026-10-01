import { useEffect, useRef, useState } from "react";
import { normalizeValue, type CustomFieldDef } from "../../services/custom-fields";
import { customStyle, type OptionStyle } from "./field-options";
import OptionPicker, { OptionPill } from "./OptionPicker";

/**
 * Edits one custom field value — used in a Jobs grid cell (inline) and in the
 * job panel. Text-like fields save on Enter / leaving the box (Esc cancels);
 * dates, checkboxes and selects save as soon as they change. `onDone` is
 * called when the inline editor should close. Single / Multi Select use the
 * Airtable-style pill list (OptionPicker), coloured by `styleOf`.
 */
export default function CustomValueEditor({
  def,
  value,
  onSave,
  onDone,
  inline = false,
  styleOf,
}: {
  def: CustomFieldDef;
  value: unknown;
  onSave: (value: unknown) => void;
  onDone?: () => void;
  inline?: boolean;
  /** An option's colours (built-in columns pass theirs; custom fields default to their own). */
  styleOf?: (value: string) => OptionStyle;
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
    case "multiselect":
      return (
        <ChoiceEditor
          def={def}
          value={value}
          onSave={save}
          onDone={onDone}
          inline={inline}
          styleOf={styleOf ?? ((v) => customStyle(def, v))}
        />
      );
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

/**
 * Single / Multi Select: the chosen pills and a ▾; the pill list opens under it
 * (straight away when editing a grid cell). Single: picking saves and closes.
 * Multi: picking toggles; the list stays open until you click away.
 */
function ChoiceEditor({
  def,
  value,
  onSave,
  onDone,
  inline,
  styleOf,
}: {
  def: CustomFieldDef;
  value: unknown;
  onSave: (raw: unknown) => void;
  onDone?: () => void;
  inline: boolean;
  styleOf: (value: string) => OptionStyle;
}) {
  const multi = def.type === "multiselect";
  const chosen: string[] = multi
    ? Array.isArray(value)
      ? (value as unknown[]).filter((x): x is string => typeof x === "string" && !!x)
      : []
    : typeof value === "string" && value
      ? [value]
      : [];
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (inline && ref.current) setAnchor(ref.current.getBoundingClientRect());
  }, [inline]);
  const close = () => {
    setAnchor(null);
    onDone?.();
  };

  return (
    <>
      <div
        ref={ref}
        className={`opt-field${inline ? " opt-field--inline" : ""}${anchor ? " opt-field--open" : ""}`}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          if (anchor) close();
          else setAnchor(e.currentTarget.getBoundingClientRect());
        }}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setAnchor(e.currentTarget.getBoundingClientRect())}
      >
        <span className="opt-field__pills">
          {chosen.length ? (
            chosen.map((v) => (
              <OptionPill
                key={v}
                value={v}
                style={styleOf(v)}
                onRemove={multi ? () => onSave(chosen.filter((x) => x !== v)) : undefined}
              />
            ))
          ) : (
            <span className="opt-field__empty">Choose…</span>
          )}
        </span>
        <span className="opt-field__chev">▾</span>
      </div>
      {anchor && (
        <OptionPicker
          anchor={anchor}
          options={def.opts ?? []}
          selected={chosen}
          multi={multi}
          styleOf={styleOf}
          onPick={(v) => {
            if (multi) onSave(chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v]);
            else {
              onSave(v);
              close();
            }
          }}
          onClear={() => {
            onSave("");
            close();
          }}
          onClose={close}
        />
      )}
    </>
  );
}
