// BC resource-number → department mapping, verified against the
// Production `resources` output (July 2026). Lumineo's 2000-band
// resources ARE the department labor categories — a planning line whose
// `no` posts to one of these codes belongs to that department, exactly.
// This supersedes keyword matching whenever a resource code is present.
//
// Bands (from the live data):
//   1000s  individual employees (Chris Owen 1030, Terry Heath 1040, …)
//   2000s  department labor categories (this map)
//   4000s  sales staff · 5000s admin/office
//   text   legacy user IDs + estimate placeholders (WK 2 MAN - TBD, …)

import type { DepartmentId } from "../engine/types";

const RESOURCE_DEPT: Record<string, DepartmentId> = {
  // Routing
  "2010": "dept-routing", // Routing Labor
  "2313": "dept-routing", // Routed Face Labor (CNC-routed faces)
  // Metal Fab
  "2011": "dept-metal", // Cabinet Metal Labor
  "2014": "dept-metal", // Letter Metal Labor
  "2099": "dept-metal", // Rework Metal Labor
  // Steel MFG
  "2016": "dept-steel", // Structural Steel Metal Labor
  // Paint
  "2110": "dept-paint", // Paint Prep Labor
  "2112": "dept-paint", // Paint Cabinet & Letters Labor
  "2114": "dept-paint", // Paint Vinyl Faces Labor
  "2116": "dept-paint", // Hand Painting Labor
  "2199": "dept-paint", // Rework Paint Labor
  // Assembly (wiring, faces, crating)
  "2212": "dept-assembly", // LED Wiring Labor
  "2215": "dept-assembly", // Assembly Labor
  "2216": "dept-assembly", // Electronics Wiring & Assembly Labor
  "2217": "dept-assembly", // Crating Labor
  "2299": "dept-assembly", // Rework Wiring & Assembly Labor
  "2312": "dept-assembly", // Plastic Face Labor
  "2314": "dept-assembly", // Trim Cap Labor
  "2315": "dept-assembly", // Face Assembly Labor
  "2316": "dept-assembly", // Flex Face Assembly Labor
  "2399": "dept-assembly", // Rework Face Labor
  // Vinyl / Graphics
  "2412": "dept-vinyl", // Digital Printing Labor
  "2415": "dept-vinyl", // Graphics Cut, Weed & Mask Labor
  "2416": "dept-vinyl", // Graphics Application Labor
  "2499": "dept-vinyl", // Rework Graphics Labor
};

// Estimate-stage placeholder resources ("PAINT - TBD", "FAB - TBD")
// also carry a department signal.
const PLACEHOLDER_DEPT: Array<{ pattern: RegExp; departmentId: DepartmentId }> = [
  { pattern: /^PAINT\s*-\s*TBD/i, departmentId: "dept-paint" },
  { pattern: /^FAB\s*-\s*TBD/i, departmentId: "dept-metal" },
];

/** Exact department for a BC resource code, or null when the code isn't a
 *  department labor category (individual employees, sales, admin, crew
 *  placeholders). */
export function departmentOfResourceNo(resourceNo: string | null | undefined): DepartmentId | null {
  if (!resourceNo) return null;
  const key = resourceNo.trim();
  const hit = RESOURCE_DEPT[key];
  if (hit) return hit;
  for (const p of PLACEHOLDER_DEPT) {
    if (p.pattern.test(key)) return p.departmentId;
  }
  return null;
}

/** Crew-size placeholders encode men-per-trip in the code itself:
 *  "WK 2 MAN - TBD", "NEK 1 MAN - TBD", "SHIP IN WK 2 MAN" → 2 / 1 / 2.
 *  Returns the man-count, or null when the resource isn't a crew
 *  placeholder. */
export function menFromResourceNo(resourceNo: string | null | undefined): number | null {
  if (!resourceNo) return null;
  const m = /(\d+)\s*MAN/i.exec(resourceNo);
  return m ? parseInt(m[1], 10) : null;
}

/** Region signal on crew placeholders ("WK 2 MAN", "NEK 1 MAN"). */
export function regionFromResourceNo(resourceNo: string | null | undefined): "WK" | "NEK" | null {
  if (!resourceNo) return null;
  if (/\bNEK\b/i.test(resourceNo)) return "NEK";
  if (/\bWK\b/i.test(resourceNo)) return "WK";
  return null;
}
