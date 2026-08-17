import { create } from "zustand";
import { persistOrReport } from "./write-status-store";

/**
 * Per-job department completions (crfdf_jobdeptcompletion) that drive the
 * production stepper's "completed" state and the who/when stamp. Loaded once,
 * keyed by job number then department key. Writes are optimistic + resync on
 * failure. Live-only persistence (dev keeps it in memory for the session).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export interface CompletionStamp {
  by: string;
  date: Date | null;
}

interface JobDeptCompletionState {
  byJob: Record<string, Record<string, CompletionStamp>>;
  loaded: boolean;
  loading: boolean;

  load: (force?: boolean) => Promise<void>;
  completedKeys: (jobNo: string) => Set<string>;
  stampFor: (jobNo: string, deptKey: string) => CompletionStamp | undefined;
  /** Mark (or un-mark) a department complete for a job, stamping who + when. */
  setComplete: (jobNo: string, deptKey: string, by: string, done: boolean) => Promise<void>;
}

export const useJobDeptCompletionStore = create<JobDeptCompletionState>((set, get) => ({
  byJob: {},
  loaded: false,
  loading: false,

  load: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    if (!LIVE) {
      set({ loaded: true, loading: false });
      return;
    }
    try {
      const { fetchJobDeptCompletions } = await import("../services/dataverse-live");
      const rows = await fetchJobDeptCompletions();
      const byJob: Record<string, Record<string, CompletionStamp>> = {};
      for (const r of rows) {
        (byJob[r.jobNo] ??= {})[r.deptKey] = { by: r.completedBy, date: r.completedDate };
      }
      set({ byJob, loaded: true, loading: false });
    } catch (e) {
      console.error("[job-dept-completion] load failed", e);
      set({ loaded: true, loading: false });
    }
  },

  completedKeys: (jobNo) => new Set(Object.keys(get().byJob[jobNo] ?? {})),
  stampFor: (jobNo, deptKey) => get().byJob[jobNo]?.[deptKey],

  setComplete: async (jobNo, deptKey, by, done) => {
    if (!jobNo || !deptKey) return;
    set((s) => {
      const forJob = { ...(s.byJob[jobNo] ?? {}) };
      if (done) forJob[deptKey] = { by, date: new Date() };
      else delete forJob[deptKey];
      return { byJob: { ...s.byJob, [jobNo]: forJob } };
    });
    if (!LIVE) return;
    await persistOrReport(done ? "Complete a department" : "Un-complete a department", async () => {
      const m = await import("../services/dataverse-live");
      return done
        ? m.addJobDeptCompletion(jobNo, deptKey, by)
        : m.removeJobDeptCompletion(jobNo, deptKey);
    });
  },
}));
