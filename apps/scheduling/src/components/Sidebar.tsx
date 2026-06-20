import LumineoLogo from "./LumineoLogo";
import { useTheme } from "../theme";

interface SbItem {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
  active?: boolean;
}

// The Switchboard app nav. Project Scheduler is the active app; the other
// entries are separate Switchboard apps (out of scope here) and render
// disabled, matching the prototype.
const MAIN: SbItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "▦", disabled: true },
  { id: "my-schedule", label: "My Schedule", icon: "🗓️", disabled: true },
];

const APPS: SbItem[] = [
  { id: "project-scheduler", label: "Project Scheduler", icon: "📅", active: true },
  { id: "weekly-scheduler", label: "Weekly Scheduler", icon: "🗒️", disabled: true },
  { id: "sign-builder", label: "Sign Builder Pro", icon: "🪧", disabled: true },
  { id: "job-punches", label: "Job Punches", icon: "⏱️", disabled: true },
  { id: "estimating", label: "Estimating", icon: "💲", disabled: true },
  { id: "sales-hub", label: "Sales Hub", icon: "📈", disabled: true },
  { id: "calendar", label: "Calendar", icon: "📆", disabled: true },
];

const OTHER: SbItem[] = [
  { id: "settings", label: "Settings", icon: "⚙️", disabled: true },
  { id: "help", label: "Help", icon: "❔", disabled: true },
];

function NavItem({ item }: { item: SbItem }) {
  return (
    <button
      type="button"
      className={`sb-nav__item${item.active ? " sb-nav__item--active" : ""}`}
      disabled={item.disabled}
      aria-current={item.active ? "page" : undefined}
      style={item.disabled ? { opacity: 0.55, cursor: "default" } : undefined}
    >
      <span className="sb-nav__icon" aria-hidden="true">{item.icon}</span>
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
        <span className="sb-nav__icon" aria-hidden="true">{nextIsDark ? "🌙" : "☀️"}</span>
        <span>{nextIsDark ? "Dark" : "Light"}</span>
      </button>
      <nav className="sb-nav">
        {OTHER.map((i) => <NavItem key={i.id} item={i} />)}
      </nav>
    </aside>
  );
}
