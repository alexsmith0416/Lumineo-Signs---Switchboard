/**
 * Install Planner Stage 3 — the week's crews and their busy days, read from
 * both install boards. Oct 11, 2026.
 *
 * A crew = an install-board lane at a Lumineo location crews start from
 * (Hutchinson, Wichita, Dodge City, Olathe, Topeka, Lawrence) — NOT production
 * staff lent for the week (assist rows) and NOT the "Additional Jobs" group.
 * The week's roster moves ("just this week") are applied first, like the board.
 * A crew-day is busy when any card (job, block-out, PTO) is on it.
 */
import { addDays, format } from "date-fns";
import type { ScheduleDataSource } from "./data-source";
import { applyRosterOverrides, getRosterOverrideDataSource } from "./roster-overrides";
import { LUMINEO_LOCATIONS, type Region } from "./geo";
import { WEEK_DAYS, type PlanCrew } from "./week-plan";

export interface WeekCrews {
  crews: PlanCrew[];
  busy: Map<string, Set<number>>;
  /** Crew id → its board lane's department (location) id, for the cards Commit makes. */
  deptOf: Map<string, string>;
  /** Crew id → region (which board). */
  regionOf: Map<string, Region>;
}

export async function loadWeekCrews(
  weekStart: Date,
  boards: ReadonlyArray<{ region: Region; boardKind: string; ds: Pick<ScheduleDataSource, "loadEmployees" | "loadDepartments" | "loadScheduleLines"> }>,
): Promise<WeekCrews> {
  const out: WeekCrews = { crews: [], busy: new Map(), deptOf: new Map(), regionOf: new Map() };
  const weekEnd = addDays(weekStart, WEEK_DAYS);
  for (const b of boards) {
    const [employees, departments, cards, overrides] = await Promise.all([
      b.ds.loadEmployees(),
      b.ds.loadDepartments(),
      b.ds.loadScheduleLines(weekStart, weekEnd),
      getRosterOverrideDataSource()
        .load(b.boardKind, format(weekStart, "yyyy-MM-dd"))
        .catch(() => []),
    ]);
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const roster = applyRosterOverrides(new Map(employees.map((e) => [e.id, e])), overrides);
    for (const e of roster.values()) {
      if (e.isAssist) continue;
      const loc = LUMINEO_LOCATIONS.find((l) => l.crewBase && l.name === deptName.get(e.departmentId));
      if (!loc) continue; // "Additional Jobs" and anything that isn't a crew location
      out.crews.push({ id: e.id, name: e.name, base: loc.name, region: b.region });
      out.deptOf.set(e.id, e.departmentId);
      out.regionOf.set(e.id, b.region);
    }
    for (const c of cards) {
      if (!c.employeeId) continue;
      for (let d = 0; d < WEEK_DAYS; d++) {
        const from = addDays(weekStart, d);
        const to = addDays(weekStart, d + 1);
        if (c.startDateTime < to && c.endDateTime > from) {
          const set = out.busy.get(c.employeeId) ?? new Set<number>();
          set.add(d);
          out.busy.set(c.employeeId, set);
        }
      }
    }
  }
  return out;
}
