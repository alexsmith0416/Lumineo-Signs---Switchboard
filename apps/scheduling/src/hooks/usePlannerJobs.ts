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
import { installWork, neededByOf } from "../services/gameplan";
import { classifyPlannerJob, type PlannerJob } from "../services/install-planner";
import type { JobRow } from "../services/job-tracking";
import type { StepPlanningLine } from "../services/step-queue";
import type { LatLng, Region } from "../services/geo";
import type { JobGeo } from "../services/geocode";

/** The Install Job Queue list Admin / Ops fill with the jobs that must be done this week. */
export const MUST_THIS_WEEK = "Must this week";
export const MUST_COLOR = { color: "#E8151B", textColor: "#FFFFFF" };

const regionOf = (r: string): Region => (r.trim().toUpperCase() === "NEK" ? "NEK" : "WK");
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export interface PlannerCard {
  jobNo: string;
  start: Date;
  end: Date;
  locked: boolean;
}

/** Everything the planner's job list is built from (loaded once, any week). */
export interface PlannerInputs {
  rows: readonly JobRow[];
  stepsFor: (jobNo: string) => ReturnType<typeof buildDepartmentSteps>;
  planLines: ReadonlyMap<string, readonly StepPlanningLine[]>;
  /** Jobs with an install step queued as scheduled (BC step queue). */
  scheduledKeys: ReadonlySet<string>;
  /** Install cards on both boards in the loaded window. */
  cards: readonly PlannerCard[];
  /** Each region's Must this week list. */
  must: Record<Region, ReadonlySet<string>>;
  geos: ReadonlyMap<string, JobGeo>;
  zips: ReadonlyMap<string, LatLng> | null;
}

/**
 * Every open install / service job for the week starting `weekStart`
 * (Monday): its state (Must / Planned this week / locked / scheduled / ready /
 * in production), position, crew hours, value and how late it is. Pure — the
 * same for the Planner and Monthly Gameplanning's week check.
 */
export function buildPlannerJobs(inp: PlannerInputs, weekStart: Date, today = new Date()): PlannerJob[] {
  const weekEnd = addDays(weekStart, 7);
  const from = ymd(weekStart);
  const to = ymd(weekEnd);
  const todayYmd = ymd(today);
  const onBoard = new Set<string>();
  for (const key of inp.scheduledKeys) if (key.endsWith("|Install")) onBoard.add(key.slice(0, -"|Install".length));
  const lockedThisWeek = new Set<string>();
  const firstDate = new Map<string, Date>();
  for (const c of inp.cards) {
    onBoard.add(c.jobNo);
    if (c.locked && c.start < weekEnd && c.end >= weekStart) lockedThisWeek.add(c.jobNo);
    const prev = firstDate.get(c.jobNo);
    if (!prev || c.start < prev) firstDate.set(c.jobNo, c.start);
  }

  const out: PlannerJob[] = [];
  for (const r of inp.rows) {
    const service = isServiceJob(r.jobNo);
    const region = regionOf(r.installRegion || r.region);
    const c = classifyPlannerJob({
      tracked: r.tracked,
      inBc: r.inBc,
      status: r.status,
      steps: inp.stepsFor(r.jobNo),
      service,
      lockedThisWeek: lockedThisWeek.has(r.jobNo),
      onBoard: onBoard.has(r.jobNo),
      mustThisWeek: inp.must[region].has(r.jobNo),
      plannedThisWeek: !!r.scheduledInstall && r.scheduledInstall >= from && r.scheduledInstall < to,
    });
    if (!c) continue;
    const { pos, approx } = positionOf({ geos: inp.geos as Map<string, JobGeo>, zips: inp.zips as Map<string, LatLng> | null }, { jobNo: r.jobNo, shipTo: r.shipTo });
    const first = firstDate.get(r.jobNo);
    const needed = neededByOf(r).date;
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
      crewHours: installWork((inp.planLines.get(r.jobNo) ?? []).filter((l) => l.isInstall)).hours,
      scheduledDate: first ? ymd(first) : "",
      value: r.remaining != null && r.remaining > 0 ? r.remaining : r.value ?? 0,
      neededBy: needed,
      daysLate: needed && needed < todayYmd ? Math.round((today.getTime() - new Date(`${needed}T00:00:00`).getTime()) / 86_400_000) : 0,
    });
  }
  return out;
}

/**
 * Load everything the planner needs: the Jobs list rows, steppers, BC install
 * planning lines, both install boards' cards for [from, to), the Must this
 * week lists and the saved map positions. Shared by the Install Planner and
 * Monthly Gameplanning.
 */
export function usePlannerInputs(from: Date, to: Date): { inputs: PlannerInputs; loading: boolean; error: string | null; reload: () => void } {
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

  const [cards, setCards] = useState<PlannerCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fromKey = from.getTime();
  const toKey = to.getTime();
  const loadCards = useCallback(async () => {
    try {
      const [wk, nek] = await Promise.all([wkDs.loadScheduleLines(new Date(fromKey), new Date(toKey)), nekDs.loadScheduleLines(new Date(fromKey), new Date(toKey))]);
      const real = (l: (typeof wk)[number]) => !!l.jobNo && !l.isCustom && !l.shipmentLoadId;
      setCards([...wk, ...nek].filter(real).map((l) => ({ jobNo: l.jobNo, start: l.startDateTime, end: l.endDateTime, locked: l.isLocked })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCards([]);
    }
  }, [wkDs, nekDs, fromKey, toKey]);
  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const inputs = useMemo<PlannerInputs>(() => {
    const mustOf = (groups: typeof wkGroups) =>
      new Set(groups.filter((g) => sameName(g.name, MUST_THIS_WEEK)).flatMap((g) => g.items.map((i) => i.jobNo)));
    return {
      rows,
      stepsFor: (jobNo) => {
        const info = stepInfo.get(jobNo) ?? { production: [], hasInstall: false };
        return buildDepartmentSteps(
          info.production,
          new Set(Object.keys(completions[jobNo] ?? {})),
          info.hasInstall,
          overrides[jobNo] ?? {},
          stepOrderFor(jobNo),
          isServiceJob(jobNo),
        );
      },
      planLines,
      scheduledKeys: scheduled,
      cards: cards ?? [],
      must: { WK: mustOf(wkGroups), NEK: mustOf(nekGroups) },
      geos,
      zips,
    };
    // flowCompany / orderTypes: a changed flow or order type changes the steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, stepInfo, completions, overrides, flowCompany, orderTypes, planLines, scheduled, cards, wkGroups, nekGroups, geos, zips]);

  return { inputs, loading: cards === null || !zips, error, reload: () => void loadCards() };
}

/** The Install Planner's jobs for one week (and looks up missing map positions in the background). */
export function usePlannerJobs(weekStart: Date): {
  jobs: PlannerJob[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const from = useMemo(() => addDays(weekStart, -42), [weekStart]);
  const to = useMemo(() => addDays(weekStart, 180), [weekStart]);
  const { inputs, loading, error, reload } = usePlannerInputs(from, to);
  const jobs = useMemo(() => buildPlannerJobs(inputs, weekStart), [inputs, weekStart]);

  useEffect(() => {
    const onMap = new Set(jobs.map((j) => j.jobNo));
    useJobGeoStore.getState().ensure(inputs.rows.filter((r) => onMap.has(r.jobNo)).map((r) => ({ jobNo: r.jobNo, shipTo: r.shipTo })));
  }, [jobs, inputs.rows]);

  return { jobs, loading, error, reload };
}
