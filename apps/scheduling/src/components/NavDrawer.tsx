import { useEffect, useRef } from "react";
import Sidebar from "./Sidebar";

interface NavDrawerProps {
  open: boolean;
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Label for the "My Schedule" item — mirrors the desktop sidebar. */
  myScheduleLabel?: string;
  /** Monthly Gameplanning is Admin/Ops only. */
  showMonthly?: boolean;
  /** Scenarios is Admin/Ops only. */
  showScenario?: boolean;
}

/**
 * Mobile/tablet nav drawer. Slides in the exact desktop sidebar (same logo,
 * items, grouping, theme toggle) so the two stay in lockstep. Selecting an
 * item navigates and closes the drawer.
 */
export default function NavDrawer({
  open,
  current,
  onSelect,
  onClose,
  myScheduleLabel,
  showMonthly,
  showScenario,
}: NavDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes; focus the close button on open for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 80);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="nav-drawer-backdrop" onClick={onClose} role="presentation">
      <div
        className="nav-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
      >
        <button
          ref={closeRef}
          className="nav-drawer__close"
          aria-label="Close menu"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <Sidebar
          current={current}
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
          myScheduleLabel={myScheduleLabel}
          showMonthly={showMonthly}
          showScenario={showScenario}
        />
      </div>
    </div>
  );
}
