// Job Queue icons, from the provided brand SVGs. Both use `currentColor` so they
// inherit the button's text color (navy on light chips, white on colored ones).

interface IconProps {
  size?: number;
  className?: string;
}

/** "Job Queue - Expand" — on the schedule screens: opens the Job Queue (arrow points left, into the board). */
export function QueueExpandIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 139.48 139.48" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M36.41 68.2l20.88 -20.89c0.42,-0.41 0.97,-0.64 1.55,-0.64 1.2,0 2.18,0.97 2.18,2.18 0,0 0,0.01 0,0.01l0 41.77c0,0 0,0 0,0 0,1.2 -0.97,2.18 -2.18,2.18 -0.58,0 -1.13,-0.23 -1.54,-0.64l-20.89 -20.89c-0.41,-0.41 -0.64,-0.96 -0.64,-1.54 0,-0.58 0.23,-1.13 0.64,-1.54l-0 0z"
      />
      <path
        fill="currentColor"
        d="M-0 15.26c0,-8.42 6.84,-15.26 15.26,-15.26l108.97 0c8.42,0 15.26,6.84 15.26,15.26l0 108.97c-0,8.42 -6.83,15.25 -15.26,15.25l-108.97 0.01c-8.42,-0.01 -15.25,-6.84 -15.25,-15.26l-0.01 -108.96zm15.26 -2.18c-1.2,0 -2.17,0.98 -2.17,2.18l0 108.97c0,1.2 0.98,2.18 2.18,2.18l67.55 0 0 -113.33 -67.56 0zm108.97 113.33c1.2,-0.01 2.18,-0.98 2.18,-2.18l0 -108.96c-0,-1.2 -0.98,-2.18 -2.18,-2.18l-28.33 -0 0 113.33 28.33 0z"
      />
    </svg>
  );
}

/** "Job Queue - Collapse" — in the Job Queue panel: closes it (arrow points right, back out). */
export function QueueCollapseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 141.58 141.58" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M61.29 69.23l-21.2 -21.2c-0.42,-0.42 -0.98,-0.65 -1.57,-0.65 -1.22,0 -2.21,0.99 -2.21,2.21 0,0 0,0.01 0,0.01l0 42.4c0,0 0,0 0,0 0,1.22 0.99,2.21 2.21,2.21 0.59,0 1.15,-0.24 1.57,-0.65l21.21 -21.2c0.41,-0.42 0.65,-0.98 0.65,-1.56 0,-0.59 -0.24,-1.15 -0.65,-1.57l0 0z"
      />
      <path
        fill="currentColor"
        d="M-0 15.49c0,-8.55 6.94,-15.49 15.49,-15.49l110.61 0c8.55,0 15.49,6.94 15.49,15.49l0 110.61c-0,8.54 -6.94,15.48 -15.49,15.48l-110.61 0.01c-8.55,-0.01 -15.48,-6.94 -15.48,-15.49l-0.01 -110.6zm15.49 -2.21c-1.22,0 -2.21,0.99 -2.21,2.21l0 110.61c0,1.22 0.99,2.21 2.21,2.21l68.57 0 0 -115.03 -68.58 0zm110.61 115.03c1.22,-0.01 2.21,-1 2.21,-2.22l0 -110.6c-0,-1.22 -0.99,-2.21 -2.21,-2.21l-28.76 -0 0 115.03 28.76 0z"
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
