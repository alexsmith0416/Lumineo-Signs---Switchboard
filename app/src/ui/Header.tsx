// Header — mirrors the Switchboard prototype `lcl_Header` 1:1 (white sticky
// bar, brand on the left, demo / role-switcher cluster on the right) so the
// Sign Builder Pro sub-app reads as the same product as Switchboard and LNI
// Production Schedule when they sit side-by-side in the tenant.
//
// Sub-apps still need navigation between their own screens, so the tab strip
// sits in a second row directly below the header rather than inside it.

import { NavLink } from "react-router-dom";
import type { LaunchContext } from "../app/launchParams";
import { detectDataBackend } from "../data/dataverseAdapter";

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
    <>
      <header className="lum-header">
        <div className="lum-header__brand">
          <div className="lum-header__logo">LS</div>
          <div className="lum-header__brand-text">
            <span className="lum-header__brand-name">LUMINEO SIGNS</span>
            <span className="lum-header__brand-sub">Sign Builder Pro</span>
          </div>
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

      <nav className="lum-subnav" aria-label="Primary">
        <div className="lum-subnav__inner">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                "lum-subnav__link" + (isActive ? " is-active" : "")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
