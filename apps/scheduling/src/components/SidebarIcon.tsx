import type { ReactNode } from "react";

export type SidebarIconName =
  | "dashboard"
  | "my-schedule"
  | "inbox"
  | "production"
  | "weekly"
  | "sign-builder"
  | "joblog"
  | "estimating"
  | "sales"
  | "settings"
  | "help"
  | "moon"
  | "sun";

// Line-style glyphs (24px grid, currentColor) matching the Switchboard sidebar
// mockup. The icon inherits its color from the nav item (white in light, accent
// blue in dark; both follow the active/hover colors).
const PATHS: Record<SidebarIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.2" />
      <rect x="14" y="3" width="7" height="5" rx="1.2" />
      <rect x="14" y="12" width="7" height="9" rx="1.2" />
      <rect x="3" y="16" width="7" height="5" rx="1.2" />
    </>
  ),
  "my-schedule": (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M10 3h4" />
      <circle cx="12" cy="10" r="2.4" />
      <path d="M8 17a4 4 0 0 1 8 0" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  production: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <path d="M9 16.5v-2.5" />
      <path d="M12 16.5v-5.5" />
      <path d="M15 16.5v-1.5" />
    </>
  ),
  weekly: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M7.5 13h.01" />
      <path d="M12 13h.01" />
      <path d="M16.5 13h.01" />
      <path d="M7.5 17h.01" />
      <path d="M12 17h.01" />
    </>
  ),
  "sign-builder": (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="2.5" y="16" width="6" height="5" rx="1" />
      <rect x="9" y="16" width="6" height="5" rx="1" />
      <rect x="15.5" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v3" />
      <path d="M5.5 16v-2a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v2" />
      <path d="M12 11v5" />
    </>
  ),
  joblog: (
    <>
      <path d="M10 3h4" />
      <path d="M12 3v2" />
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13l3-3" />
    </>
  ),
  estimating: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect x="7" y="5" width="10" height="4" rx="1" />
      <path d="M8 13h.01" />
      <path d="M12 13h.01" />
      <path d="M16 13v4" />
      <path d="M8 17h.01" />
      <path d="M12 17h.01" />
    </>
  ),
  sales: (
    <>
      <path d="M8 3h8l-1.2 2.9a7 7 0 0 1 4.2 6.4C19 16.7 16 20 12 20s-7-3.3-7-7.7a7 7 0 0 1 4.2-6.4z" />
      <path d="M12 9.5v5.2" />
      <path d="M13.7 10.7c-.3-.6-.9-1-1.7-1-1 0-1.8.6-1.8 1.4 0 1.8 3.6.8 3.6 2.7 0 .8-.8 1.4-1.8 1.4-.8 0-1.5-.4-1.8-1" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.2 9.3a3 3 0 0 1 5.5 1c0 2-3 2.6-3 2.6" />
      <path d="M12 17h.01" />
    </>
  ),
  moon: <path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.9 19.1l1.4-1.4" />
      <path d="M17.7 6.3l1.4-1.4" />
    </>
  ),
};

export function SidebarIcon({ name, size = 20 }: { name: SidebarIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
