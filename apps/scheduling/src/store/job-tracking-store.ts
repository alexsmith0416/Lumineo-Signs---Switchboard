import { create } from "zustand";
import { buildJobRows, type JobRow, type JobScheduleDates } from "../services/job-tracking";

/**
 * The Jobs view's rows: every open BC job joined with its crfdf_jobtrack row and
 * crfdf_jobschedule dates (services/job-tracking.ts). Read-only in Phase 1.
 * Live reads Dataverse; dev uses synthetic data (data/mock-job-tracking.ts).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

const ymd = (d: Date | null): string =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";

interface JobTrackingState {
  rows: JobRow[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
}

export const useJobTrackingStore = create<JobTrackingState>((set, get) => ({
  rows: [],
  loaded: false,
  loading: false,
  error: null,

  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true, error: null });
    try {
      if (!LIVE) {
        const m = await import("../data/mock-job-tracking");
        set({ rows: buildJobRows(m.MOCK_BC_JOBS, m.MOCK_JOB_TRACKS, m.MOCK_JOB_SCHEDULES, new Date()), loaded: true, loading: false });
        return;
      }
      const dv = await import("../services/dataverse-live");
      const [bc, tracks, schedules] = await Promise.all([
        dv.fetchBcJobSummaries(),
        dv.fetchJobTracks(),
        dv.fetchJobSchedules(),
      ]);
      const dates = new Map<string, JobScheduleDates>(
        schedules.map((sch) => [sch.jobNo, { redDate: ymd(sch.redDate), productionCompleteDate: ymd(sch.productionCompleteDate) }]),
      );
      set({ rows: buildJobRows(bc, tracks, dates, new Date()), loaded: true, loading: false });
    } catch (e) {
      console.error("[jobs] load failed", e);
      set({ loaded: true, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
