/**
 * Install Planner Stage 3 — a saved week plan and comparing two (pure).
 * Oct 11, 2026. Stored as JSON in Dataverse crfdf_installplan
 * (scripts/create-installplan-table.ps1).
 */
import type { Assignment, WeekStats } from "./week-plan";

export interface PlanOptions {
  radiusMi: number;
  combineService: boolean;
  allowOvernight: boolean;
  maxNights: number;
  crossRegions: boolean;
  startHour: number;
  /** "WK" / "NEK" / "both". */
  region: string;
  /** What fills the free time first (absent on plans saved before Oct 11 = dollars). */
  priority?: "dollars" | "jobs";
  /** Past-due jobs counted as firm. */
  pastDueFirm?: boolean;
}

export interface SavedPlan {
  id: string;
  name: string;
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  options: PlanOptions;
  assignments: Assignment[];
  unplaced: Array<{ jobNo: string; name: string; must: boolean; reason: string }>;
  stats: WeekStats;
  savedBy: string;
  /** ISO. */
  savedAt: string;
  /** ISO when it was committed to the install board; "" = not yet. */
  committedAt: string;
}

/** The figures compared side by side (label, value of A, value of B, higher is better?). */
export const COMPARE_ROWS: ReadonlyArray<{ key: keyof WeekStats; label: string; better: "more" | "less" }> = [
  { key: "value", label: "$ planned", better: "more" },
  { key: "jobs", label: "Jobs planned", better: "more" },
  { key: "mustJobs", label: "Must / Planned this week placed", better: "more" },
  { key: "crewHours", label: "Crew hours on site", better: "more" },
  { key: "driveHours", label: "Drive hours", better: "less" },
  { key: "miles", label: "Miles", better: "less" },
  { key: "nights", label: "Nights away", better: "less" },
  { key: "crewDays", label: "Crew-days used", better: "less" },
  { key: "unplaced", label: "Didn't fit", better: "less" },
];

const jobsOf = (p: Pick<SavedPlan, "assignments">) => new Set(p.assignments.flatMap((a) => a.trip.stops.map((s) => s.jobNo)));

/** Which plan wins each row ("a" / "b" / "" for a tie), and the jobs only one of them plans. */
export function comparePlans(
  a: Pick<SavedPlan, "assignments" | "stats">,
  b: Pick<SavedPlan, "assignments" | "stats">,
): { rows: Array<{ label: string; a: number; b: number; winner: "a" | "b" | "" }>; onlyA: string[]; onlyB: string[] } {
  const rows = COMPARE_ROWS.map((r) => {
    const va = a.stats[r.key] ?? 0;
    const vb = b.stats[r.key] ?? 0;
    const diff = Math.abs(va - vb) < 0.05 ? 0 : va - vb;
    const winner: "a" | "b" | "" = diff === 0 ? "" : (diff > 0) === (r.better === "more") ? "a" : "b";
    return { label: r.label, a: va, b: vb, winner };
  });
  const ja = jobsOf(a);
  const jb = jobsOf(b);
  return {
    rows,
    onlyA: [...ja].filter((j) => !jb.has(j)).sort(),
    onlyB: [...jb].filter((j) => !ja.has(j)).sort(),
  };
}
