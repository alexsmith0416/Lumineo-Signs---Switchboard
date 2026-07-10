import type { DepartmentId } from "../engine/types";

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

export interface MappedPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
  departmentId: DepartmentId | null;
  resourceNo?: string;
}

export function mapPlanningLine(description: string): DepartmentId | null {
  for (const rule of RULES) {
    if (rule.pattern.test(description)) return rule.departmentId;
  }
  return null;
}

export function mapPlanningLines(
  lines: Array<{ lineNo: number; description: string; estimatedHours: number; resourceNo?: string }>,
): MappedPlanningLine[] {
  return lines.map((l) => ({
    ...l,
    departmentId: mapPlanningLine(l.description),
  }));
}

/** Production job-task resources are BC resource codes in the 2000–2999 band
 *  (fabrication labor categories). Everything else — crew placeholders, install
 *  travel, etc. — is installation. Used to split the Add Job line list by the
 *  calendar's kind. A line with no/blank resource code counts as installation. */
export function isProductionResource(resourceNo: string | null | undefined): boolean {
  const num = parseInt((resourceNo ?? "").trim(), 10);
  return Number.isFinite(num) && num >= 2000 && num < 3000;
}
