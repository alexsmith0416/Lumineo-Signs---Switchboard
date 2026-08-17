import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../store/settings-store";
import {
  BUILT_IN_CHECK_COLUMNS,
  MAX_CHECK_COLUMNS,
  MAX_CHECK_LABEL,
  normalizeCheckLabel,
} from "../shipping/print-columns";

/**
 * Multi-select for the tick-box columns on a load's printed shipping list —
 * pick any of the saved column names, or type a new one to add it to the list.
 * Choices persist per device (settings-store) and apply to every printed load.
 * Screen-only: hidden by `@media print` so it never lands on paper.
 */
export default function PrintColumnsPicker() {
  const options = useSettingsStore((s) => s.printCheckOptions);
  const selected = useSettingsStore((s) => s.printCheckColumns);
  const toggle = useSettingsStore((s) => s.togglePrintCheckColumn);
  const addOption = useSettingsStore((s) => s.addPrintCheckOption);
  const removeOption = useSettingsStore((s) => s.removePrintCheckOption);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on an outside click / Escape, like the other popovers in the app.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const atCap = selected.length >= MAX_CHECK_COLUMNS;
  const label = normalizeCheckLabel(draft);
  const duplicate = label !== "" && options.some((o) => o.toLowerCase() === label.toLowerCase());

  const commitNew = () => {
    if (!label || duplicate) return;
    addOption(draft);
    setDraft("");
  };

  const summary =
    selected.length === 0
      ? "No tick boxes"
      : selected.length <= 2
        ? selected.join(" · ")
        : `${selected.length} tick boxes`;

  return (
    <div className="print-cols" ref={wrapRef}>
      <span className="print-cols__label">Tick boxes:</span>
      <button
        type="button"
        className="print-cols__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {summary} <span aria-hidden>▾</span>
      </button>

      {open && (
        <div className="print-cols__menu">
          <div className="print-cols__menu-head">Columns on the printed sheet</div>

          {options.map((opt) => {
            const on = selected.some((s) => s.toLowerCase() === opt.toLowerCase());
            const builtIn = BUILT_IN_CHECK_COLUMNS.some((b) => b.toLowerCase() === opt.toLowerCase());
            return (
              <div key={opt} className="print-cols__row">
                <label className={`print-cols__opt${!on && atCap ? " print-cols__opt--disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && atCap}
                    onChange={() => toggle(opt)}
                  />
                  <span>{opt}</span>
                </label>
                {!builtIn && (
                  <button
                    type="button"
                    className="print-cols__del"
                    title={`Delete "${opt}" from the list`}
                    aria-label={`Delete ${opt} from the list`}
                    onClick={() => removeOption(opt)}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {atCap && (
            <div className="print-cols__note">
              {MAX_CHECK_COLUMNS} columns is the max — untick one to add another.
            </div>
          )}

          <div className="print-cols__add">
            <input
              type="text"
              className="form-field__input"
              value={draft}
              maxLength={MAX_CHECK_LABEL}
              placeholder="New tick box (e.g. Strapped)…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitNew();
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={!label || duplicate}
              title={duplicate ? `"${label}" is already in the list` : "Add to the list"}
              onClick={commitNew}
            >
              Add
            </button>
          </div>
          {duplicate && <div className="print-cols__note">"{label}" is already in the list.</div>}
        </div>
      )}
    </div>
  );
}
