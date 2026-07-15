// Job Queue icons, from the provided brand SVGs. Both use `currentColor` so they
// inherit the button's text color (navy on light chips, white on colored ones).

interface IconProps {
  size?: number;
  className?: string;
}

/** Sidebar / panel toggle glyph (the "Sidebar Logo" mark). */
export function QueueToggleIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 4.35 4.35"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M1.47 0l1.63 0c0.69,0 1.25,0.56 1.25,1.25l0 1.84c0,0.69 -0.56,1.25 -1.25,1.25l-1.63 0 0 -4.35zm1.24 1.5c0.06,-0.06 0.17,-0.06 0.23,0 0.06,0.06 0.06,0.17 0,0.23l-0.44 0.44 0.44 0.44c0.06,0.06 0.06,0.17 0,0.23 -0.06,0.06 -0.17,0.06 -0.23,0l-0.56 -0.56c-0.06,-0.06 -0.06,-0.17 0,-0.23l0.56 -0.56zm-1.57 2.84c-0.64,-0.06 -1.14,-0.6 -1.14,-1.25l0 -1.84c0,-0.65 0.5,-1.19 1.14,-1.25l0 4.34z"
      />
    </svg>
  );
}

/** Edit (pencil-in-box) glyph. */
export function QueueEditIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1.29 1.09"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M0.95 0.9l0 -0.22 0.14 -0.14 0 0.4c0,0.08 -0.07,0.15 -0.14,0.15l-0.8 0c-0.08,0 -0.14,-0.07 -0.14,-0.15l0 -0.8c0,-0.08 0.06,-0.15 0.14,-0.15l0.81 0 0 0 -0.14 0.13 -0.63 0c-0.03,0 -0.05,0.03 -0.05,0.06l0 0.71c0,0.03 0.03,0.05 0.05,0.05l0.71 0c0.03,0 0.05,-0.02 0.05,-0.05l-0 0zm0.13 -0.83l0.14 0.14 0.07 -0.07 -0.14 -0.14 -0.07 0.07zm-0.51 0.51l0.14 0.14 0.46 -0.46 -0.14 -0.14 -0.46 0.46zm-0.1 0.25l0.2 -0.05 -0.14 -0.14 -0.05 0.2z"
      />
    </svg>
  );
}
