// Topbar — sticky page header per docs/DESIGN.md §6.2.
// Left: eyebrow breadcrumb + page title. Right: search + actions + user chip.

import { useLocation } from "react-router-dom";
import type { LaunchContext } from "../app/launchParams";
import { MenuIcon, SearchIcon } from "./icons";

type TopbarProps = {
  launch: LaunchContext;
  onToggleSidebar: () => void;
  productCode?: string;
};

const TITLE_BY_ROUTE: Record<string, { breadcrumb: string; title: string }> = {
  "/":         { breadcrumb: "Sign Builder Pro · Dashboard", title: "Hi there, here's your day" },
  "/builder":  { breadcrumb: "Sign Builder Pro · Builder",   title: "Sign Builder" },
  "/projects": { breadcrumb: "Sign Builder Pro · Projects",  title: "Projects" },
  "/gallery":  { breadcrumb: "Sign Builder Pro · Gallery",   title: "All saved specs" },
  "/reports":  { breadcrumb: "Sign Builder Pro · Reports",   title: "Reports" },
  "/settings": { breadcrumb: "Sign Builder Pro · Settings",  title: "Settings" },
  "/help":     { breadcrumb: "Sign Builder Pro · Help",      title: "Help" },
};

export function Topbar({ launch, onToggleSidebar, productCode }: TopbarProps) {
  const { pathname } = useLocation();
  const route = TITLE_BY_ROUTE[pathname] ?? {
    breadcrumb: "Sign Builder Pro",
    title: "Dashboard",
  };

  // Personalise the dashboard title with the launch param when present.
  const title = pathname === "/" && launch.userEmail
    ? `Hi ${launch.userEmail.split("@")[0].split(/[._-]/)[0]
        .replace(/^./, (c) => c.toUpperCase())}, here's your day`
    : route.title;

  const initials = (launch.userEmail || "U")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "U";

  return (
    <header className="lum-topbar">
      <button
        type="button"
        className="lum-topbar__menu"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
      >
        <MenuIcon size={20} />
      </button>
      <div className="lum-topbar__heading">
        <span className="lum-topbar__breadcrumb">{route.breadcrumb}</span>
        <h1 className="lum-topbar__title">{title}</h1>
      </div>

      <div className="lum-topbar__actions">
        <div className="lum-topbar__search">
          <span className="lum-topbar__search-icon"><SearchIcon /></span>
          <input
            className="lum-topbar__search-input"
            placeholder="Search jobs, customers, people…"
            type="search"
          />
        </div>
        {productCode ? (
          <span className="lum-topbar__spec-badge" title="Live product code">
            {productCode}
          </span>
        ) : null}
        <div className="lum-topbar__user">
          <div className="lum-topbar__avatar" aria-hidden>{initials}</div>
          <div className="lum-topbar__userblock">
            <span className="lum-topbar__username">{launch.userEmail || "Unknown user"}</span>
            <span className="lum-topbar__userrole">{launch.role || "Guest"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
