import { useEffect, useRef, useState } from "react";
import type { Role, User } from "../types";
import { usersByRole } from "../data/mockData";

const ROLES: Role[] = ["Operations", "Sales", "Production", "Installation", "Shipping"];

interface Props {
  user: User;
  role: Role;
  onChangeRole: (role: Role) => void;
}

export default function Header({ user, role, onChangeRole }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <header className="header">
      <div className="header__brand">
        <div className="header__logo">LS</div>
        <div className="header__brand-text">
          <span className="header__brand-name">LUMINEO SIGNS</span>
          <span className="header__brand-sub">Switchboard</span>
        </div>
      </div>

      <div className="header__right">
        <span className="header__demo-pill">Demo · role switch</span>

        <div className="header__roleswitcher" ref={ref}>
          <button
            type="button"
            className="header__roleswitcher-trigger"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="header__avatar">{user.initials}</div>
            <div className="header__userblock">
              <span className="header__username">{user.name}</span>
              <span className="header__userrole">{role}</span>
            </div>
            <span className="header__caret">▾</span>
          </button>

          {open && (
            <div className="header__roleswitcher-menu" role="menu">
              <div className="header__roleswitcher-menu-header">Switch role</div>
              {ROLES.map((r) => {
                const u = usersByRole[r];
                const active = r === role;
                return (
                  <button
                    key={r}
                    type="button"
                    className={`header__roleswitcher-option ${active ? "is-active" : ""}`}
                    onClick={() => {
                      onChangeRole(r);
                      setOpen(false);
                    }}
                  >
                    <div className="header__roleswitcher-option-avatar">{u.initials}</div>
                    <div className="header__userblock">
                      <span className="header__username">{r}</span>
                      <span className="header__userrole" style={{ color: "var(--lum-gray-500)" }}>
                        {u.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
