import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { Department, ScheduleLine } from "../engine/types";
import type { QueueKind } from "../services/job-queue-data";
import { buildStepQueue, type StepPlanningLine, type StepQueueGroup, type StepQueueItem } from "../services/step-queue";
import { bcStepForDepartmentName } from "../services/bc-planning-sync";
import { buildDepartmentSteps } from "../services/production-steps";
import { defaultJobName } from "../services/job-tracking";
import { useJobTrackingStore } from "./job-tracking-store";
import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";
import { stepOrderFor, useJobFlowStore } from "./job-flow-store";
import { isServiceJob, useServiceJobsStore } from "./service-jobs-store";

/**
 * Data for the Job Queue's BC step groups (services/step-queue.ts): BC planning
 * lines, stepper info and which steps already have cards — bulk-loaded once
 * and refreshed when the queue opens. The stepper state itself comes live from
 * the shared stepper stores, so completing a department moves a job at once.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

interface StepQueueDataState {
  lines: Map<string, StepPlanningLine[]>;
  stepInfo: Map<string, { production: string[]; hasInstall: boolean }>;
  scheduled: Set<string>;
  loaded: boolean;
  loading: boolean;
  load: (force?: boolean) => Promise<void>;
}

export const useStepQueueData = create<StepQueueDataState>((set, get) => ({
  lines: new Map(),
  stepInfo: new Map(),
  scheduled: new Set(),
  loaded: false,
  loading: false,
  load: async (force = false) => {
    if (!LIVE || get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    try {
      const dv = await import("../services/dataverse-live");
      const [lines, stepInfo, scheduled] = await Promise.all([
        dv.queuePlanningLines(),
        dv.allJobStepInfo(),
        dv.scheduledSteps(),
        useJobFlowStore.getState().load(),
      ]);
      set({ lines, stepInfo, scheduled, loaded: true, loading: false });
    } catch (e) {
      console.warn("[step-queue] load failed", e);
      set({ loaded: true, loading: false });
    }
  },
}));

// Placed cards look their item up by id (CalendarView.placeQueueItem), and step
// items aren't in the queue store — so the latest computed ones live here.
const stepItemsById = new Map<string, StepQueueItem>();
export function findStepQueueItem(id: string): StepQueueItem | undefined {
  return stepItemsById.get(id);
}

/** The step groups for one board's queue, recomputed live. */
export function useStepQueue(
  kind: QueueKind,
  open: boolean,
  departments: readonly Department[],
  boardSchedule: readonly ScheduleLine[],
): { groups: StepQueueGroup[]; loading: boolean } {
  const { lines, stepInfo, scheduled, loading, load } = useStepQueueData();
  const bcJobs = useJobTrackingStore((s) => s.bcJobs);
  const tracks = useJobTrackingStore((s) => s.tracks);
  const loadJobs = useJobTrackingStore((s) => s.load);
  const completions = useJobDeptCompletionStore((s) => s.byJob);
  const overrides = useJobDeptOverrideStore((s) => s.byJob);
  const loadCompletions = useJobDeptCompletionStore((s) => s.load);
  const loadOverrides = useJobDeptOverrideStore((s) => s.load);
  const orderTypes = useServiceJobsStore((s) => s.orderTypes);

  useEffect(() => {
    if (!open) return;
    void useServiceJobsStore.getState().load();
    void loadJobs();
    void loadCompletions();
    void loadOverrides();
    void load(true); // refresh which steps are on the calendar each time it opens
  }, [open, load, loadJobs, loadCompletions, loadOverrides]);

  const groups = useMemo(() => {
    if (kind === "shipping") return [];
    const bcBy = new Map(bcJobs.map((j) => [j.jobNo, j]));
    // Tracked jobs only — the same set "Sync to BC" sends, so the queue matches BC's tiles.
    const jobs = tracks.map((t) => {
      const bc = bcBy.get(t.jobNo);
      return {
        jobNo: t.jobNo,
        name: t.jobName?.trim() || defaultJobName(bc),
        description: bc?.description ?? "",
        installRegion: t.installRegion || t.region,
        value: bc && bc.remaining > 0 ? bc.remaining : null,
      };
    });
    const stepsByJob = new Map(
      jobs.map((j) => {
        const info = stepInfo.get(j.jobNo) ?? { production: [], hasInstall: false };
        return [
          j.jobNo,
          buildDepartmentSteps(info.production, new Set(Object.keys(completions[j.jobNo] ?? {})), info.hasInstall, overrides[j.jobNo] ?? {}, stepOrderFor(j.jobNo), isServiceJob(j.jobNo)),
        ] as const;
      }),
    );
    // Cards on this board right now count as scheduled straight away.
    const nowScheduled = new Set(scheduled);
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    for (const l of boardSchedule) {
      if (!l.jobNo || l.isCustom) continue;
      if (kind === "production") {
        const step = bcStepForDepartmentName(deptName.get(l.departmentId));
        if (step) nowScheduled.add(`${l.jobNo}|${step}`);
      } else if (!l.shipmentLoadId) nowScheduled.add(`${l.jobNo}|Install`);
    }
    const idByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    // The calendar has no Crating department — crating is done by Assembly.
    const assemblyId = departments.find((d) => /assembl/i.test(d.name))?.id ?? "";
    if (assemblyId && !idByName.has("crating")) idByName.set("crating", assemblyId);
    const out = buildStepQueue({
      kind,
      jobs,
      stepsByJob,
      linesByJob: lines,
      scheduled: nowScheduled,
      departmentIdFor: (n) => idByName.get(n.toLowerCase()) ?? "",
    });
    for (const g of out) for (const it of g.items) stepItemsById.set(it.id, it);
    return out;
  }, [kind, bcJobs, tracks, stepInfo, completions, overrides, lines, scheduled, departments, boardSchedule, orderTypes]);

  return { groups, loading };
}
