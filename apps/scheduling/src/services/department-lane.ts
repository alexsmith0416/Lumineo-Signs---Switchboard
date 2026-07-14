import type { Department, Employee, ScheduleLine } from "../engine/types";

/**
 * Department-wide ("team") scheduling support.
 *
 * A team job is a schedule line assigned to a whole department instead of one
 * person (`departmentWide: true`). On the board it lives on a shared lane under
 * the department banner; in each member's My Schedule it appears alongside their
 * personal jobs.
 *
 * To reuse the existing per-resource cascade with zero engine changes, each
 * department lane is modelled as a synthetic "employee" whose id encodes the
 * department. These synthetic employees are NEVER put in the store's real
 * `employees` map (so rosters, counts, pickers and capacity stay person-only) —
 * they are merged into the engine ScheduleContext only, via `laneEmployeesFor`.
 */

const LANE_PREFIX = "dept-lane:";

/** The synthetic resource id that owns a department's team lane. */
export function laneEmployeeId(departmentId: string): string {
  return `${LANE_PREFIX}${departmentId}`;
}

export function isLaneEmployeeId(id: string): boolean {
  return id.startsWith(LANE_PREFIX);
}

/** The department id encoded in a lane employee id. */
export function laneDeptId(id: string): string {
  return id.slice(LANE_PREFIX.length);
}

/** Build the synthetic "whole department" resource for a department. Standard
 *  8h/day, no weekends, productivity 1 — the lane behaves like one resource so
 *  its team jobs queue against each other but never against a person. */
export function makeLaneEmployee(dept: Department): Employee {
  return {
    id: laneEmployeeId(dept.id),
    name: "Whole department",
    departmentId: dept.id,
    productivityRate: 1,
    standardHoursPerDay: 8,
    maxOvertimePerDay: 0,
    worksWeekends: false,
    isDepartmentLane: true,
  };
}

/** Lane employees for every department that currently has a team line. Merged
 *  into the engine context so team lines resolve to a resource for end-time and
 *  cascade math. Empty when no team jobs exist (the common case). */
export function laneEmployeesFor(
  schedule: ScheduleLine[],
  departments: Map<string, Department>,
): Map<string, Employee> {
  const out = new Map<string, Employee>();
  for (const line of schedule) {
    if (!line.departmentWide) continue;
    const id = laneEmployeeId(line.departmentId);
    if (out.has(id)) continue;
    const dept = departments.get(line.departmentId);
    if (dept) out.set(id, makeLaneEmployee(dept));
  }
  return out;
}
