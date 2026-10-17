// "→ HUT" on the Production board (Oct 17, 2026): a card on an NEK production
// person (Aaron Waters, Lawrence — vinyl) whose job also goes through Hutchinson
// production — it has cards on WK production people, or its Jobs list Mfg
// Region is WK — so the vinyl he makes is for a job built in Hutchinson. Pure.

import { format } from "date-fns";
import type { ScheduleLine } from "../engine/types";
import type { Region } from "./geo";

export interface CrossSiteBadge {
  text: string;
  title: string;
}

export function crossSiteBadges(input: {
  lines: readonly ScheduleLine[];
  regionOf: (employeeId: string) => Region;
  deptName: (departmentId: string) => string;
  /** The job's Jobs list Mfg Region ("WK" / "NEK" / ""). */
  mfgRegionOf: (jobNo: string) => string;
}): Map<string, CrossSiteBadge> {
  const out = new Map<string, CrossSiteBadge>();
  // Each job's WK production cards, earliest first.
  const wkByJob = new Map<string, ScheduleLine[]>();
  for (const l of input.lines) {
    if (!l.jobNo || l.isCustom || l.mirrorOf || input.regionOf(l.employeeId) !== "WK") continue;
    wkByJob.set(l.jobNo, [...(wkByJob.get(l.jobNo) ?? []), l]);
  }
  for (const l of input.lines) {
    if (!l.jobNo || l.isCustom || l.mirrorOf || input.regionOf(l.employeeId) !== "NEK") continue;
    const wk = (wkByJob.get(l.jobNo) ?? []).sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    if (wk.length) {
      const steps = wk.map((w) => `${input.deptName(w.departmentId)} ${format(w.startDateTime, "EEE MMM d")}`);
      out.set(l.id, { text: "→ HUT", title: `For a job in Hutchinson production: ${[...new Set(steps)].join(", ")}` });
    } else if (input.mfgRegionOf(l.jobNo).trim().toUpperCase() === "WK") {
      out.set(l.id, { text: "→ HUT", title: "For a job built in Hutchinson (Mfg Region WK on the Jobs list)" });
    }
  }
  return out;
}
