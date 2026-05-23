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
    .join("");

  return (
    <header className="lum-header">
      <div className="lum-header__brand">
        <div className="lum-header__logo">L</div>
        <div className="lum-header__brand-text">
          <span className="lum-header__brand-name">LUMINEO SIGNS</span>
          <span className="lum-header__brand-sub">Sign Builder Pro</span>
        </div>
      </div>

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

      <div className="lum-header__right">
        {productCode ? (
          <span className="lum-header__spec-badge" title="Live product code">
            {productCode}
          </span>
        ) : null}
        <span
          className={"lum-header__backend is-" + BACKEND}
          title={BACKEND === "dataverse"
            ? "Connected to Sign Specifications table in Dataverse"
            : "Local dev mode — saves go to localStorage until pac code push connects to Dataverse"}
        >
          {BACKEND === "dataverse" ? "● Dataverse" : "● Dev"}
        </span>
        <div className="lum-header__avatar" aria-hidden>
          {initials || "U"}
        </div>
        <div className="lum-header__userblock">
          <span className="lum-header__username">{launch.userEmail || "Unknown user"}</span>
          <span className="lum-header__userrole">{launch.role || "Guest"}</span>
        </div>
      </div>
    </header>
  );
}
