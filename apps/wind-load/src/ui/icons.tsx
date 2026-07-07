// Single-weight line-icon set for the Wind Load shell. Icons inherit
// `currentColor` and default to 20px — pass `size` for inline use.
// Stroke style matches the Switchboard design system (DESIGN.md §7).

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconWind = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h9.5a2.5 2.5 0 1 0-2.4-3.2" />
    <path d="M3 12h13.5a2.5 2.5 0 1 1-2.4 3.2" />
    <path d="M3 16h7.5a2 2 0 1 1-1.9 2.6" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />
  </Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </Svg>
);

export const IconPrint = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8V3.5h10V8" />
    <rect x="4" y="8" width="16" height="8.5" rx="2" />
    <path d="M7 14h10v6.5H7z" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5 7.5 20h9l1-13.5M10 10.5v6M14 10.5v6" />
  </Svg>
);

export const IconReset = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5v5h5" />
    <path d="M4.6 13.5A8 8 0 1 0 6 7.3L4 10" />
  </Svg>
);
