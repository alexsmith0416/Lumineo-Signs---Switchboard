// Small inline SVG icon set. 20px line icons for sidebar; ~14-18px inline.
// All icons inherit currentColor so they recolor via CSS without per-icon
// prop drilling.

type IconProps = { size?: number; strokeWidth?: number };

const D = (size = 20, sw = 1.7) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: sw,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function DashboardIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function BuilderIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <path d="M3 21l4-9 6 6-9 4z" />
      <path d="M13 10l4-4-2-2 4-4 4 4-4 4-2-2-4 4" />
    </svg>
  );
}

export function ProjectsIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function GalleryIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function ReportsIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <path d="M3 21V8m6 13V3m6 18v-9m6 9V11" />
    </svg>
  );
}

export function SettingsIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function HelpIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function MoonIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  );
}

export function SunIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function SearchIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size ?? 14, p.strokeWidth)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </svg>
  );
}

export function MenuIcon(p: IconProps = {}) {
  return (
    <svg {...D(p.size, p.strokeWidth)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
