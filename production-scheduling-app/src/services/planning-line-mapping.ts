import type { DepartmentId } from "../engine/types";
import { departmentOfResourceNo } from "./resource-department-map";

// Department resolution for planning lines, in priority order:
//   1. Resource code (planning line `no`) — Lumineo's 2000-band resources
//      ARE the department labor categories (2011 Cabinet Metal → Metal
//      Fab, 2112 Paint Cabinet & Letters → Paint, …). Exact.
//   2. Keyword rules on the description — fallback for lines that post
//      to an individual employee or a placeholder resource.
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
}

export function mapPlanningLine(description: string): DepartmentId | null {
  for (const rule of RULES) {
    if (rule.pattern.test(description)) return rule.departmentId;
  }
  return null;
}

/** Resource-code-first resolution; keyword fallback. */
export function resolveDepartment(line: {
  description: string;
  resourceNo?: string | null;
}): DepartmentId | null {
  const byResource = departmentOfResourceNo(line.resourceNo);
  if (byResource) return byResource;
  return mapPlanningLine(line.description);
}

export function mapPlanningLines<
  T extends { lineNo: number; description: string; estimatedHours: number; resourceNo?: string },
>(lines: T[]): Array<T & { departmentId: DepartmentId | null }> {
  return lines.map((l) => ({
    ...l,
    departmentId: resolveDepartment(l),
  }));
}
