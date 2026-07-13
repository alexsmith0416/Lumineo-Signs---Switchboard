import LumineoWordmark from "./LumineoWordmark";
import { SidebarIcon, type SidebarIconName } from "./SidebarIcon";
import { useTheme } from "../theme";

interface SbItem {
  id: string;
  label: string;
  icon: SidebarIconName;
}

// "My Schedule" sits at the top (above the divider); it's inert for now.
const TOP: SbItem[] = [{ id: "my-schedule", label: "My Schedule", icon: "my-schedule" }];

// The scheduler views — the sidebar is now the primary view switcher (the old
// top sub-nav pill row was removed). Ids match App's View union.
const VIEWS: SbItem[] = [
  { id: "production", label: "Production", icon: "production" },
  { id: "installation", label: "Installation", icon: "installation" },
  { id: "shipping", label: "Shipping", icon: "shipping" },
  { id: "monthly", label: "Monthly Gameplanning", icon: "monthly" },
  { id: "scenario", label: "Scenarios", icon: "scenario" },
];

const OTHER: SbItem[] = [
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "help", label: "Help", icon: "help" },
];

interface SidebarProps {
  /** Active view id — highlights the matching nav item. */
  current?: string;
  /** Switch views (the sidebar drives navigation now). */
  onSelect?: (id: string) => void;
  /** Label for the "My Schedule" item — "Employee Schedules" for admin/ops. */
  myScheduleLabel?: string;
  /** Monthly Gameplanning is Admin/Ops only. */
  showMonthly?: boolean;
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: SbItem;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`sb-nav__item${active ? " sb-nav__item--active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <span className="sb-nav__icon">
        <SidebarIcon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </button>
  );
}

export default function Sidebar({ current, onSelect, myScheduleLabel, showMonthly = true }: SidebarProps) {
  const { theme, toggle } = useTheme();
  const nextIsDark = theme === "light";
  const views = showMonthly ? VIEWS : VIEWS.filter((v) => v.id !== "monthly");
  return (
    <aside className="switchboard-sidebar" aria-label="Scheduler navigation">
      <div className="sb-brand">
        <LumineoWordmark className="sb-brand__wordmark" />
      </div>

      <nav className="sb-nav">
        {TOP.map((i) => (
          <NavItem
            key={i.id}
            item={i.id === "my-schedule" && myScheduleLabel ? { ...i, label: myScheduleLabel } : i}
            active={current === i.id}
            onClick={() => onSelect?.(i.id)}
          />
        ))}
      </nav>

      <div className="sb-divider" />

      <nav className="sb-nav">
        {views.map((i) => (
          <NavItem
            key={i.id}
            item={i}
            active={current === i.id}
            onClick={() => onSelect?.(i.id)}
          />
        ))}
      </nav>

      <div className="sb-spacer" />

      <div className="sb-caption">OTHER</div>
      <button
        className="sb-theme-toggle"
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${nextIsDark ? "dark" : "light"} mode`}
      >
        <span className="sb-toggle__icon">
          <SidebarIcon name={nextIsDark ? "moon" : "sun"} size={16} />
        </span>
        <span>{nextIsDark ? "Dark" : "Light"}</span>
      </button>
      <nav className="sb-nav">
        {OTHER.map((i) => (
          <NavItem key={i.id} item={i} />
        ))}
      </nav>
    </aside>
  );
}
