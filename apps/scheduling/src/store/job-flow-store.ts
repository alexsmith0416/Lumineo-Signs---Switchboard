import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import { ensureJobsLoaded, useJobTrackingStore } from "./job-tracking-store";
import {
  companyFlow,
  effectiveFlow,
  flowFromRules,
  parseStages,
  stepOrder,
  type FlowConfig,
  type FlowStage,
} from "../services/job-flow";
import { withDefaults } from "../services/status-rules";

/**
 * The company job flow (Settings → Job flow), shared by everyone — kept in the
 * Jobs config table (crfdf_jobsview) under "jobFlow", next to the shared views.
 * Until it's first saved it's built from the old Settings → Status rules
 * ("statusRules"). A job's own flow lives on its tracking row
 * (crfdf_jobtrack.crfdf_flow, job-tracking-store). Model: services/job-flow.ts.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const KEY = "jobFlow";
const OLD_RULES_KEY = "statusRules";

interface JobFlowState {
  company: FlowConfig;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Save the company flow for everyone. */
  setCompany: (next: FlowConfig) => void;
}

export const useJobFlowStore = create<JobFlowState>((set, get) => ({
  company: flowFromRules(),
  loaded: false,

  load: async (force = false) => {
    if (get().loaded && !force) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    try {
      const rows = await (await import("../services/dataverse-live")).fetchJobsViewConfig();
      const rules = withDefaults(rows.get(OLD_RULES_KEY) as Record<string, string> | undefined);
      set({ company: companyFlow(rows.get(KEY), rules), loaded: true });
    } catch (e) {
      console.warn("[job-flow] load failed — using the defaults", e);
      set({ loaded: true });
    }
  },

  setCompany: (next) => {
    set({ company: next });
    if (!LIVE) return;
    void persistOrReport("Save job flow", async () =>
      (await import("../services/dataverse-live")).saveJobsViewConfig(KEY, next),
    );
  },
}));

/** A job's own stages (null = it follows the company flow). */
export function jobOwnStages(jobNo: string): FlowStage[] | null {
  const t = useJobTrackingStore.getState().tracks.find((x) => x.jobNo === jobNo);
  return parseStages(t?.flow ?? "");
}

/** The flow a job follows, for the steps on its stepper. */
export function jobFlowFor(jobNo: string, stepKeys: readonly string[]): FlowStage[] {
  return effectiveFlow(useJobFlowStore.getState().company, jobOwnStages(jobNo), stepKeys);
}

/** The job's flow stages + the company's done status — what a status pick
 *  needs to know which steps it completes (job-status `stepsToComplete`). */
export function jobFlowConfigFor(jobNo: string, stepKeys: readonly string[]): { stages: FlowStage[]; doneStatus: string } {
  return { stages: jobFlowFor(jobNo, stepKeys), doneStatus: useJobFlowStore.getState().company.doneStatus };
}

/** The job's stepper order (its own flow's, else the company's). */
export function stepOrderFor(jobNo: string): string[] {
  return stepOrder(jobOwnStages(jobNo) ?? useJobFlowStore.getState().company.stages);
}

/** Wait for the company flow, the jobs' own flows and the jobs' BC Order Types
 *  (which give a job its Service stepper) — before anything that acts on a
 *  job's steps (BC pushes, shop-floor ticks, bulk plans). */
export async function ensureFlowsLoaded(): Promise<void> {
  const { useServiceJobsStore } = await import("./service-jobs-store");
  await Promise.all([useJobFlowStore.getState().load(), ensureJobsLoaded(), useServiceJobsStore.getState().load()]);
}

/** React: the job's stepper order, re-rendering when either flow changes. */
export function useStepOrder(jobNo: string | undefined): string[] {
  const company = useJobFlowStore((s) => s.company);
  const own = useJobTrackingStore((s) => (jobNo ? s.tracks.find((t) => t.jobNo === jobNo)?.flow ?? "" : ""));
  const load = useJobFlowStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return useMemo(() => stepOrder(parseStages(own) ?? company.stages), [own, company]);
}
