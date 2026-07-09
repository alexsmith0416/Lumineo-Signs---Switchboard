import LumineoLogo from "./LumineoLogo";
import { SidebarIcon, type SidebarIconName } from "./SidebarIcon";
import { useTheme } from "../theme";

interface SbItem {
  id: string;
  label: string;
  icon: SidebarIconName;
  active?: boolean;
}

// The Switchboard app nav. Weekly Scheduler is the active app (this app); the
// other entries are separate Switchboard apps (out of scope here) and render
// inert, matching the prototype.
const MAIN: SbItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "my-schedule", label: "My Schedule", icon: "my-schedule" },
];

const APPS: SbItem[] = [
  { id: "production-scheduler", label: "Production Scheduler", icon: "production" },
  { id: "weekly-scheduler", label: "Weekly Scheduler", icon: "weekly", active: true },
  { id: "sign-builder", label: "Sign Builder Pro", icon: "sign-builder" },
  { id: "joblog", label: "JobLog", icon: "joblog" },
  { id: "estimating", label: "Estimating", icon: "estimating" },
  { id: "sales-hub", label: "Sales Hub", icon: "sales" },
];

const OTHER: SbItem[] = [
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "help", label: "Help", icon: "help" },
];

function NavItem({ item }: { item: SbItem }) {
  return (
    <button
      type="button"
      className={`sb-nav__item${item.active ? " sb-nav__item--active" : ""}`}
      aria-current={item.active ? "page" : undefined}
    >
      <span className="sb-nav__icon">
        <SidebarIcon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </button>
  );
}

export default function Sidebar() {
  const { theme, toggle } = useTheme();
  const nextIsDark = theme === "light";
  return (
    <aside className="switchboard-sidebar" aria-label="Switchboard navigation">
      <div className="sb-brand">
        <div className="sb-brand__logo">
          <LumineoLogo size={44} color="#EE0800" />
        </div>
        <div className="sb-brand__text">
          <span className="sb-brand__name">LUMINEO SIGNS</span>
          <span className="sb-brand__sub">SWITCHBOARD</span>
        </div>
      </div>

      <div className="sb-caption">MAIN</div>
      <nav className="sb-nav">
        {MAIN.map((i) => <NavItem key={i.id} item={i} />)}
      </nav>

      <div className="sb-caption">APPS</div>
      <nav className="sb-nav">
        {APPS.map((i) => <NavItem key={i.id} item={i} />)}
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
        {OTHER.map((i) => <NavItem key={i.id} item={i} />)}
      </nav>
    </aside>
  );
}
