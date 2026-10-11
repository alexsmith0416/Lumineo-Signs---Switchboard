import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useJobRows } from "./useJobRows";
import { useJobTrackingStore } from "../store/job-tracking-store";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";
import { useJobDeptOverrideStore } from "../store/job-dept-override-store";
import { useStepQueueData } from "../store/step-queue-store";
import { stepOrderFor, useJobFlowStore } from "../store/job-flow-store";
import { isServiceJob, useServiceJobsStore } from "../store/service-jobs-store";
import { useInstallationStoreNEK, useInstallationStoreWK } from "../store/schedule-store";
import { useInstallQueueStoreNEK, useInstallQueueStoreWK } from "../store/job-queue-store";
import { positionOf, useJobGeoStore } from "../store/job-geo-store";
import { buildDepartmentSteps } from "../services/production-steps";
import { installWork } from "../services/gameplan";
import { classifyPlannerJob, type PlannerJob } from "../services/install-planner";
import type { Region } from "../services/geo";

/** The Install Job Queue list Admin / Ops fill with the jobs that must be done this week. */
export const MUST_THIS_WEEK = "Must this week";
export const MUST_COLOR = { color: "#E8151B", textColor: "#FFFFFF" };

const regionOf = (r: string): Region => (r.trim().toUpperCase() === "NEK" ? "NEK" : "WK");
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface Card {
  jobNo: string;
  start: Date;
  end: Date;
  locked: boolean;
}

/**
 * Install Planner: every open install / service job with its map position and
 * its state for the week starting `weekStart` (Monday) — from the Jobs list
 * rows, the steppers, BC install planning lines, both install boards, the
 * regions' "Must this week" lists and the saved map positions.
 */
export function usePlannerJobs(weekStart: Date): {
  jobs: PlannerJob[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const rows = useJobRows();
  const stepInfo = useJobTrackingStore((s) => s.stepInfo);
  const completions = useJobDeptCompletionStore((s) => s.byJob);
  const overrides = useJobDeptOverrideStore((s) => s.byJob);
  const flowCompany = useJobFlowStore((s) => s.company);
  const orderTypes = useServiceJobsStore((s) => s.orderTypes);
  const planLines = useStepQueueData((s) => s.lines);
  const scheduled = useStepQueueData((s) => s.scheduled);
  const wkGroups = useInstallQueueStoreWK((s) => s.groups);
  const nekGroups = useInstallQueueStoreNEK((s) => s.groups);
  const geos = useJobGeoStore((s) => s.geos);
  const zips = useJobGeoStore((s) => s.zips);
  const wkDs = useInstallationStoreWK((s) => s.dataSource);
  const nekDs = useInstallationStoreNEK((s) => s.dataSource);

  useEffect(() => {
    void useServiceJobsStore.getState().load();
    void useJobDeptCompletionStore.getState().load();
    void useStepQueueData.getState().load();
    void useInstallQueueStoreWK.getState().load();
    void useInstallQueueStoreNEK.getState().load();
    void useJobGeoStore.getState().load();
  }, []);

  // Install cards on both boards, a margin around the week (a job is
  // "scheduled" if it has a card anywhere in that window).
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadCards = useCallback(async () => {
    try {
      const from = addDays(weekStart, -42);
      const to = addDays(weekStart, 180);
      const [wk, nek] = await Promise.all([wkDs.loadScheduleLines(from, to), nekDs.loadScheduleLines(from, to)]);
      const real = (l: (typeof wk)[number]) => !!l.jobNo && !l.isCustom && !l.shipmentLoadId;
      setCards(
        [...wk, ...nek].filter(real).map((l) => ({ jobNo: l.jobNo, start: l.startDateTime, end: l.endDateTime, locked: l.isLocked })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCards([]);
    }
  }, [wkDs, nekDs, weekStart]);
  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const jobs = useMemo(() => {
    const weekEnd = addDays(weekStart, 7);
    const onBoard = new Set<string>();
    for (const key of scheduled) if (key.endsWith("|Install")) onBoard.add(key.slice(0, -"|Install".length));
    const lockedThisWeek = new Set<string>();
    const firstDate = new Map<string, Date>();
    for (const c of cards ?? []) {
      onBoard.add(c.jobNo);
      if (c.locked && c.start < weekEnd && c.end >= weekStart) lockedThisWeek.add(c.jobNo);
      const prev = firstDate.get(c.jobNo);
      if (!prev || c.start < prev) firstDate.set(c.jobNo, c.start);
    }
    const mustOf = (groups: typeof wkGroups) =>
      new Set(groups.filter((g) => sameName(g.name, MUST_THIS_WEEK)).flatMap((g) => g.items.map((i) => i.jobNo)));
    const must = { WK: mustOf(wkGroups), NEK: mustOf(nekGroups) };

    const out: PlannerJob[] = [];
    for (const r of rows) {
      const info = stepInfo.get(r.jobNo) ?? { production: [], hasInstall: false };
      const service = isServiceJob(r.jobNo);
      const steps = buildDepartmentSteps(
        info.production,
        new Set(Object.keys(completions[r.jobNo] ?? {})),
        info.hasInstall,
        overrides[r.jobNo] ?? {},
        stepOrderFor(r.jobNo),
        service,
      );
      const region = regionOf(r.installRegion || r.region);
      const c = classifyPlannerJob({
        tracked: r.tracked,
        inBc: r.inBc,
        status: r.status,
        steps,
        service,
        lockedThisWeek: lockedThisWeek.has(r.jobNo),
        onBoard: onBoard.has(r.jobNo),
        mustThisWeek: must[region].has(r.jobNo),
      });
      if (!c) continue;
      const { pos, approx } = positionOf({ geos, zips }, { jobNo: r.jobNo, shipTo: r.shipTo });
      const first = firstDate.get(r.jobNo);
      out.push({
        jobNo: r.jobNo,
        name: r.name,
        kind: c.kind,
        region,
        state: c.state,
        pos,
        approx,
        address: [r.shipTo.address, r.location].filter(Boolean).join(", "),
        zip: (r.shipTo.zip ?? "").slice(0, 5),
        crewHours: installWork((planLines.get(r.jobNo) ?? []).filter((l) => l.isInstall)).hours,
        scheduledDate: first ? format(first, "yyyy-MM-dd") : "",
      });
    }
    return out;
    // flowCompany / orderTypes: a changed flow or order type changes the steps.
  }, [rows, stepInfo, completions, overrides, flowCompany, orderTypes, planLines, scheduled, cards, wkGroups, nekGroups, geos, zips, weekStart]);

  // Look up (in the background) the jobs whose map position is missing or stale.
  useEffect(() => {
    const onMap = new Set(jobs.map((j) => j.jobNo));
    useJobGeoStore.getState().ensure(rows.filter((r) => onMap.has(r.jobNo)).map((r) => ({ jobNo: r.jobNo, shipTo: r.shipTo })));
  }, [jobs, rows]);

  return { jobs, loading: cards === null || !zips, error, reload: () => void loadCards() };
}
