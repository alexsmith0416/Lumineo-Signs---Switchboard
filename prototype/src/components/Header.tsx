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
    <header className="hdr">
      <div className="hdr__brand">
        <div className="hdr__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <g stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="3"  x2="12" y2="7"  />
              <line x1="12" y1="17" x2="12" y2="21" />
              <line x1="3"  y1="12" x2="7"  y2="12" />
              <line x1="17" y1="12" x2="21" y2="12" />
              <line x1="5.6"  y1="5.6"  x2="8.4"  y2="8.4"  />
              <line x1="15.6" y1="15.6" x2="18.4" y2="18.4" />
              <line x1="5.6"  y1="18.4" x2="8.4"  y2="15.6" />
              <line x1="15.6" y1="8.4"  x2="18.4" y2="5.6"  />
            </g>
            <circle cx="12" cy="12" r="2.4" fill="white" />
          </svg>
        </div>
        <div className="hdr__brand-text">
          <span className="hdr__brand-name">LUMINEO SIGNS</span>
          <span className="hdr__brand-sub">SWITCHBOARD</span>
        </div>
        <div className="hdr__divider" />
        <span className="hdr__view-title">Home · {role}</span>
      </div>

      <div className="hdr__right">
        <button type="button" className="hdr__btn hdr__btn--ghost">Help</button>
        <button type="button" className="hdr__btn hdr__btn--red">+ New</button>

        <div className="hdr__user" ref={ref}>
          <button
            type="button"
            className="hdr__user-trigger"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="hdr__avatar">{user.initials}</div>
            <div className="hdr__userblock">
              <span className="hdr__username">{user.name}</span>
              <span className="hdr__userrole">{role}</span>
            </div>
            <span className="hdr__caret">▾</span>
          </button>

          {open && (
            <div className="hdr__menu" role="menu">
              <div className="hdr__menu-header">Switch role · demo</div>
              {ROLES.map((r) => {
                const u = usersByRole[r];
                const active = r === role;
                return (
                  <button
                    key={r}
                    type="button"
                    className={`hdr__menu-option ${active ? "is-active" : ""}`}
                    onClick={() => {
                      onChangeRole(r);
                      setOpen(false);
                    }}
                  >
                    <div className="hdr__menu-avatar">{u.initials}</div>
                    <div className="hdr__menu-text">
                      <span className="hdr__menu-role">{r}</span>
                      <span className="hdr__menu-name">{u.name}</span>
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
