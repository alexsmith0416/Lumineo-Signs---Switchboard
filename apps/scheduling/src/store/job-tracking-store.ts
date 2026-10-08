import type { FlowStage } from "../services/job-flow";
import { create } from "zustand";
import { format } from "date-fns";
import { currentStatus, emptyJobTrack, type BcJobSummary, type JobTrack } from "../services/job-tracking";
import { holdTransition, statusDates, stepsToComplete, stepsToReopen } from "../services/job-status";
import { isVinylInstall, statusRank } from "../services/status-lifecycle";
import { INSTALL_STEP, buildDepartmentSteps } from "../services/production-steps";
import { buildServiceSteps } from "../services/service-steps";
import { persistOrReport } from "./write-status-store";
import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";

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
  /** Every job's BC-derived stepper info (for the lead-time rules). */
  stepInfo: Map<string, { production: string[]; hasInstall: boolean }>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  /** Rename a job ("" = back to BC's ship-to name). Starts tracking an untracked job. */
  renameJob: (jobNo: string, name: string) => Promise<void>;
  /**
   * Set a job's Current Status — the job's lifecycle (Oct 7, 2026). Stamps the
   * hold dates on the way into / out of a hold and Date Installed / Date to
   * Admin; completes (or, moving back, re-opens) the stepper steps the status
   * implies (job-status.ts); then pushes BC: the steps, the lifecycle steps
   * the status implies (status-lifecycle.ts) and, at Complete to Admin, the
   * job's complete flag.
   * `auto` marks a shop-floor punch's move ("Punch · <name> · <date>" → the
   * Auto tag); a status set by hand clears that marker. `completedBy` = the BC
   * Resource No. to stamp as Completed By (a punch passes the employee's;
   * default: the signed-in user's).
   */
  setStatus: (jobNo: string, status: string, by: string, auto?: string, completedBy?: string) => Promise<void>;
  /** Dismiss a job's Auto tag (the status stays as it is). */
  dismissAuto: (jobNo: string) => Promise<void>;
  /** Give a job its own flow stages (null = back to the company flow). */
  setJobFlow: (jobNo: string, stages: FlowStage[] | null) => Promise<void>;
  /** Record a job's stage progress (services/job-flow.ts applyTick). */
  setStagesDone: (jobNo: string, ids: string[]) => Promise<void>;
  /** Change tracking fields on a job (the Jobs grid's editable columns). */
  updateTrack: (jobNo: string, patch: TrackPatch) => Promise<void>;
  /** Set (or clear, with null) one custom field value on a job. */
  setCustomValue: (jobNo: string, key: string, value: unknown) => Promise<void>;
}

export const useJobTrackingStore = create<JobTrackingState>((set, get) => ({
  bcJobs: [],
  tracks: [],
  invoiceByJob: new Map(),
  stepInfo: new Map(),
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
      const t0 = performance.now();
      const ms = () => `${Math.round(performance.now() - t0)} ms`;
      // The list shows as soon as the jobs + tracking rows are in. EVERY job's
      // stepper info (one big paged read of the planning lines) and the
      // calendar invoice amounts fill in after; they're best-effort — a failure
      // there must not block the list. Rows on screen meanwhile wait for the
      // bulk read rather than fetching their own steppers.
      const stepInfoP = dv.allJobStepInfo().catch((e) => {
        console.warn("[jobs] bulk stepper load failed; steppers load per row", e);
        return null;
      });
      const invoiceP = dv.jobInvoiceAmounts().catch(() => new Map<string, number>());
      steps.setBulkStepInfoPending(stepInfoP);
      const [bcJobs, tracks] = await Promise.all([dv.fetchBcJobSummaries(), dv.fetchJobTracks()]);
      console.info(`[load] jobs list (BC jobs + tracking): ${ms()}`);
      set({ bcJobs, tracks, loaded: true, loading: false });
      const [stepInfo, invoiceByJob] = await Promise.all([
        stepInfoP.then((v) => (console.info(`[load] jobs steppers: ${ms()}`), v)),
        invoiceP.then((v) => (console.info(`[load] jobs invoice amounts: ${ms()}`), v)),
      ]);
      if (stepInfo) {
        // Jobs with no resource planning lines are known-empty, not "fetch me".
        const all = new Map(stepInfo);
        for (const j of bcJobs) if (!all.has(j.jobNo)) all.set(j.jobNo, { production: [], hasInstall: false });
        steps.primeJobStepInfo(all);
      }
      steps.setBulkStepInfoPending(null);
      set({ invoiceByJob, stepInfo: stepInfo ?? new Map() });
    } catch (e) {
      console.error("[jobs] load failed", e);
      set({ loaded: true, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  renameJob: (jobNo, name) => saveTrack(jobNo, { jobName: name.trim() }, "Rename job"),

  updateTrack: (jobNo, patch) => saveTrack(jobNo, patch, "Edit job"),

  setCustomValue: async (jobNo, key, value) => {
    const apply = (p: Partial<JobTrack>) =>
      set((s) => {
        const has = s.tracks.some((t) => t.jobNo === jobNo);
        return {
          tracks: has
            ? s.tracks.map((t) => (t.jobNo === jobNo ? { ...t, ...p } : t))
            : [...s.tracks, { ...emptyJobTrack(jobNo), ...p }],
        };
      });
    const current = get().tracks.find((t) => t.jobNo === jobNo)?.customValues ?? {};
    const next = { ...current };
    if (value == null || (Array.isArray(value) && value.length === 0)) delete next[key];
    else next[key] = value;
    apply({ customValues: next });
    if (!LIVE) return;
    await persistOrReport("Edit custom field value", async () => {
      const dv = await import("../services/dataverse-live");
      const id = await dv.saveJobCustomValue(jobNo, key, value);
      if (!get().tracks.find((t) => t.jobNo === jobNo)?.id) apply({ id });
    });
  },

  setStatus: async (jobNo, status, by, auto, completedBy) => {
    const track = get().tracks.find((t) => t.jobNo === jobNo);
    const prev = currentStatus(track).status;
    const statusAuto = auto ?? "";
    if (status === prev && track?.statusOverride === status) {
      // Same status picked by hand: still counts as reviewing the Auto tag.
      if (!auto && track.statusAuto) await saveTrack(jobNo, { statusAuto: "" }, "Dismiss auto status tag");
      return;
    }
    const t = track ?? emptyJobTrack(jobNo);
    const today = format(new Date(), "yyyy-MM-dd");
    const hold = holdTransition(
      { holdReason: t.holdReason, dateToHold: t.dateToHold, dateOffHold: t.dateOffHold, priorHoldDays: t.priorHoldDays ?? 0 },
      prev,
      status,
      today,
    );
    // Date Installed (first time a job reaches Complete-need paperwork or later)
    // and Date to Admin (every move to Complete to Admin) fill themselves in.
    const dates = statusDates(status, { dateInstalled: t.dateInstalled, dateToAdmin: t.dateToAdmin }, today);
    const saving = saveTrack(jobNo, { statusOverride: status, statusAuto, ...hold, ...dates }, "Change job status");

    // Stepper: complete what the status implies, re-open Install on a move back
    // from a complete status, and Vinyl Install = Vinyl AND Install active.
    const steps = await jobSteps(jobNo);
    const allKeys = steps.map((s) => s.key);
    const done = stepsToComplete(status, steps);
    const reopen = stepsToReopen(prev, status, steps);
    const overrides = useJobDeptOverrideStore.getState();
    const installOv = overrides.byJob[jobNo]?.[INSTALL_STEP.key];
    if (isVinylInstall(status) && !installOv?.active) {
      await overrides.setOverride(jobNo, INSTALL_STEP.key, { included: true, active: true });
    } else if (!isVinylInstall(status) && isVinylInstall(prev) && installOv?.active) {
      await overrides.clearOverride(jobNo, INSTALL_STEP.key);
    }
    const completions = useJobDeptCompletionStore.getState();
    // BC follows (steps + the lifecycle the status implies) in one push at the end.
    if (done.length) await completions.completeMany(jobNo, done, by, allKeys, { pushBc: false });
    for (const k of reopen) await completions.setComplete(jobNo, k, by, false);
    await saving;

    const opts = { prev, ...(completedBy !== undefined ? { completedBy } : {}) };
    void import("./bc-stepper-push").then((b) => b.pushStepperState(jobNo, by, opts));
    // BC's job "complete" flag follows Complete to Admin (and re-opens on a move back).
    const was = statusRank(prev);
    const now = statusRank(status);
    if (LIVE && now !== null && was !== null && (was >= 7) !== (now >= 7)) {
      void Promise.all([import("../services/bc-planning-sync"), import("../services/dataverse-live")]).then(([sync, dv]) =>
        dv.enqueueBcPush(sync.buildJobPush({ jobNo, complete: now >= 7, completedBy: by, completedDate: new Date() })),
      );
    }
  },

  setJobFlow: (jobNo, stages) =>
    saveTrack(jobNo, { flow: stages && stages.length ? JSON.stringify(stages) : "" }, "Change job flow"),

  setStagesDone: (jobNo, ids) => saveTrack(jobNo, { stagesDone: ids.length ? JSON.stringify(ids) : "" }, "Record job flow progress"),

  dismissAuto: async (jobNo) => {
    if (!get().tracks.find((t) => t.jobNo === jobNo)?.statusAuto) return;
    await saveTrack(jobNo, { statusAuto: "" }, "Dismiss auto status tag");
  },
}));

export type TrackPatch = import("../services/dataverse-live").JobTrackPatch;

/** Apply a tracking edit on screen, then save it (creating the row if the job
 *  wasn't tracked yet). A failed save is reported and the edit stays. */
async function saveTrack(jobNo: string, patch: TrackPatch, label: string): Promise<void> {
  const apply = (p: Partial<JobTrack>) =>
    useJobTrackingStore.setState((s) => {
      const has = s.tracks.some((t) => t.jobNo === jobNo);
      return {
        tracks: has
          ? s.tracks.map((t) => (t.jobNo === jobNo ? { ...t, ...p } : t))
          : [...s.tracks, { ...emptyJobTrack(jobNo), ...p }],
      };
    });
  apply(patch);
  if (!LIVE) return;
  await persistOrReport(label, async () => {
    const dv = await import("../services/dataverse-live");
    const current = useJobTrackingStore.getState().tracks.find((t) => t.jobNo === jobNo);
    const id = await dv.saveJobTrack(jobNo, current?.id, patch);
    if (!current?.id) apply({ id });
  });
}

/** A job's current stepper steps (live: its BC planning lines + completions +
 *  overrides) — production, then its service steps when it's a service job. */
async function jobSteps(jobNo: string) {
  if (!LIVE) return [];
  const dv = await import("../services/dataverse-live");
  const info = await dv.jobStepInfo(jobNo).catch(() => ({ production: [] as string[], hasInstall: false }));
  const completions = useJobDeptCompletionStore.getState();
  const overrides = useJobDeptOverrideStore.getState();
  const { useJobFlowStore, stepOrderFor } = await import("./job-flow-store");
  const { useServiceJobsStore, isServiceJob } = await import("./service-jobs-store");
  await Promise.all([completions.load(), overrides.load(), useJobFlowStore.getState().load(), useServiceJobsStore.getState().load()]);
  const completed = new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {}));
  const ov = useJobDeptOverrideStore.getState().byJob[jobNo] ?? {};
  const service = isServiceJob(jobNo);
  return [
    ...buildDepartmentSteps(info.production, completed, info.hasInstall, ov, stepOrderFor(jobNo), service),
    ...(service ? buildServiceSteps(completed, ov) : []),
  ];
}

/** Load the jobs if needed and wait until they're in (also when a load is
 *  already running) — for screens outside Jobs, e.g. Settings → Business Central. */
export async function ensureJobsLoaded(): Promise<void> {
  const s = useJobTrackingStore.getState();
  if (s.loaded && !s.loading) return;
  void s.load();
  await new Promise<void>((resolve) => {
    const done = () => {
      const st = useJobTrackingStore.getState();
      return st.loaded && !st.loading;
    };
    if (done()) return resolve();
    const unsub = useJobTrackingStore.subscribe(() => {
      if (done()) {
        unsub();
        resolve();
      }
    });
  });
}
