import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OptionStyle } from "./field-options";

const MIN_W = 240;
const MAX_H = 320;

export function OptionPill({ value, style, onRemove }: { value: string; style: OptionStyle; onRemove?: () => void }) {
  return (
    <span className="opt-pill" style={{ background: style.bg, color: style.text }} title={value}>
      <span className="opt-pill__text">{value}</span>
      {onRemove && (
        <button
          type="button"
          className="opt-pill__x"
          aria-label={`Remove ${value}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

/**
 * An Airtable-style choice list: a "Find an option" search box and every
 * option as its coloured pill, in the column's order. Opens under `anchor`.
 * Single choice: picking one closes it. Multiple: picking toggles and stays
 * open (selected ones show a ✓). Arrow keys + Enter pick; Esc closes.
 */
export default function OptionPicker({
  anchor,
  options,
  selected,
  multi = false,
  styleOf,
  onPick,
  onClear,
  onClose,
}: {
  anchor: DOMRect;
  options: readonly string[];
  selected: readonly string[];
  multi?: boolean;
  styleOf: (value: string) => OptionStyle;
  onPick: (value: string) => void;
  /** Single choice: offer "Clear" when something is chosen. */
  onClear?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: anchor.bottom + 2, left: anchor.left, width: Math.max(anchor.width, MIN_W) });

  // Values in use that aren't on the list (e.g. carried over from Airtable) still show.
  const all = useMemo(() => [...selected.filter((v) => v && !options.includes(v)), ...options], [options, selected]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.toLowerCase().includes(q)) : all;
  }, [all, query]);
  useEffect(() => setActive(0), [query]);

  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const width = Math.max(anchor.width, MIN_W);
    const below = anchor.bottom + 2 + h <= window.innerHeight - 8;
    setPos({
      top: below ? anchor.bottom + 2 : Math.max(8, anchor.top - 2 - h),
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
      width,
    });
  }, [anchor, shown.length]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [onClose]);

  // Keep the highlighted option in view.
  useEffect(() => {
    ref.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = shown[active];
      if (v !== undefined) onPick(v);
    }
  };

  return createPortal(
    <div
      ref={ref}
      className="opt-picker"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        className="opt-picker__search"
        autoFocus
        placeholder="Find an option"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
      />
      <div className="opt-picker__list" style={{ maxHeight: MAX_H }} role="listbox" aria-multiselectable={multi}>
        {!multi && onClear && selected.some(Boolean) && !query && (
          <button type="button" className="opt-picker__clear" onClick={onClear}>
            Clear
          </button>
        )}
        {shown.length === 0 && <div className="opt-picker__none">No matching options</div>}
        {shown.map((o, i) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              data-i={i}
              role="option"
              aria-selected={on}
              className={`opt-picker__opt${i === active ? " opt-picker__opt--active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(o)}
            >
              <OptionPill value={o} style={styleOf(o)} />
              {on && <span className="opt-picker__check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
