import { create } from "zustand";
import { format } from "date-fns";
import { currentStatus, emptyJobTrack, type BcJobSummary, type JobTrack } from "../services/job-tracking";
import { holdTransition, stepsToComplete } from "../services/job-status";
import { buildDepartmentSteps } from "../services/production-steps";
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
   * Set a job's Current Status. Stamps the hold dates on the way into / out of
   * a hold, and completes the stepper steps the status implies (job-status.ts),
   * which pushes the new step states to BC like a stepper click.
   */
  setStatus: (jobNo: string, status: string, by: string) => Promise<void>;
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
      set({ bcJobs, tracks, invoiceByJob, stepInfo: stepInfo ?? new Map(), loaded: true, loading: false });
    } catch (e) {
      console.error("[jobs] load failed", e);
      set({ loaded: true, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  renameJob: (jobNo, name) => saveTrack(jobNo, { jobName: name.trim() }, "Rename job"),

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

  setStatus: async (jobNo, status, by) => {
    const track = get().tracks.find((t) => t.jobNo === jobNo);
    const prev = currentStatus(track).status;
    if (status === prev && track?.statusOverride === status) return;
    const t = track ?? emptyJobTrack(jobNo);
    const hold = holdTransition(
      { holdReason: t.holdReason, dateToHold: t.dateToHold, dateOffHold: t.dateOffHold, priorHoldDays: t.priorHoldDays ?? 0 },
      prev,
      status,
      format(new Date(), "yyyy-MM-dd"),
    );
    const saving = saveTrack(jobNo, { statusOverride: status, ...hold }, "Change job status");

    // Stepper automation: complete what the status implies.
    const steps = await jobSteps(jobNo);
    const keys = stepsToComplete(status, steps);
    if (keys.length) {
      await useJobDeptCompletionStore.getState().completeMany(jobNo, keys, by, steps.map((s) => s.key));
    }
    await saving;
  },
}));

type TrackPatch = Partial<Pick<JobTrack, "jobName" | "statusOverride" | "holdReason" | "dateToHold" | "dateOffHold" | "priorHoldDays">>;

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

/** A job's current stepper steps (live: its BC planning lines + completions + overrides). */
async function jobSteps(jobNo: string) {
  if (!LIVE) return [];
  const dv = await import("../services/dataverse-live");
  const info = await dv.jobStepInfo(jobNo).catch(() => ({ production: [] as string[], hasInstall: false }));
  const completions = useJobDeptCompletionStore.getState();
  const overrides = useJobDeptOverrideStore.getState();
  await Promise.all([completions.load(), overrides.load()]);
  return buildDepartmentSteps(
    info.production,
    new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {})),
    info.hasInstall,
    useJobDeptOverrideStore.getState().byJob[jobNo] ?? {},
  );
}
