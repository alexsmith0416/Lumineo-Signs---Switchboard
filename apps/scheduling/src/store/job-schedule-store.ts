import { create } from "zustand";
import {
  emptyJobSchedule,
  getJobScheduleDataSource,
  type JobSchedule,
} from "../services/job-schedule-data";

/**
 * Per-job schedule dates (release / scheduled install / red), loaded once and
 * keyed by job number so cards and the edit panel can overlay them by jobNo.
 * Writes are optimistic (local first, persist in the background) and resync on
 * failure — same pattern as the other stores.
 */
type DateFields = Pick<JobSchedule, "releasedDate" | "scheduledInstallDate" | "redDate">;

interface JobScheduleState {
  byJob: Record<string, JobSchedule>;
  loaded: boolean;
  loading: boolean;

  load: (force?: boolean) => Promise<void>;
  /** Current row for a job (an empty row when none exists yet). */
  getFor: (jobNo: string) => JobSchedule;
  update: (jobNo: string, changes: Partial<DateFields>) => Promise<void>;
}

const ds = getJobScheduleDataSource();

export const useJobScheduleStore = create<JobScheduleState>((set, get) => ({
  byJob: {},
  loaded: false,
  loading: false,

  load: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    try {
      const all = await ds.loadAll();
      const byJob: Record<string, JobSchedule> = {};
      for (const sch of all) byJob[sch.jobNo] = sch;
      set({ byJob, loaded: true, loading: false });
    } catch (e) {
      console.error("[job-schedule] load failed", e);
      set({ loaded: true, loading: false });
    }
  },

  getFor: (jobNo) => get().byJob[jobNo] ?? emptyJobSchedule(jobNo),

  update: async (jobNo, changes) => {
    if (!jobNo) return;
    const cur = get().byJob[jobNo] ?? emptyJobSchedule(jobNo);
    const next: JobSchedule = { ...cur, ...changes, jobNo };
    set((s) => ({ byJob: { ...s.byJob, [jobNo]: next } }));
    void ds.upsert(next).catch((e) => {
      console.error("[job-schedule] upsert failed — resyncing", e);
      void get().load(true);
    });
  },
}));
