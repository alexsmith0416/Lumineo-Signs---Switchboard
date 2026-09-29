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
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
}

export const useJobTrackingStore = create<JobTrackingState>((set, get) => ({
  bcJobs: [],
  tracks: [],
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
      const dv = await import("../services/dataverse-live");
      const [bcJobs, tracks] = await Promise.all([dv.fetchBcJobSummaries(), dv.fetchJobTracks()]);
      set({ bcJobs, tracks, loaded: true, loading: false });
    } catch (e) {
      console.error("[jobs] load failed", e);
      set({ loaded: true, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
