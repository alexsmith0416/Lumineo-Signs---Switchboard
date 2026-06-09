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

// ─── Switchboard design-system semantic tokens (DESIGN.md §2) ───────────────
// The single source of truth for the light/dark token pairs every sub-app
// renders against. Apps wire these up as CSS custom properties on a
// `[data-theme]` scope (slash → hyphen, e.g. `surface/raised` →
// `--surface-raised`) and reference tokens only — never raw hex.

export type ThemeTokens = {
  bgPage: string;
  surfaceRaised: string;
  surfaceSunken: string;
  surfaceSidebar: string;
  borderDefault: string;
  borderSoft: string;
  textPrimary: string;
  textMid: string;
  textDim: string;
  textOnAccent: string;
  accentBrand: string;
  accentBrandSoft: string;
  statusGreen: string;
  statusGreenSoft: string;
  statusRed: string;
  statusRedSoft: string;
  statusAmber: string;
  statusAmberSoft: string;
  toggleActive: string;
  toggleActiveText: string;
};

export const lightTheme: ThemeTokens = {
  bgPage: '#f4f5f8',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#f4f5f8',
  surfaceSidebar: '#141464',
  borderDefault: '#e4e5ea',
  borderSoft: '#eff0f3',
  textPrimary: '#1f1f2e',
  textMid: '#4a4f5e',
  textDim: '#8b91a3',
  textOnAccent: '#ffffff',
  accentBrand: '#141464',
  accentBrandSoft: '#e8eaf5',
  statusGreen: '#0f6e56',
  statusGreenSoft: '#d8efe7',
  statusRed: '#e8151b',
  statusRedSoft: '#ffe4e5',
  statusAmber: '#f2994a',
  statusAmberSoft: '#fdf0d9',
  toggleActive: '#ffffff',
  toggleActiveText: '#1f1f2e',
} as const;

export const darkTheme: ThemeTokens = {
  bgPage: '#0b0e1f',
  surfaceRaised: '#1a1f3d',
  surfaceSunken: '#131734',
  surfaceSidebar: '#131734',
  borderDefault: '#2a3056',
  borderSoft: '#1f2542',
  textPrimary: '#f3f4f8',
  textMid: '#b3b8cc',
  textDim: '#7b82a0',
  textOnAccent: '#ffffff',
  accentBrand: '#7388ff',
  accentBrandSoft: '#2a3260',
  statusGreen: '#2dd4a4',
  statusGreenSoft: '#1d4050',
  statusRed: '#ff5158',
  statusRedSoft: '#432842',
  statusAmber: '#fcb85b',
  statusAmberSoft: '#433b42',
  toggleActive: '#7388ff',
  toggleActiveText: '#ffffff',
} as const;

export const themes = { light: lightTheme, dark: darkTheme } as const;
