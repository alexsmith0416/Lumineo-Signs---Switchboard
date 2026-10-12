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
  { id: "jobs", label: "Jobs", icon: "joblog" },
  { id: "production", label: "Production", icon: "production" },
  { id: "installation", label: "Installation", icon: "installation" },
  { id: "shipping", label: "Shipping", icon: "shipping" },
  { id: "warehouse", label: "Warehouse Management", icon: "warehouse" },
  { id: "scenario", label: "Scenarios", icon: "scenario" },
];

/**
 * The Installation tools (Oct 11, 2026). The sidebar shows one "Installation"
 * item; its sub-items open while you're in any of them (no hover — that
 * doesn't exist on touch screens and would make the list jump). The same set
 * is a tab strip at the top of each (InstallTabs).
 */
export const INSTALL_TOOLS: SbItem[] = [
  { id: "installation", label: "Schedule", icon: "installation" },
  { id: "monthly", label: "Monthly Gameplanning", icon: "monthly" },
  { id: "planner", label: "Install Planner", icon: "map" },
  { id: "trips", label: "Install Trips", icon: "route" },
];
export const isInstallTool = (id: string | undefined): boolean => INSTALL_TOOLS.some((t) => t.id === id);

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
  /** Scenarios is Admin/Ops only. */
  showScenario?: boolean;
  /** Jobs (job tracking) — Admin/Ops/Developer while it's a preview. */
  showJobs?: boolean;
  /** Warehouse Management — Admin/Ops + logins granted Receiving. */
  showWarehouse?: boolean;
  /** Install Planner (map, radius groups) — Admin/Ops. */
  showPlanner?: boolean;
  /** Install Trips (saved trips, view only) — installers + Admin/Ops. */
  showTrips?: boolean;
}

function NavItem({
  item,
  active,
  onClick,
  sub = false,
  open,
}: {
  item: SbItem;
  active?: boolean;
  onClick?: () => void;
  /** A tool inside a group (indented, smaller). */
  sub?: boolean;
  /** A group header: whether its tools are showing. */
  open?: boolean;
}) {
  return (
    <button
      type="button"
      className={`sb-nav__item${active ? " sb-nav__item--active" : ""}${sub ? " sb-nav__item--sub" : ""}${open ? " sb-nav__item--open" : ""}`}
      aria-expanded={open}
      aria-current={active ? "page" : undefined}
      data-tour={open !== undefined ? `nav-${item.id}-group` : `nav-${item.id}`}
      onClick={onClick}
    >
      <span className="sb-nav__icon">
        <SidebarIcon name={item.icon} />
      </span>
      <span className="sb-nav__label">{item.label}</span>
    </button>
  );
}

export default function Sidebar({ current, onSelect, myScheduleLabel, showMonthly = true, showScenario = true, showJobs = true, showWarehouse = false, showPlanner = false, showTrips = false }: SidebarProps) {
  const { theme, toggle } = useTheme();
  const nextIsDark = theme === "light";
  const views = VIEWS.filter(
    (v) => (v.id !== "scenario" || showScenario) && (v.id !== "jobs" || showJobs) && (v.id !== "warehouse" || showWarehouse),
  );
  const installTools = INSTALL_TOOLS.filter(
    (t) => (t.id !== "monthly" || showMonthly) && (t.id !== "planner" || showPlanner) && (t.id !== "trips" || showTrips),
  );
  const inInstall = isInstallTool(current);
  return (
    <aside className="switchboard-sidebar" aria-label="Switchboard navigation">
      <div className="sb-brand">
        <LumineoWordmark className="sb-brand__wordmark" />
      </div>

      <div className="sb-divider" />

      <nav className="sb-nav sb-nav--top">
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
        {views.map((i) =>
          i.id === "installation" && installTools.length > 1 ? (
            <div key={i.id} className={`sb-group${inInstall ? " sb-group--open" : ""}`}>
              {/* The header opens the Schedule; its tools show while you're in any of them. */}
              <NavItem item={i} open={inInstall} onClick={() => onSelect?.("installation")} />
              {inInstall && (
                <div className="sb-group__items" role="group" aria-label="Installation tools">
                  {installTools.map((t) => (
                    <NavItem key={t.id} item={t} sub active={current === t.id} onClick={() => onSelect?.(t.id)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavItem key={i.id} item={i} active={current === i.id} onClick={() => onSelect?.(i.id)} />
          ),
        )}
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
        <span className="sb-theme-toggle__label">{nextIsDark ? "Dark" : "Light"}</span>
      </button>
      <nav className="sb-nav">
        {OTHER.map((i) => (
          <NavItem
            key={i.id}
            item={i}
            active={current === i.id}
            onClick={() => onSelect?.(i.id)}
          />
        ))}
      </nav>
    </aside>
  );
}
