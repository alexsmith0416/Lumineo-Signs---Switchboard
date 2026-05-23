// Header — navy sticky bar matching the Sign Builder Pro Preview and LNI
// Production Schedule sub-apps. The Switchboard prototype (launcher) uses
// a white header; the working sub-apps use this navy variant so they read
// as the active app inside the tenant.

import { NavLink } from "react-router-dom";
import type { LaunchContext } from "../app/launchParams";
import { detectDataBackend } from "../data/dataverseAdapter";
import { RayMark } from "./RayMark";

type HeaderProps = {
  launch: LaunchContext;
  productCode?: string;
};

const BACKEND = detectDataBackend();

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/builder", label: "Builder" },
  { to: "/projects", label: "Projects" },
  { to: "/gallery", label: "Gallery" },
  { to: "/reports", label: "Reports" },
];

export function Header({ launch, productCode }: HeaderProps) {
  const initials = (launch.userEmail || "U")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "U";

  return (
    <header className="lum-header">
      <div className="lum-header__left">
        <div className="lum-header__brand">
          <RayMark size={32} />
          <div className="lum-header__brand-text">
            <span className="lum-header__brand-name">LUMINEO</span>
            <span className="lum-header__brand-sub">SIGNS</span>
          </div>
        </div>
        <div className="lum-header__divider" aria-hidden />
        <nav className="lum-header__nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                "lum-header__navlink" + (isActive ? " is-active" : "")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="lum-header__right">
        {productCode ? (
          <span className="lum-header__spec-badge" title="Live product code">
            {productCode}
          </span>
        ) : null}

        {BACKEND === "local" ? (
          <span
            className="lum-header__demo-pill"
            title="Saves go to localStorage until pac code push connects to Dataverse"
          >
            Dev · localStorage
          </span>
        ) : null}

        <div className="lum-header__roleswitcher">
          <button
            type="button"
            className="lum-header__roleswitcher-trigger"
            aria-haspopup="menu"
            aria-expanded={false}
            title={
              BACKEND === "dataverse"
                ? "Connected to Sign Specifications table in Dataverse"
                : "Local dev mode"
            }
          >
            <div className="lum-header__avatar" aria-hidden>{initials}</div>
            <div className="lum-header__userblock">
              <span className="lum-header__username">{launch.userEmail || "Unknown user"}</span>
              <span className="lum-header__userrole">{launch.role || "Guest"}</span>
            </div>
            <span className="lum-header__caret" aria-hidden>▾</span>
          </button>
        </div>
      </div>
    </header>
  );
}
