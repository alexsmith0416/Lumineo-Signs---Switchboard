// Small value helpers shared by the engine (ported from LSB Spec Mgt.).
import { OPEN_DESIGN_VALUE, SURVEY_VALUE } from "../domain/types";

/**
 * Rule values: '' = any answer, 'A|B' = A or B, '!A|B' = anything but A or B.
 * Matching is case-insensitive and ignores surrounding spaces.
 */
export function conditionMet(value: string, values: string): boolean {
  const v = (value ?? "").trim().toLowerCase();
  let list = (values ?? "").trim();
  if (list === "") return v !== "";
  const negate = list.startsWith("!");
  if (negate) list = list.slice(1);
  const inList = list.split("|").some((c) => c.trim().toLowerCase() === v);
  return negate ? !inList : inList;
}

export const sameAnswer = (a: string, b: string): boolean =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export const isSurveyValue = (v: string): boolean => sameAnswer(v, SURVEY_VALUE);
export const isOpenDesignValue = (v: string): boolean => sameAnswer(v, OPEN_DESIGN_VALUE);
/** "Needs Survey" / "Open for design": a placeholder, not a real answer yet. */
export const isPendingValue = (v: string): boolean => isSurveyValue(v) || isOpenDesignValue(v);

// ---------------------------------------------------------------------------
// Sizes: feet and inches in, 4’-6” out.
// ---------------------------------------------------------------------------

/** "4' 6", "54", "4ft 6 1/2in", "6-1/4" → inches. Null when unreadable. */
export function parseLength(input: string): number | null {
  let s = (input ?? "").toLowerCase();
  s = s.replace(/[’‘]/g, "'").replace(/[”“]/g, '"').replace(/''/g, '"');
  s = s.replace(/feet|foot|ft/g, "'").replace(/inches|inch|in/g, '"');
  s = s.replace(/[()hwdl]/g, "").trim();
  if (s === "") return null;

  let feet = 0;
  let inchText = s;
  let found = false;
  const apos = s.indexOf("'");
  if (apos >= 0) {
    const feetText = s.slice(0, apos).trim();
    inchText = s.slice(apos + 1);
    if (feetText !== "") {
      const f = Number(feetText);
      if (!Number.isFinite(f)) return null;
      feet = f;
      found = true;
    }
  }
  let inches = 0;
  for (const piece of inchText.replace(/"/g, " ").replace(/-/g, " ").trim().split(/\s+/)) {
    if (piece === "") continue;
    let val: number;
    const slash = piece.indexOf("/");
    if (slash >= 0) {
      const num = Number(piece.slice(0, slash));
      const den = Number(piece.slice(slash + 1));
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
      val = num / den;
    } else {
      val = Number(piece);
      if (!Number.isFinite(val)) return null;
    }
    inches += val;
    found = true;
  }
  return found ? inches + feet * 12 : null;
}

function formatInches(inches: number): string {
  const whole = Math.floor(inches);
  let sixteenths = Math.round((inches - whole) * 16);
  if (sixteenths === 0) return String(whole);
  let den = 16;
  while (sixteenths % 2 === 0 && den > 1) {
    sixteenths /= 2;
    den /= 2;
  }
  const frac = `${sixteenths}/${den}`;
  return whole === 0 ? frac : `${whole} ${frac}`;
}

/** 54 → 4’-6”, 7.5 → 7 1/2”. Rounded to 1/16". */
export function formatLength(totalInches: number): string {
  const t = Math.round(totalInches * 16) / 16;
  if (t < 12) return `${formatInches(t)}”`;
  const feet = Math.floor(t / 12);
  return `${feet}’-${formatInches(t - feet * 12)}”`;
}

/** [48, 96] with "Height|Width" → 4’-0” (H) x 8’-0” (W). */
export function formatSizes(sizes: number[], labels: string): string {
  const names = (labels || "Height|Width|Depth").split("|");
  return sizes
    .map((s, i) => {
      let part = formatLength(s);
      const name = names[i]?.trim();
      if (sizes.length > 1 && name) part += ` (${name.charAt(0).toUpperCase()})`;
      return part;
    })
    .join(" x ");
}

/** Typed sizes ("48x96", "4' x 8'") → inches per part. Throws a user message. */
export function parseSizes(input: string, parts: number): number[] {
  const pieces = input.toLowerCase().replace(/×/g, "x").replace(/\*/g, "x").split("x");
  if (pieces.length > parts) throw new Error(`"${input}" has more sizes than this question asks for (${parts}).`);
  return pieces.map((p) => {
    const v = parseLength(p);
    if (v === null) throw new Error(`Could not read "${input}" as a size. Use the size boxes to fill in feet and inches.`);
    return v;
  });
}
