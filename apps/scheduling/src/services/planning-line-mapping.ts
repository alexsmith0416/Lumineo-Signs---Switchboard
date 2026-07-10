import type { Department, DepartmentId } from "../engine/types";

// Keyword-based fallback mapping. Production uses the Dataverse
// `crfdf_planninglinedepartmentmap` table; this is a deterministic
// reproduction that we can use until the table is wired in.
const RULES: Array<{ pattern: RegExp; departmentId: DepartmentId }> = [
  { pattern: /\b(steel|sub[- ]?structure|i[- ]?beam|structural)\b/i, departmentId: "dept-steel" },
  { pattern: /\b(cnc|rout(e|er|ing)|acm|mdf|pvc panel)\b/i, departmentId: "dept-routing" },
  { pattern: /\b(metal|fabricat(e|ion)|weld|cut|raceway|channel letter|blank|cabinet|brake)\b/i, departmentId: "dept-metal" },
  { pattern: /\b(paint|prime|topcoat|powder coat|coat)\b/i, departmentId: "dept-paint" },
  { pattern: /\b(vinyl|graphic|decal|braille|wrap)\b/i, departmentId: "dept-vinyl" },
  { pattern: /\b(assembl(e|y)|wir(e|ing)|led|mount|final|install)\b/i, departmentId: "dept-assembly" },
];

// Canonical department display names, keyed by the internal slug. These are the
// names the live crfdf_department1 rows carry (and the mock departments too), so
// they let us resolve a mapped line to the ACTUAL loaded department by name —
// live departments are keyed by GUID, not slug, so a slug can't be looked up
// directly. (see resolveDepartmentId)
const DEPT_NAME: Record<DepartmentId, string> = {
  "dept-routing": "Routing",
  "dept-metal": "Metal Fab",
  "dept-steel": "Steel MFG",
  "dept-paint": "Paint",
  "dept-assembly": "Assembly",
  "dept-vinyl": "Vinyl / Graphics",
};

// Exact BC resource-code → department, verified against the Production
// `resources` output (July 2026). Lumineo's 2000-band resources ARE the
// department labor categories, so a planning line whose `no` posts to one of
// these codes belongs to that department exactly — this supersedes the keyword
// guess whenever a resource code is present.
const RESOURCE_DEPT: Record<string, DepartmentId> = {
  // Routing
  "2010": "dept-routing", "2313": "dept-routing",
  // Metal Fab
  "2011": "dept-metal", "2014": "dept-metal", "2099": "dept-metal",
  // Steel MFG
  "2016": "dept-steel",
  // Paint
  "2110": "dept-paint", "2112": "dept-paint", "2114": "dept-paint",
  "2116": "dept-paint", "2199": "dept-paint",
  // Assembly (wiring, faces, crating)
  "2212": "dept-assembly", "2215": "dept-assembly", "2216": "dept-assembly",
  "2217": "dept-assembly", "2299": "dept-assembly", "2312": "dept-assembly",
  "2314": "dept-assembly", "2315": "dept-assembly", "2316": "dept-assembly",
  "2399": "dept-assembly",
  // Vinyl / Graphics
  "2412": "dept-vinyl", "2415": "dept-vinyl", "2416": "dept-vinyl", "2499": "dept-vinyl",
};

export interface MappedPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
  departmentId: DepartmentId | null;
  resourceNo?: string;
  jobTaskNo?: string;
}

export function mapPlanningLine(description: string): DepartmentId | null {
  for (const rule of RULES) {
    if (rule.pattern.test(description)) return rule.departmentId;
  }
  return null;
}

export function mapPlanningLines(
  lines: Array<{ lineNo: number; description: string; estimatedHours: number; resourceNo?: string; jobTaskNo?: string }>,
): MappedPlanningLine[] {
  return lines.map((l) => ({
    ...l,
    departmentId: mapPlanningLine(l.description),
  }));
}

/** Canonical department NAME for a planning line: the exact resource-code map
 *  wins, then the keyword guess on the description. Returns null when neither
 *  resolves (e.g. crew placeholders, install travel). Name — not slug — so it
 *  can be matched against the actually-loaded departments (live = GUID-keyed). */
export function departmentNameForLine(
  resourceNo: string | null | undefined,
  description: string,
): string | null {
  const slug = RESOURCE_DEPT[(resourceNo ?? "").trim()] ?? mapPlanningLine(description);
  return slug ? DEPT_NAME[slug] ?? null : null;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Resolve a canonical department name to an actual loaded department id.
 *  Matches by normalized name (exact, then either-way contains) so it works
 *  whether departments are the mock slug-keyed set or the live GUID-keyed set,
 *  and tolerates minor naming differences ("Vinyl" vs "Vinyl / Graphics"). */
export function resolveDepartmentId(
  name: string | null | undefined,
  departments: Map<DepartmentId, Department>,
): DepartmentId | null {
  if (!name) return null;
  const target = norm(name);
  let contains: DepartmentId | null = null;
  for (const d of departments.values()) {
    const dn = norm(d.name);
    if (dn === target) return d.id;
    if (contains == null && (dn.includes(target) || target.includes(dn))) contains = d.id;
  }
  return contains;
}

// BC resource codes (crfdf_no) that are neither production nor schedulable
// installation labor — hidden from Add Job on every calendar.
const NON_SCHEDULABLE_RESOURCES = new Set([
  "1110", // Sketch Resource labor
]);

/** Production labor: a BC resource code (crfdf_no) in the 2000-band
 *  (2000–2999). These are the shop fabrication labor categories. */
export function isProductionResource(resourceNo: string | null | undefined): boolean {
  const num = parseInt((resourceNo ?? "").trim(), 10);
  return Number.isFinite(num) && num >= 2000 && num < 3000;
}

/** Installation labor: any resource OUTSIDE the production 2000-band — crew
 *  placeholders, install travel, blank codes — minus the non-schedulable
 *  exclusions (e.g. 1110 Sketch Resource labor, which shows on neither board). */
export function isInstallResource(resourceNo: string | null | undefined): boolean {
  if (isProductionResource(resourceNo)) return false;
  return !NON_SCHEDULABLE_RESOURCES.has((resourceNo ?? "").trim());
}
