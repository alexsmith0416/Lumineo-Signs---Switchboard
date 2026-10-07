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
  /**
   * Mark (or un-mark) a department complete for a job, stamping who + when.
   *
   * `allStepKeys` is the stepper's full included set. Pass it and the store
   * will also push JOB-level completion to BC when this toggle makes the last
   * department complete (or re-opens a job that was complete). Omit it and
   * only the department row is written — no job push.
   */
  setComplete: (
    jobNo: string,
    deptKey: string,
    by: string,
    done: boolean,
    allStepKeys?: readonly string[],
  ) => Promise<void>;
  /**
   * Complete several departments at once (a status change, or the Jobs
   * backfill). One stepper → BC state push afterwards instead of one per step,
   * and the job-level push when this completes the job. `pushBc: false` skips
   * both (the backfill leaves BC to "Sync to BC").
   */
  completeMany: (
    jobNo: string,
    deptKeys: readonly string[],
    by: string,
    allStepKeys: readonly string[],
    opts?: { pushBc?: boolean },
  ) => Promise<void>;
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

  setComplete: async (jobNo, deptKey, by, done, allStepKeys) => {
    if (!jobNo || !deptKey) return;
    // Capture the pre-edit set so we can tell whether THIS toggle flipped the
    // whole job over the line — a job push should fire on the transition only,
    // not on every department click while the job is already complete.
    const before = new Set(Object.keys(get().byJob[jobNo] ?? {}));
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
    // Mirror the stepper into BC's step Started/Complete (fire-and-forget).
    void import("./bc-stepper-push").then((b) => b.pushStepperState(jobNo, by));

    // JOB-level BC write-back. Fire-and-forget, and deliberately AFTER the
    // department write: if that write failed it's already reported, and the
    // job push would be pushing a state the board doesn't actually hold.
    if (!allStepKeys?.length) return;
    const after = new Set(Object.keys(get().byJob[jobNo] ?? {}));
    const [{ jobCompleteForBc, buildJobPush }, m] = await Promise.all([
      import("../services/bc-planning-sync"),
      import("../services/dataverse-live"),
    ]);
    const wasComplete = jobCompleteForBc(allStepKeys, before);
    const isComplete = jobCompleteForBc(allStepKeys, after);
    if (wasComplete === isComplete) return;
    void m.enqueueBcPush(
      buildJobPush({ jobNo, complete: isComplete, completedBy: by, completedDate: new Date() }),
    );
  },

  completeMany: async (jobNo, deptKeys, by, allStepKeys, opts = {}) => {
    const before = new Set(Object.keys(get().byJob[jobNo] ?? {}));
    const keys = deptKeys.filter((k) => k && !before.has(k));
    if (!jobNo || keys.length === 0) return;
    set((s) => {
      const forJob = { ...(s.byJob[jobNo] ?? {}) };
      for (const k of keys) forJob[k] = { by, date: new Date() };
      return { byJob: { ...s.byJob, [jobNo]: forJob } };
    });
    if (!LIVE) return;
    await persistOrReport("Complete departments", async () => {
      const m = await import("../services/dataverse-live");
      // Idempotent upserts, so a retry after a partial failure is safe.
      await Promise.all(keys.map((k) => m.addJobDeptCompletion(jobNo, k, by)));
    });
    if (opts.pushBc === false) return;
    void import("./bc-stepper-push").then((b) => b.pushStepperState(jobNo, by));
    const after = new Set(Object.keys(get().byJob[jobNo] ?? {}));
    const [{ jobCompleteForBc, buildJobPush }, m] = await Promise.all([
      import("../services/bc-planning-sync"),
      import("../services/dataverse-live"),
    ]);
    if (!jobCompleteForBc(allStepKeys, before) && jobCompleteForBc(allStepKeys, after)) {
      void m.enqueueBcPush(buildJobPush({ jobNo, complete: true, completedBy: by, completedDate: new Date() }));
    }
  },
}));
