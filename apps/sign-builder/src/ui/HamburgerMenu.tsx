// Mobile-only nav drawer. On desktop the inline header nav handles routing
// directly; on viewports ≤700px the inline nav hides via CSS and this
// drawer takes over. Backdrop tap, link tap, and Escape all close it.

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

export type NavItem = { to: string; label: string };

export function HamburgerMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    // Prevent the body from scrolling behind the sheet.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="lum-hamburger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={"lum-hamburger__bars" + (open ? " is-open" : "")} aria-hidden>
          <span /><span /><span />
        </span>
      </button>

      {open ? (
        <div
          className="lum-hamburger-sheet"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <nav className="lum-hamburger-sheet__inner">
            <div className="lum-hamburger-sheet__head">
              <span className="lum-hamburger-sheet__label">Navigate</span>
              <button
                type="button"
                className="lum-hamburger-sheet__close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  "lum-hamburger-sheet__link" + (isActive ? " is-active" : "")
                }
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
