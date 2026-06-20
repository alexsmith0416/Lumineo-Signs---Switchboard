interface SubNavItem {
  id: string;
  label: string;
}

interface SubNavProps {
  items: SubNavItem[];
  current: string;
  onSelect: (id: string) => void;
}

// The Project Scheduler's own view switcher (Production / Installation /
// Shipping / Monthly Plan / Scenarios) as a pill row beneath the topbar.
export default function SubNav({ items, current, onSelect }: SubNavProps) {
  return (
    <nav className="sub-nav" aria-label="Scheduler views">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`sub-nav__tab${current === it.id ? " sub-nav__tab--active" : ""}`}
          aria-current={current === it.id ? "page" : undefined}
          onClick={() => onSelect(it.id)}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
