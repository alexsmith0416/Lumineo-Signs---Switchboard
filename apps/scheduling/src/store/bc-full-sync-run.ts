import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";
import type { FullSyncPlan } from "../services/bc-full-sync";
import { ensureFlowsLoaded, stepOrderFor } from "./job-flow-store";

/**
 * Plan a "Sync to BC" for the given (tracked) jobs: their current stepper from
 * the shared stores + BC planning lines, every board card, and the outbox
 * history — then the diff (services/bc-full-sync.ts). Nothing is sent here.
 */
export async function planBcSync(jobNos: readonly string[]): Promise<FullSyncPlan> {
  const [dv, sync, { buildDepartmentSteps }] = await Promise.all([
    import("../services/dataverse-live"),
    import("../services/bc-full-sync"),
    import("../services/production-steps"),
  ]);
  await Promise.all([useJobDeptCompletionStore.getState().load(), useJobDeptOverrideStore.getState().load(), ensureFlowsLoaded()]);
  const [stepInfo, snapshot, lastPushes] = await Promise.all([
    dv.allJobStepInfo(),
    dv.fetchSyncSnapshot(),
    dv.fetchLastPushes(),
  ]);
  const completions = useJobDeptCompletionStore.getState().byJob;
  const overrides = useJobDeptOverrideStore.getState().byJob;
  const stepsByJob = new Map(
    jobNos.map((jobNo) => {
      const info = stepInfo.get(jobNo) ?? { production: [], hasInstall: false };
      return [
        jobNo,
        buildDepartmentSteps(info.production, new Set(Object.keys(completions[jobNo] ?? {})), info.hasInstall, overrides[jobNo] ?? {}, stepOrderFor(jobNo)),
      ] as const;
    }),
  );
  return sync.planFullSync({ jobNos, stepsByJob, lastPushes, ...snapshot });
}

/** Queue a planned sync's pushes; the BCPush_PlanningSteps flow drains them. */
export async function sendBcSync(
  plan: FullSyncPlan,
  onProgress: (done: number, total: number) => void,
): Promise<{ queued: number; failed: number }> {
  const dv = await import("../services/dataverse-live");
  return dv.enqueueBcPushes(plan.pushes, onProgress);
}
