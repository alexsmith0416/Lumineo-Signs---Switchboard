import { useEffect, useState } from "react";
import LumineoLogo from "./LumineoLogo";

// Switchboard's full app catalog. Project Scheduler is the active one
// since this prototype IS that app; the rest are stubs in the shell.
const MAIN_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "▦", disabled: true },
  { id: "my-schedule", label: "My Schedule", icon: "◷", disabled: true },
];

const APP_ITEMS = [
  { id: "project-scheduler", label: "Project Scheduler", icon: "⧉", disabled: false, active: true },
  { id: "weekly-scheduler", label: "Weekly Scheduler", icon: "▤", disabled: true },
  { id: "sign-builder", label: "Sign Builder Pro", icon: "✎", disabled: true },
  { id: "job-punches", label: "Job Punches", icon: "⏱", disabled: true },
  { id: "estimating", label: "Estimating", icon: "$", disabled: true },
  { id: "sales-hub", label: "Sales Hub", icon: "◈", disabled: true },
  { id: "calendar", label: "Calendar", icon: "▥", disabled: true },
];

const OTHER_ITEMS = [
  { id: "settings", label: "Settings", icon: "⚙", disabled: true },
  { id: "help", label: "Help", icon: "?", disabled: true },
];

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("lumineo-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function SwitchboardSidebar() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("lumineo-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <aside className="switchboard-sidebar" aria-label="Switchboard navigation">
      <div className="sb-brand">
        <div className="sb-brand__logo">
          <LumineoLogo size={32} color="#ffffff" />
        </div>
        <div className="sb-brand__text">
          <span className="sb-brand__name">LUMINEO SIGNS</span>
          <span className="sb-brand__sub">SWITCHBOARD</span>
        </div>
      </div>

      <div className="sb-caption">MAIN</div>
      <nav className="sb-nav">
        {MAIN_ITEMS.map((it) => (
          <SidebarItem key={it.id} {...it} />
        ))}
      </nav>

      <div className="sb-caption">APPS</div>
      <nav className="sb-nav">
        {APP_ITEMS.map((it) => (
          <SidebarItem key={it.id} {...it} />
        ))}
      </nav>

      <div className="sb-spacer" />

      <div className="sb-caption">OTHER</div>
      <button
        className="sb-theme-toggle"
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        <span className="sb-nav__icon">{theme === "light" ? "☾" : "☀"}</span>
        <span>{theme === "light" ? "Dark" : "Light"}</span>
      </button>
      <nav className="sb-nav">
        {OTHER_ITEMS.map((it) => (
          <SidebarItem key={it.id} {...it} />
        ))}
      </nav>
    </aside>
  );
}

interface SidebarItemProps {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
  active?: boolean;
}

function SidebarItem({ label, icon, disabled, active }: SidebarItemProps) {
  return (
    <button
      type="button"
      className={`sb-nav__item${active ? " sb-nav__item--active" : ""}`}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      style={disabled ? { opacity: 0.55, cursor: "default" } : undefined}
    >
      <span className="sb-nav__icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
