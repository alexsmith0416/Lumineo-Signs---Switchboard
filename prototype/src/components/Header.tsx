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
          {/* Red square with ray-shaped transparent cutouts (evenodd fill).
              Whatever color sits behind the logo shows through the rays. */}
          <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <path
              fill="#E8151B"
              fillRule="evenodd"
              d="M0,0 H100 V100 H0 Z
                 M25,75 L22,0 L28,0 Z
                 M25,75 L34,0 L46,0 Z
                 M25,75 L54,0 L70,0 Z
                 M25,75 L82,0 L100,7 L100,0 Z
                 M25,75 L100,18 L100,40 Z
                 M25,75 L100,52 L100,76 Z"
            />
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
