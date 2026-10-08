import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";
import { ensureFlowsLoaded } from "./job-flow-store";
import { useJobTrackingStore } from "./job-tracking-store";
import { currentStatus } from "../services/job-tracking";

/**
 * Mirror a job into BC's Project Planning Started / Complete flags. Called
 * after ANY stepper change — a department completed or re-opened, "Set
 * active", an editor adding or removing a department — and after a Current
 * Status change, because one click can move several BC steps.
 *
 * Queues one `"state"` row per BC step, each carrying the step's whole current
 * state, read from the stores AFTER the optimistic update:
 *  - the stepper's departments + Install (+ the Service stepper on a service
 *    job) — `bcStepStates`, adjusted for the status (BC Install isn't Started
 *    before Installation; Vinyl is Complete on MFG - Vinyl Install);
 *  - the LIFECYCLE steps the Current Status implies (New Order This Week …
 *    Complete-Need Paperwork — services/status-lifecycle.ts). `prev` = the
 *    status the job just left (a status change passes it).
 * Each row carries the mover's BC Resource No. for BC's Completed By (the
 * signed-in user's, unless `completedBy` is given — a punch passes the
 * employee's). The flow skips a row when a newer one exists for the same job +
 * step, so a burst of clicks lands on the last state.
 *
 * Fire-and-forget: never blocks or fails a click. Live-only.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export async function pushStepperState(
  jobNo: string,
  by = "",
  opts: { prev?: string; completedBy?: string } = {},
): Promise<void> {
  if (!LIVE || !jobNo) return;
  try {
    const [m, sync, life, { jobStepsFor }] = await Promise.all([
      import("../services/dataverse-live"),
      import("../services/bc-planning-sync"),
      import("../services/status-lifecycle"),
      import("./job-steps"),
    ]);
    const info = await m.jobStepInfo(jobNo);
    // The job's flow sets which step is active — BC must be told the same.
    await ensureFlowsLoaded();
    const completed = new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {}));
    const overrides = useJobDeptOverrideStore.getState().byJob[jobNo] ?? {};
    const steps = jobStepsFor(jobNo, info, completed, overrides);
    const status = currentStatus(useJobTrackingStore.getState().tracks.find((t) => t.jobNo === jobNo)).status;
    const states = [
      ...life.adjustForStatus(sync.bcStepStates(steps), status),
      ...life.lifecycleBcStates(status, opts.prev ?? ""),
    ];
    const completedBy = opts.completedBy ?? (await m.myResourceNo().catch(() => ""));
    await Promise.all(
      states.map((state) => m.enqueueBcPush(sync.buildStepStatePush({ jobNo, state, by, completedBy }))),
    );
  } catch (e) {
    console.warn("[bc-sync] stepper state push failed (non-blocking)", e);
  }
}
