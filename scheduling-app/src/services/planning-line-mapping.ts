import type { DepartmentId } from "../engine/types";

// Keyword-based fallback mapping. Production uses the Dataverse
// `crfdf_planninglinedepartmentmap` table; this is a deterministic
// reproduction that we can use until the table is wired in.
const RULES: Array<{ pattern: RegExp; departmentId: DepartmentId }> = [
  { pattern: /\b(metal|fabricat(e|ion)|weld|cut|raceway|channel letter|blank|cabinet|cnc|brake)\b/i, departmentId: "dept-metal" },
  { pattern: /\b(paint|prime|topcoat|powder coat|coat)\b/i, departmentId: "dept-paint" },
  { pattern: /\b(assembl(e|y)|wir(e|ing)|led|mount|final|install)\b/i, departmentId: "dept-assembly" },
  { pattern: /\b(vinyl|graphic|decal|braille|wrap)\b/i, departmentId: "dept-vinyl" },
];

export interface MappedPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
  departmentId: DepartmentId | null;
}

export function mapPlanningLine(description: string): DepartmentId | null {
  for (const rule of RULES) {
    if (rule.pattern.test(description)) return rule.departmentId;
  }
  return null;
}

export function mapPlanningLines(
  lines: Array<{ lineNo: number; description: string; estimatedHours: number }>,
): MappedPlanningLine[] {
  return lines.map((l) => ({
    ...l,
    departmentId: mapPlanningLine(l.description),
  }));
}
