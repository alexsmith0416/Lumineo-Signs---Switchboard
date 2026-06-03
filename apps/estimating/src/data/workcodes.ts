// AUTO-GENERATED from reference/estimating/Sign365 LN Estimate Template - Blank.xlsx
// Generated 2026-06-03T12:31:51Z by scripts/extract-workbook.py
// DO NOT EDIT BY HAND — re-run `npm run extract:estimating` to refresh.

export interface WorkCode {
  readonly code: number;
  readonly description: string;
  readonly hourlyRate: number;
}

/** Shop labor rate as of the workbook's 'effective 1-1-26' increase. */
export const SHOP_LABOR_RATE = 97.0;

export const WORK_CODES: readonly WorkCode[] = Object.freeze([
  { code: 2010, description: "Routing Labor", hourlyRate: 97.0 },
  { code: 2011, description: "Cabinet Metal Labor", hourlyRate: 97.0 },
  { code: 2014, description: "Letter Metal Labor", hourlyRate: 97.0 },
  { code: 2016, description: "Structural Steel Metal Labor", hourlyRate: 97.0 },
  { code: 2099, description: "Rework Metal Labor", hourlyRate: 97.0 },
  { code: 2110, description: "Paint Prep Labor", hourlyRate: 97.0 },
  { code: 2112, description: "Paint Cabinet & Letters Labor", hourlyRate: 97.0 },
  { code: 2114, description: "Paint Vinyl Faces Labor", hourlyRate: 97.0 },
  { code: 2116, description: "Hand Painting Labor", hourlyRate: 97.0 },
  { code: 2199, description: "Rework Paint Labor", hourlyRate: 97.0 },
  { code: 2212, description: "LED Wiring Labor", hourlyRate: 97.0 },
  { code: 2215, description: "Assembly Labor", hourlyRate: 97.0 },
  { code: 2216, description: "Electronics Wiring & Assembly Labor", hourlyRate: 97.0 },
  { code: 2217, description: "Crating Labor", hourlyRate: 97.0 },
  { code: 2299, description: "Rework Wiring & Assembly Labor", hourlyRate: 97.0 },
  { code: 2312, description: "Plastic Face Labor", hourlyRate: 97.0 },
  { code: 2313, description: "Routed Face Labor", hourlyRate: 97.0 },
  { code: 2314, description: "Trim Cap Labor", hourlyRate: 97.0 },
  { code: 2315, description: "Face Assembly Labor", hourlyRate: 97.0 },
  { code: 2316, description: "Flex Face Assembly Labor", hourlyRate: 97.0 },
  { code: 2399, description: "Rework Face Labor", hourlyRate: 97.0 },
  { code: 2412, description: "Digital Printing Labor", hourlyRate: 97.0 },
  { code: 2415, description: "Graphics Cut Weed & Mask Labor", hourlyRate: 97.0 },
  { code: 2416, description: "Graphics Application Labor", hourlyRate: 97.0 },
  { code: 2499, description: "Rework Graphics Labor", hourlyRate: 97.0 },
] as const);

export const WORK_CODES_BY_CODE: ReadonlyMap<number, WorkCode> = new Map(
  WORK_CODES.map(wc => [wc.code, wc])
);
