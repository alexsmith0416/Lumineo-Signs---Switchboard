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
  if (!open) return null;

  // Group items by their `group` value, preserving insertion order.
  const groups: Array<{ name: string | undefined; items: NavItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  return (
    <div className="nav-drawer-backdrop" onClick={onClose}>
      <nav className="nav-drawer" onClick={(e) => e.stopPropagation()}>
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
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`nav-drawer__item${current === it.id ? " nav-drawer__item--active" : ""}`}
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
