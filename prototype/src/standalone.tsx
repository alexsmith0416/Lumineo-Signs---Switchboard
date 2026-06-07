import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Role } from "./types";
import DashboardCustomizable from "./components/DashboardCustomizable";
import { usersByRole } from "./data/mockData";
import "./styles.css";

const ROLES: Role[] = ["Operations", "Sales", "Production", "Installation", "Shipping"];

/**
 * Standalone shell — boots straight into the dashboard mockup.
 * Includes a small role picker in the corner so reviewers can still
 * swap perspectives (Ops shows the richest dataset), but there is no
 * splash, no header, no back affordance.
 */
function StandaloneApp() {
  const [role, setRole] = useState<Role>("Operations");
  const [open, setOpen] = useState(false);
  const user = usersByRole[role];

  return (
    <>
      <DashboardCustomizable role={role} />
      <div className="standalone-role">
        <button
          type="button"
          className="standalone-role__trigger"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="standalone-role__avatar">{user.initials}</span>
          <span className="standalone-role__role">{role}</span>
          <span className="standalone-role__caret">▾</span>
        </button>
        {open && (
          <div className="standalone-role__menu" role="menu">
            <div className="standalone-role__head">View as role · demo</div>
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                className={`standalone-role__item ${r === role ? "is-active" : ""}`}
                onClick={() => {
                  setRole(r);
                  setOpen(false);
                }}
              >
                <span className="standalone-role__item-avatar">
                  {usersByRole[r].initials}
                </span>
                <span>
                  <div className="standalone-role__item-role">{r}</div>
                  <div className="standalone-role__item-name">
                    {usersByRole[r].name}
                  </div>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StandaloneApp />
  </StrictMode>,
);
