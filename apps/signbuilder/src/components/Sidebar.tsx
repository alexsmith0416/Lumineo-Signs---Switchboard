import LumineoWordmark from "./LumineoWordmark";
import { SidebarIcon, type SidebarIconName } from "./SidebarIcon";
import { useTheme } from "../theme";

export type View = "dashboard" | "builder" | "projects" | "library" | "setup" | "help";

interface SbItem {
  id: View;
  label: string;
  icon: SidebarIconName;
}

const MAIN: SbItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "builder", label: "Builder", icon: "sign-builder" },
  { id: "projects", label: "Projects", icon: "projects" },
  { id: "library", label: "Sign Library", icon: "library" },
];

function NavItem({ item, active, onClick }: { item: SbItem; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`sb-nav__item${active ? " sb-nav__item--active" : ""}`}
      aria-current={active ? "page" : undefined}
      data-tour={`nav-${item.id}`}
      onClick={onClick}
    >
      <span className="sb-nav__icon">
        <SidebarIcon name={item.icon} />
      </span>
      <span className="sb-nav__label">{item.label}</span>
    </button>
  );
}

export default function Sidebar({ current, onSelect, showSetup }: { current: View; onSelect: (v: View) => void; showSetup: boolean }) {
  const { theme, toggle } = useTheme();
  const nextIsDark = theme === "light";
  const other: SbItem[] = [
    ...(showSetup ? [{ id: "setup" as View, label: "Setup", icon: "tree" as SidebarIconName }] : []),
    { id: "help", label: "Help", icon: "help" },
  ];
  return (
    <aside className="switchboard-sidebar" aria-label="Sign Builder navigation">
      <div className="sb-brand">
        <LumineoWordmark className="sb-brand__wordmark" />
      </div>
      <div className="sb-divider" />
      <div className="sb-caption">SIGN BUILDER</div>
      <nav className="sb-nav">
        {MAIN.map((i) => (
          <NavItem key={i.id} item={i} active={current === i.id} onClick={() => onSelect(i.id)} />
        ))}
      </nav>
      <div className="sb-spacer" />
      <div className="sb-caption">OTHER</div>
      <button className="sb-theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${nextIsDark ? "dark" : "light"} mode`}>
        <span className="sb-toggle__icon">
          <SidebarIcon name={nextIsDark ? "moon" : "sun"} size={16} />
        </span>
        <span className="sb-theme-toggle__label">{nextIsDark ? "Dark" : "Light"}</span>
      </button>
      <nav className="sb-nav">
        {other.map((i) => (
          <NavItem key={i.id} item={i} active={current === i.id} onClick={() => onSelect(i.id)} />
        ))}
      </nav>
    </aside>
  );
}
