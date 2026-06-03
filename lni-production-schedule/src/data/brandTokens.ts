export const BRAND = {
  navy:      '#141464',
  navyDark:  '#0D0E4A',
  navyMid:   'rgba(20,20,100,0.08)',
  red:       '#E8151B',
  redDark:   '#C4111A',
  blue:      '#0078D4',
  blueLight: '#BEDCFF',
  white:     '#FFFFFF',
  bg:        '#FAFAFA',
  bg2:       '#F5F5F5',
  border:    '#E1DFDD',
  border2:   '#CCCCCC',
  text:      '#323130',
  text2:     '#605E5C',
  text3:     '#A19F9D',
  greenBg:   '#D2F5D2',
  orangeBg:  '#FFE6C8',
  redBg:     '#FFC8C8',
  purpleBg:  '#DCD2FF',
  yellowBg:  '#FFD699',
} as const;

export const FONTS = {
  primary: "'Open Sans', 'Segoe UI', sans-serif",
  sizes: { xs: 10, sm: 11, base: 12, md: 13, lg: 16 },
} as const;

export const RADII = { sm: 4, md: 8 } as const;

export const SHADOWS = {
  sm: '0 2px 8px rgba(20,20,100,0.10)',
  lg: '0 4px 20px rgba(20,20,100,0.15)',
} as const;

export const LAYOUT = {
  headerH:  68,
  toolbarH: 48,
  colH:     38,
  rowH:     40,
  sidebarW: 210,
} as const;
