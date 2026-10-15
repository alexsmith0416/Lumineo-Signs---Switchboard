import { useEffect, type ReactNode } from "react";
import type { SpecStatus } from "../domain/types";

export function Progress({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <span className={`sbp-progress${v >= 100 ? " sbp-progress--done" : ""}`} title={`${v}% of the required questions answered`}>
      <span className="sbp-progress__bar">
        <span className="sbp-progress__fill" style={{ width: `${v}%` }} />
      </span>
      <span className="sbp-progress__label">{v}%</span>
    </span>
  );
}

const STATUS_LABEL: Record<SpecStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  built: "Built",
};

export function StatusPill({ status }: { status: SpecStatus }) {
  return <span className={`sbp-pill sbp-pill--${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Centered dialog (lumineo.css .modal-card). Esc closes. */
export function Modal({
  title,
  onClose,
  children,
  actions,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-card${wide ? " sbp-modal-wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-card__title">{title}</div>
        <div className="modal-card__body">{children}</div>
        <div className="modal-card__actions">
          {actions}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}
