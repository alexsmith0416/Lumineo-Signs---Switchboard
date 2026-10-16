import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./ui";

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a line above the item. */
  divider?: boolean;
}

/** A right-click menu at the mouse. Closes on a click elsewhere, Esc, scroll or resize. */
export function ContextMenu({ x, y, title, items, onClose }: { x: number; y: number; title?: string; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  // Keep it on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: Math.max(4, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(4, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", away, true);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", away, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="sbp-menu" style={pos} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {title && <div className="sbp-menu__title">{title}</div>}
      {items.map((it, i) => (
        <div key={i}>
          {it.divider && <div className="sbp-menu__divider" />}
          <button
            type="button"
            role="menuitem"
            className={`sbp-menu__item${it.danger ? " sbp-menu__item--danger" : ""}`}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            {it.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** Asks for one line of text (Enter = OK). */
export function PromptDialog({
  title,
  label,
  initial = "",
  placeholder,
  help,
  okLabel = "Save",
  validate,
  onOk,
  onCancel,
}: {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  help?: string;
  okLabel?: string;
  /** Returns an error message, or "" when the text is fine. */
  validate?: (v: string) => string;
  onOk: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState("");
  const ok = () => {
    const err = validate?.(v) ?? "";
    if (err) return setError(err);
    onOk(v);
  };
  return (
    <Modal
      title={title}
      onClose={onCancel}
      actions={
        <button type="button" className="btn-primary" onClick={ok}>
          {okLabel}
        </button>
      }
    >
      <div className="sbp-field">
        <label>{label}</label>
        <input
          className="sbp-input"
          autoFocus
          value={v}
          placeholder={placeholder}
          onChange={(e) => {
            setV(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && ok()}
        />
      </div>
      {help && <div className="sbp-muted" style={{ fontSize: 12, marginTop: 6 }}>{help}</div>}
      {error && <div className="sbp-banner sbp-banner--error" style={{ marginTop: 8 }}>{error}</div>}
    </Modal>
  );
}
