import { useEffect, useRef } from "react";

interface NavItem {
  id: string;
  label: string;
  group?: string;
}

interface NavDrawerProps {
  open: boolean;
  current: string;
  items: NavItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function NavDrawer({ open, current, items, onSelect, onClose }: NavDrawerProps) {
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // Escape closes; focus the first nav item on open for keyboard users
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => firstItemRef.current?.focus(), 80);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Group items by their `group` value, preserving insertion order.
  const groups: Array<{ name: string | undefined; items: NavItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  return (
    <div className="nav-drawer-backdrop" onClick={onClose} role="presentation">
      <nav
        className="nav-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
      >
        <div className="nav-drawer__header">
          <div className="app-header__logo" style={{ padding: "4px 8px" }}>
            <div className="app-header__logo-text">
              <span className="lumineo">LUMINEO</span>
              <span className="signs">SIGNS</span>
            </div>
          </div>
          <button
            className="nav-drawer__close"
            aria-label="Close menu"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="nav-drawer__body">
          {groups.map((g, gi) => (
            <div key={gi} className="nav-drawer__group">
              {g.name && <div className="nav-drawer__group-label">{g.name}</div>}
              {g.items.map((it, idx) => (
                <button
                  key={it.id}
                  type="button"
                  ref={gi === 0 && idx === 0 ? firstItemRef : undefined}
                  className={`nav-drawer__item${current === it.id ? " nav-drawer__item--active" : ""}`}
                  aria-current={current === it.id ? "page" : undefined}
                  onClick={() => {
                    onSelect(it.id);
                    onClose();
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
