import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";

/**
 * Mirror a job's production stepper into BC's Project Planning Started /
 * Complete flags. Called after ANY stepper change — a department completed or
 * re-opened, "Set active", an editor adding or removing a department — because
 * one click can move several BC steps (completing Metal Fab makes Paint the
 * active stage, so Painting becomes Started).
 *
 * Queues one `"state"` row per BC step the stepper includes, each carrying the
 * step's whole current state (see `bcStepStates`), read from the stores AFTER
 * the optimistic update. The flow skips a row when a newer one exists for the
 * same job + step, so a burst of clicks lands on the last state, not whichever
 * row the flow happened to process last.
 *
 * Fire-and-forget: never blocks or fails a stepper click. Live-only.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export async function pushStepperState(jobNo: string, by = ""): Promise<void> {
  if (!LIVE || !jobNo) return;
  try {
    const [m, sync, { buildDepartmentSteps }] = await Promise.all([
      import("../services/dataverse-live"),
      import("../services/bc-planning-sync"),
      import("../services/production-steps"),
    ]);
    const info = await m.jobStepInfo(jobNo);
    const completed = new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {}));
    const overrides = useJobDeptOverrideStore.getState().byJob[jobNo] ?? {};
    const steps = buildDepartmentSteps(info.production, completed, info.hasInstall, overrides);
    await Promise.all(
      sync.bcStepStates(steps).map((state) => m.enqueueBcPush(sync.buildStepStatePush({ jobNo, state, by }))),
    );
  } catch (e) {
    console.warn("[bc-sync] stepper state push failed (non-blocking)", e);
  }
}
