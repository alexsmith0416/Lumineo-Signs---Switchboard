import { create } from "zustand";
import type { BcJobSummary, JobTrack } from "../services/job-tracking";

/**
 * The Jobs view's source data: every open BC job and every crfdf_jobtrack row.
 * The view joins these with the SHARED job-schedule store (store/job-schedule-
 * store.ts) and the shared stepper stores at render time, so an Install Dates
 * or stepper change made on a board shows in Jobs instantly, and vice versa.
 * Live reads Dataverse; dev uses synthetic data (data/mock-job-tracking.ts).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

interface JobTrackingState {
  bcJobs: BcJobSummary[];
  tracks: JobTrack[];
  /** Invoice amount typed on each job's calendar cards (the calendar's $ fallback). */
  invoiceByJob: Map<string, number>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
}

export const useJobTrackingStore = create<JobTrackingState>((set, get) => ({
  bcJobs: [],
  tracks: [],
  invoiceByJob: new Map(),
  loaded: false,
  loading: false,
  error: null,

  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true, error: null });
    try {
      if (!LIVE) {
        const m = await import("../data/mock-job-tracking");
        set({ bcJobs: m.MOCK_BC_JOBS, tracks: m.MOCK_JOB_TRACKS, loaded: true, loading: false });
        return;
      }
      const [dv, steps] = await Promise.all([import("../services/dataverse-live"), import("../hooks/useJobSteps")]);
      // One batch: jobs, tracking rows, EVERY job's stepper info (one paged read
      // instead of a request per row) and the calendar invoice amounts. The
      // extras are best-effort — a failure there must not block the list.
      const [bcJobs, tracks, stepInfo, invoiceByJob] = await Promise.all([
        dv.fetchBcJobSummaries(),
        dv.fetchJobTracks(),
        dv.allJobStepInfo().catch((e) => {
          console.warn("[jobs] bulk stepper load failed; steppers load per row", e);
          return null;
        }),
        dv.jobInvoiceAmounts().catch(() => new Map<string, number>()),
      ]);
      if (stepInfo) {
        // Jobs with no resource planning lines are known-empty, not "fetch me".
        const all = new Map(stepInfo);
        for (const j of bcJobs) if (!all.has(j.jobNo)) all.set(j.jobNo, { production: [], hasInstall: false });
        steps.primeJobStepInfo(all);
      }
      set({ bcJobs, tracks, invoiceByJob, loaded: true, loading: false });
    } catch (e) {
      console.error("[jobs] load failed", e);
      set({ loaded: true, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
