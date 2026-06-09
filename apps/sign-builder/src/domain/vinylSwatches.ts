// 3M vinyl color libraries used by Step 8.
// - 3M 3630 Translucent shows when the sign is internally or externally illuminated
// - 3M 7725 Opaque shows when the sign is non-illuminated
//
// Color hex values are approximations of the printed Pantone swatch — they are
// for on-screen preview only and not a manufacturing source of truth.

export type VinylSeries = "3630" | "7725";

export type VinylSwatch = {
  series: VinylSeries;
  code: string; // 3-digit color code, e.g. "010"
  name: string;
  hex: string;
};

export const VINYL_3630: VinylSwatch[] = [
  { series: "3630", code: "022", name: "Black",         hex: "#1A1A1A" },
  { series: "3630", code: "010", name: "White",         hex: "#F5F5F5" },
  { series: "3630", code: "053", name: "Cardinal Red",  hex: "#9B1C2E" },
  { series: "3630", code: "087", name: "Cobalt Blue",   hex: "#1B3F8B" },
  { series: "3630", code: "036", name: "Cyan Blue",     hex: "#0074C8" },
  { series: "3630", code: "076", name: "Emerald Green", hex: "#1A7A4A" },
  { series: "3630", code: "025", name: "Golden Yellow", hex: "#F4B400" },
  { series: "3630", code: "044", name: "Orange",        hex: "#E8651A" },
  { series: "3630", code: "078", name: "Burgundy",      hex: "#6D1E3A" },
  { series: "3630", code: "049", name: "Purple",        hex: "#5C3478" },
  { series: "3630", code: "106", name: "Mint Green",    hex: "#4DAB82" },
  { series: "3630", code: "015", name: "Lemon Yellow",  hex: "#F7E44D" },
];

export const VINYL_7725: VinylSwatch[] = [
  { series: "7725", code: "12",  name: "Black",         hex: "#1A1A1A" },
  { series: "7725", code: "10",  name: "White",         hex: "#F5F5F5" },
  { series: "7725", code: "13",  name: "Bright Red",    hex: "#D42B2B" },
  { series: "7725", code: "97",  name: "Royal Blue",    hex: "#1E3FA0" },
  { series: "7725", code: "87",  name: "Sky Blue",      hex: "#3E8FCB" },
  { series: "7725", code: "67",  name: "Forest Green",  hex: "#2A6B3E" },
  { series: "7725", code: "25",  name: "Sunflower",     hex: "#F0C420" },
  { series: "7725", code: "44",  name: "Burnt Orange",  hex: "#C95E1A" },
  { series: "7725", code: "78",  name: "Maroon",        hex: "#6B1E2A" },
  { series: "7725", code: "49",  name: "Violet",        hex: "#562B7A" },
  { series: "7725", code: "337", name: "Teal",          hex: "#1A8A78" },
  { series: "7725", code: "60",  name: "Cream",         hex: "#F2E9CC" },
];

export function swatchDisplayName(s: VinylSwatch): string {
  return `3M ${s.series} — ${s.code} ${s.name}`;
}

export function matchesVinylSearch(s: VinylSwatch, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return (
    s.name.toLowerCase().includes(needle) ||
    s.code.toLowerCase().includes(needle) ||
    s.series.includes(needle) ||
    swatchDisplayName(s).toLowerCase().includes(needle)
  );
}
