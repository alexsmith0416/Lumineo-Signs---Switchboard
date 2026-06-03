// Lumineo design tokens — shared by every Switchboard sub-app.
// Colors and type come from docs/08-splash-screen-spec.md and the existing
// Switchboard design commits on master.

export const colors = {
  navy: '#141464',
  navyLight: '#2a2a8a',
  navyBg: '#e8eaf5',
  red: '#E8151B',
  redDark: '#c4111a',
  white: '#ffffff',
  black: '#000000',
  // Neutrals used in the UI shell.
  gray50: '#fafafa',
  gray100: '#f4f4f5',
  gray200: '#e4e4e7',
  gray300: '#d4d4d8',
  gray500: '#71717a',
  gray700: '#3f3f46',
  gray900: '#18181b',
  // Status.
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
} as const;

export const typography = {
  fontFamily: '"Open Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  weight: { regular: 400, semibold: 600, bold: 700 },
  size: {
    xs: 12,
    sm: 13,
    md: 14,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
  },
} as const;

export const layout = {
  headerHeight: 64,
  // Breakpoints — UI must be usable at 600/900/1200; two-column piece-list/detail
  // collapses to single column below 900.
  bp: { sm: 600, md: 900, lg: 1200 },
} as const;

export const radii = {
  sm5: 5,
  md7: 7,
  lg10: 10,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(20, 20, 100, 0.06)',
  md: '0 2px 8px rgba(20, 20, 100, 0.08)',
  lg: '0 4px 16px rgba(20, 20, 100, 0.10)',
} as const;
