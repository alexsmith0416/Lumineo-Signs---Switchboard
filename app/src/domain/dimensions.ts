// Dimensions are stored on the SignSpec as a string holding the TOTAL
// INCHES (e.g. "42" = 3 ft 6 in). The total-inches representation keeps:
//
//  - the sqft math simple (H × L ÷ 144),
//  - the Estimating handoff unchanged (docs/estimating-integration.md
//    spec'd heightIn / lengthIn as inches and the workbook formulas use
//    inches),
//  - one canonical value per dimension, no two-of-truth ambiguity.
//
// The UI side splits into a "feet" textbox + an "inches" textbox via the
// DimensionInput component. These helpers convert between the two
// representations.

/** Total inches as a string → { ft, in } values for the two text boxes.
    Returns blank strings when total is empty / zero so placeholders show. */
export function splitFtIn(totalInches: string | number): { ft: string; in: string } {
  const n = typeof totalInches === "number" ? totalInches : Number(totalInches);
  if (!isFinite(n) || n <= 0) return { ft: "", in: "" };
  const ft = Math.floor(n / 12);
  const inches = round3(n - ft * 12);
  return {
    ft: ft === 0 ? "" : String(ft),
    in: inches === 0 ? "" : String(inches),
  };
}

/** { ft, in } user-entered strings → total inches as a string. Returns ""
    when both inputs are blank so the field can round-trip back to empty. */
export function joinFtIn(ft: string, inches: string): string {
  const f = Number(ft);
  const i = Number(inches);
  const fSafe = isFinite(f) ? f : 0;
  const iSafe = isFinite(i) ? i : 0;
  if (!ft.trim() && !inches.trim()) return "";
  const total = round3(fSafe * 12 + iSafe);
  return total === 0 ? "" : String(total);
}

/** Pretty-print total inches as a feet-inches string for display in the
    export HTML, the ballpark modal, etc. Examples:
      "0"  →  "—"
      "42" →  '3'6"'
      "36" →  '3'0"'
      "10" →  '0'10"'
      "6.5"→  '0'6.5"'  */
export function formatDimension(totalInches: string | number | undefined | null): string {
  if (totalInches === "" || totalInches == null) return "—";
  const n = typeof totalInches === "number" ? totalInches : Number(totalInches);
  if (!isFinite(n) || n <= 0) return "—";
  const ft = Math.floor(n / 12);
  const inches = round3(n - ft * 12);
  // Always emit a feet number so the format is consistent even for sub-foot
  // dimensions (the depth column is often 6"-12" for cabinets).
  return `${ft}'${formatInches(inches)}"`;
}

function formatInches(n: number): string {
  // Strip trailing zeros without dropping meaningful decimals like 0.5.
  if (Number.isInteger(n)) return String(n);
  return String(n).replace(/\.?0+$/, "");
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Compose all three sign-spec dimensions into a single label, e.g.
    `3'6" × 10'0" × 1'0"`. Skips the depth segment when depth is empty. */
export function formatHWD(heightIn: string, widthIn: string, depthIn: string): string {
  const parts = [heightIn, widthIn, depthIn].filter((v) => v && v !== "0");
  if (parts.length === 0) return "—";
  return parts.map(formatDimension).join(" × ");
}
