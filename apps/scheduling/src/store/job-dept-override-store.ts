import { create } from "zustand";
import { persistOrReport } from "./write-status-store";

/**
 * Per-job department overrides (crfdf_jobdeptoverride) that let an editor edit
 * the production stepper on top of the BC-derived default: force a department in
 * (added) or out (removed) via `included`, and flag extra active steps via
 * `active`. Loaded once, keyed by job number then department key. Writes are
 * optimistic + resync on failure. Live-only persistence (dev keeps it in memory
 * for the session).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export interface DeptOverride {
  included: boolean;
  active: boolean;
}

interface JobDeptOverrideState {
  byJob: Record<string, Record<string, DeptOverride>>;
  loaded: boolean;
  loading: boolean;

  load: (force?: boolean) => Promise<void>;
  overridesFor: (jobNo: string) => Record<string, DeptOverride>;
  /** Upsert the override for a (job, dept). */
  setOverride: (jobNo: string, deptKey: string, o: DeptOverride) => Promise<void>;
  /** Remove any override for a (job, dept) — back to the BC default. */
  clearOverride: (jobNo: string, deptKey: string) => Promise<void>;
}

export const useJobDeptOverrideStore = create<JobDeptOverrideState>((set, get) => ({
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
      const { fetchJobDeptOverrides } = await import("../services/dataverse-live");
      const rows = await fetchJobDeptOverrides();
      const byJob: Record<string, Record<string, DeptOverride>> = {};
      for (const r of rows) {
        (byJob[r.jobNo] ??= {})[r.deptKey] = { included: r.included, active: r.active };
      }
      set({ byJob, loaded: true, loading: false });
    } catch (e) {
      console.error("[job-dept-override] load failed", e);
      set({ loaded: true, loading: false });
    }
  },

  overridesFor: (jobNo) => get().byJob[jobNo] ?? {},

  setOverride: async (jobNo, deptKey, o) => {
    if (!jobNo || !deptKey) return;
    set((s) => {
      const forJob = { ...(s.byJob[jobNo] ?? {}) };
      forJob[deptKey] = o;
      return { byJob: { ...s.byJob, [jobNo]: forJob } };
    });
    if (!LIVE) return;
    await persistOrReport("Edit production stage", async () => {
      const m = await import("../services/dataverse-live");
      return m.setJobDeptOverride(jobNo, deptKey, o.included, o.active);
    });
  },

  clearOverride: async (jobNo, deptKey) => {
    if (!jobNo || !deptKey) return;
    set((s) => {
      const forJob = { ...(s.byJob[jobNo] ?? {}) };
      delete forJob[deptKey];
      return { byJob: { ...s.byJob, [jobNo]: forJob } };
    });
    if (!LIVE) return;
    await persistOrReport("Reset production stage", async () => {
      const m = await import("../services/dataverse-live");
      return m.clearJobDeptOverride(jobNo, deptKey);
    });
  },
}));
