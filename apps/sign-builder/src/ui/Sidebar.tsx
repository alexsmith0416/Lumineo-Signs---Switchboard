// Sidebar — 248px navigation rail per docs/DESIGN.md §6.1.
// Light theme: indigo brand background with white text and the active item as
// a white tab protruding from the rail. Dark theme: surface-sidebar.
//
// On mobile (<900px) it slides off-canvas; the Topbar hamburger toggles it.

import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { RayMark } from "./RayMark";
import { useTheme } from "./useTheme";
import {
  BuilderIcon,
  DashboardIcon,
  GalleryIcon,
  HelpIcon,
  MoonIcon,
  ProjectsIcon,
  ReportsIcon,
  SettingsIcon,
  SunIcon,
} from "./icons";

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

const MAIN_ITEMS: NavItem[] = [
  { to: "/",         label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/builder",  label: "Builder",   icon: <BuilderIcon /> },
  { to: "/projects", label: "Projects",  icon: <ProjectsIcon /> },
  { to: "/gallery",  label: "Gallery",   icon: <GalleryIcon /> },
  { to: "/reports",  label: "Reports",   icon: <ReportsIcon /> },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className={"lum-sidebar" + (open ? " is-open" : "")}>
      <div className="lum-sidebar__brand">
        <RayMark size={36} />
        <div className="lum-sidebar__brand-text">
          <span className="lum-sidebar__brand-name">LUMINEO SIGNS</span>
          <span className="lum-sidebar__brand-sub">Sign Builder Pro</span>
        </div>
      </div>

      <div className="lum-sidebar__caption">Main</div>
      <div className="lum-sidebar__section">
        {MAIN_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              "lum-sidebar__link" + (isActive ? " is-active" : "")
            }
          >
            <span className="lum-sidebar__link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="lum-sidebar__section lum-sidebar__section--bottom">
        <div className="lum-sidebar__caption">Other</div>
        <button
          type="button"
          className="lum-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          <span className="lum-theme-toggle__icon">
            {theme === "light" ? <MoonIcon size={14} /> : <SunIcon size={14} />}
          </span>
          <span>{theme === "light" ? "Dark" : "Light"}</span>
        </button>
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            "lum-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <span className="lum-sidebar__link-icon"><SettingsIcon /></span>
          <span>Settings</span>
        </NavLink>
        <NavLink
          to="/help"
          onClick={onClose}
          className={({ isActive }) =>
            "lum-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <span className="lum-sidebar__link-icon"><HelpIcon /></span>
          <span>Help</span>
        </NavLink>
      </div>
    </aside>
  );
}
