// Current Status follows the job's flow after someone completes — or re-opens —
// a department on a stepper (Jobs list, job / card panel, a group card's ✓) — the same rule the shop-floor
// "Task complete" ticks use (task-completion-processor.ts): the status becomes
// the flow's first open stage, but only from a normal production status (holds
// and special statuses are never moved). Install keeps its own rule
// (Complete-need paperwork, job-dept-completion-store.ts).

import { format } from "date-fns";
import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobTrackingStore } from "./job-tracking-store";
import { ensureFlowsLoaded, jobFlowFor, stepOrderFor, useJobFlowStore } from "./job-flow-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";
import { isServiceJob } from "./service-jobs-store";
import { buildDepartmentSteps } from "../services/production-steps";
import { buildServiceSteps } from "../services/service-steps";
import { currentStatus } from "../services/job-tracking";
import { flowStatus, isFlowMovable, parseStagesDone } from "../services/job-flow";

const INSTALL_KEY = "I";
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/**
 * After `stepKey` was completed on `jobNo` by `by`: move Current Status to where
 * the flow says the job is now. Returns the new status, or null when it stays.
 * Never throws — a status that can't move just stays (the completion itself is
 * already saved).
 */
export async function followFlowAfterStepComplete(
  jobNo: string,
  stepKey: string,
  stepKeys: readonly string[],
  by: string,
): Promise<string | null> {
  if (!jobNo || !stepKey || stepKey === INSTALL_KEY) return null;
  return followFlow(jobNo, stepKeys, by);
}

/**
 * Move Current Status to where the flow says the job is now, from its stepper —
 * forward after a completion, back after a re-open, so the status always
 * matches the stepper. Holds and special statuses are never moved.
 */
export async function followFlow(jobNo: string, stepKeys: readonly string[], by: string): Promise<string | null> {
  if (!jobNo) return null;
  try {
    await ensureFlowsLoaded();
    const dv = await import("../services/dataverse-live");
    // Fresh tracking row — the status may have been changed elsewhere.
    const fresh = await dv.fetchJobTrack(jobNo).catch(() => null);
    if (fresh) {
      useJobTrackingStore.setState((s) => ({
        tracks: s.tracks.some((t) => t.jobNo === jobNo)
          ? s.tracks.map((t) => (t.jobNo === jobNo ? fresh : t))
          : [...s.tracks, fresh],
      }));
    }
    const track = useJobTrackingStore.getState().tracks.find((t) => t.jobNo === jobNo);
    const current = currentStatus(track).status;
    const flow = jobFlowFor(jobNo, stepKeys);
    if (!flow.length) return null;
    const doneStatus = useJobFlowStore.getState().company.doneStatus;
    if (!isFlowMovable(current, flow, doneStatus)) return null;
    const completed = new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {}));
    const wanted = flowStatus(flow, doneStatus, new Set(parseStagesDone(track?.stagesDone ?? "")), completed);
    if (wanted === current) return null;
    const stamp = `Stepper · ${by} · ${format(new Date(), "M/d/yyyy")}`;
    await useJobTrackingStore.getState().setStatus(jobNo, wanted, stamp, stamp);
    return wanted;
  } catch (e) {
    console.warn("[flow-follow] status not moved", e);
    return null;
  }
}

/** Every step on a job's steppers (production + service), as the stepper shows them. */
export async function jobStepKeys(jobNo: string): Promise<string[]> {
  const dv = await import("../services/dataverse-live");
  const info = await dv.jobStepInfo(jobNo);
  const completed = new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {}));
  const overrides = useJobDeptOverrideStore.getState().byJob[jobNo] ?? {};
  const service = isServiceJob(jobNo);
  const steps = buildDepartmentSteps(info.production, completed, info.hasInstall, overrides, stepOrderFor(jobNo), service);
  const serviceSteps = service ? buildServiceSteps(completed, overrides) : [];
  return [...steps, ...serviceSteps].map((s) => s.key);
}

/**
 * Complete (or re-open) one step of a job from outside its stepper — e.g. a ✓ on
 * a group card member — exactly as the stepper would: save it, push BC, then
 * let Current Status follow the flow. Install keeps its own rule.
 */
export async function setJobStep(jobNo: string, key: string, by: string, done: boolean): Promise<void> {
  const completions = useJobDeptCompletionStore.getState();
  await Promise.all([completions.load(), useJobDeptOverrideStore.getState().load()]);
  // Dev has no step info (mock data) — the completion still applies, no flow move.
  const stepKeys = LIVE ? await jobStepKeys(jobNo).catch(() => [] as string[]) : [];
  await completions.setComplete(jobNo, key, by, done, stepKeys);
  if (key !== INSTALL_KEY && stepKeys.length) await followFlow(jobNo, stepKeys, by);
}
