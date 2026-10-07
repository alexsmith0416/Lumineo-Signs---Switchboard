/**
 * Applies the shop floor's "Task complete" ticks (crfdf_taskcompletion rows the
 * BCSync_TaskCompletions flow copies in as "pending"):
 *
 *  1. which department the tick completes (services/task-completion.ts);
 *  2. completes it on the job's stepper — the same store call as an editor's
 *     click, so the next department becomes active and BC Project Planning
 *     follows (stepper state push + job-level completion);
 *  3. walks the job's FLOW (services/job-flow.ts): the tick completes the
 *     step's next open stage — the stepper department completes only after
 *     its last stage — and Current Status moves to the flow's first open
 *     stage (only from normal production statuses);
 *  4. records what it did on the row ("done" / "skipped" + why), shown in the
 *     Jobs panel's Shop floor list.
 *
 * Runs in the app of anyone who edits the whole Jobs list (Admin / Ops /
 * Developer, by their REAL login): every 2 minutes while it's open, so the
 * office's open sessions keep up through the day. Everything here is
 * idempotent — a department already complete is left, a status already right
 * isn't re-set — so two open sessions handling the same tick do no harm.
 *
 * A tab left open on an older deploy stops applying ticks once a newer build
 * has started anywhere (services/app-build.ts), so ticks are always applied
 * by current code.
 */
import { format } from "date-fns";
import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";
import { ensureJobsLoaded, useJobTrackingStore } from "./job-tracking-store";
import { ensureFlowsLoaded, jobFlowFor, stepOrderFor, useJobFlowStore } from "./job-flow-store";
import { buildDepartmentSteps, isLifecycleKey, isManualOnlyKey, stepLabel } from "../services/production-steps";
import { isServiceJob } from "./service-jobs-store";
import { currentStatus } from "../services/job-tracking";
import { deptForCompletion } from "../services/task-completion";
import { applyTick, currentStage, flowStatus, isFlowMovable, parseStagesDone } from "../services/job-flow";
import type { TaskCompletionDetail, TaskCompletionRow } from "../services/dataverse-live";
import { APP_BUILD, LATEST_BUILD_KEY, isOutdatedBuild, shouldRecordBuild } from "../services/app-build";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const EVERY_MS = 2 * 60_000;
const FIRST_AFTER_MS = 20_000;

let running = false;
let warnedOutdated = false;

type Dv = typeof import("../services/dataverse-live");

/** A deployed tab records its build as the latest when it's newer (once, at start). */
async function recordBuild(dv: Dv): Promise<void> {
  if (!import.meta.env.PROD) return; // a local build never claims to be the deployed one
  const recorded = (await dv.fetchJobsViewConfig()).get(LATEST_BUILD_KEY);
  if (shouldRecordBuild(APP_BUILD, recorded)) await dv.saveJobsViewConfig(LATEST_BUILD_KEY, APP_BUILD);
}

/** False when a newer build has started elsewhere — this tab then leaves the ticks to it. */
async function buildIsCurrent(dv: Dv): Promise<boolean> {
  const recorded = (await dv.fetchJobsViewConfig()).get(LATEST_BUILD_KEY);
  if (!isOutdatedBuild(APP_BUILD, recorded)) return true;
  if (!warnedOutdated) {
    warnedOutdated = true;
    console.warn("[task-completions] a newer version of the app is deployed — reload to keep applying shop-floor ticks here");
  }
  return false;
}

async function stepsFor(jobNo: string) {
  const dv = await import("../services/dataverse-live");
  const info = await dv.jobStepInfo(jobNo);
  const steps = () =>
    buildDepartmentSteps(
      info.production,
      new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {})),
      info.hasInstall,
      useJobDeptOverrideStore.getState().byJob[jobNo] ?? {},
      stepOrderFor(jobNo),
      isServiceJob(jobNo),
    );
  return steps;
}

type Outcome = { state: "done" | "skipped"; result: string; detail?: Partial<TaskCompletionDetail> };

/** Pull one job's tracking row fresh into the store (another tab may have moved it on). */
async function refreshTrack(dv: Dv, jobNo: string): Promise<void> {
  const fresh = await dv.fetchJobTrack(jobNo);
  if (!fresh) return;
  useJobTrackingStore.setState((s) => ({
    tracks: s.tracks.some((t) => t.jobNo === jobNo)
      ? s.tracks.map((t) => (t.jobNo === jobNo ? fresh : t))
      : [...s.tracks, fresh],
  }));
}

/** Apply one tick; returns the row's outcome. */
async function applyOne(t: TaskCompletionRow): Promise<Outcome> {
  const dv = await import("../services/dataverse-live");
  if (!t.jobNo) return { state: "skipped", result: "No job on the punch" };
  const steps = await stepsFor(t.jobNo);
  const before = steps();
  const completed = new Set(before.filter((s) => s.state === "completed").map((s) => s.key));
  const [lines, depts] = await Promise.all([
    dv.taskPlanningLines(t.jobNo, t.jobTaskNo).catch(() => []),
    dv.employeeDeptByResource().catch(() => new Map<string, string>()),
  ]);
  const pick = deptForCompletion({
    taskLines: lines,
    employeeDept: depts.get(t.resourceNo) ?? "",
    taskDescription: t.taskDescription,
    completed,
  });
  const task = `task ${t.jobTaskNo || "?"}${t.taskDescription ? ` (${t.taskDescription})` : ""}`;
  if (!pick.key) return { state: "skipped", result: `${pick.why} — ${task}` };
  const label = stepLabel(pick.key);
  if (!before.some((s) => s.key === pick.key)) {
    return { state: "skipped", result: `${label} (${pick.why}) isn't on this job's stepper — ${task}`, detail: { department: label } };
  }

  const who = t.resourceName || t.resourceNo || "shop floor";
  const by = `Punch · ${who}`;

  // Where the job is in its flow, from a fresh read of its tracking row.
  await ensureFlowsLoaded();
  await refreshTrack(dv, t.jobNo);
  const track = useJobTrackingStore.getState().tracks.find((x) => x.jobNo === t.jobNo);
  const current = currentStatus(track).status;
  const stepKeys = before.map((s) => s.key);
  const flow = jobFlowFor(t.jobNo, stepKeys);
  const doneStatus = useJobFlowStore.getState().company.doneStatus;
  const doneBefore = parseStagesDone(track?.stagesDone ?? "");

  // A punch in a department means the job is past the lifecycle stages before
  // it (New Order, Upcoming Mfg, Purchasing…) — tick any still open, or the
  // status would follow the flow back to "New Order this week".
  const at0 = before.findIndex((s) => s.key === pick.key);
  const passed = before.slice(0, Math.max(0, at0)).filter((s) => s.state !== "completed" && isLifecycleKey(s.key) && !isManualOnlyKey(s.key)).map((s) => s.key);
  if (passed.length) {
    await useJobDeptCompletionStore.getState().completeMany(t.jobNo, passed, by, stepKeys);
    for (const k of passed) completed.add(k);
  }

  let what: string;
  let stagesDone = doneBefore;
  if (completed.has(pick.key)) {
    what = `${label} was already complete`;
  } else {
    const tick = applyTick(flow, pick.key, doneBefore, completed, current);
    stagesDone = tick.stagesDone;
    if (tick.completesStep) {
      await useJobDeptCompletionStore.getState().completeMany(t.jobNo, [pick.key], by, stepKeys);
      what = `Completed ${label}${tick.stage && flow.filter((s) => s.step === pick.key).length > 1 ? ` (last stage: ${tick.stage.status})` : ""} (${pick.why})`;
    } else {
      what = `Completed the ${tick.stage!.status} stage of ${label} — ${label} stays open (${pick.why})`;
    }
    if (JSON.stringify(stagesDone) !== JSON.stringify(doneBefore)) {
      await useJobTrackingStore.getState().setStagesDone(t.jobNo, stagesDone);
    }
  }

  // Current Status follows the flow's first open stage — normal production statuses only.
  const after = steps();
  const completedAfter = new Set(after.filter((s) => s.state === "completed").map((s) => s.key));
  const doneSet = new Set(stagesDone);
  const at = currentStage(flow, doneSet, completedAfter);
  const nextDept = at ? stepLabel(at.step) : flow.length ? "All steps complete" : "";
  const wanted = flowStatus(flow, doneStatus, doneSet, completedAfter);
  const target = flow.length && isFlowMovable(current, flow, doneStatus) && wanted !== current ? wanted : null;
  const detail = { department: label, nextDept, statusFrom: current, statusTo: target ?? "" };
  if (target) {
    const stamp = `${by} · ${format(new Date(), "M/d/yyyy")}`;
    await useJobTrackingStore.getState().setStatus(t.jobNo, target, stamp, stamp);
    return { state: "done", result: `${what} · status ${current} → ${target}`, detail };
  }
  return { state: "done", result: `${what} · status left as ${current}`, detail };
}

/** Handle every pending tick once (a run already going is left to finish). */
export async function processTaskCompletions(): Promise<void> {
  if (!LIVE || running) return;
  running = true;
  try {
    const dv = await import("../services/dataverse-live");
    const pending = await dv.fetchPendingTaskCompletions();
    if (!pending.length) return;
    if (!(await buildIsCurrent(dv))) return;
    // Fresh stepper + rules state, so another session's clicks are seen.
    await Promise.all([
      useJobDeptCompletionStore.getState().load(true),
      useJobDeptOverrideStore.getState().load(true),
      useJobFlowStore.getState().load(true),
    ]);
    for (const t of pending) {
      try {
        const out = await applyOne(t);
        await dv.markTaskCompletion(t.id, out.state, out.result, out.detail);
      } catch (e) {
        // Left "pending" — the next run tries again (every step is idempotent).
        console.warn(`[task-completions] BC entry ${t.entryNo} (${t.jobNo}) failed; will retry`, e);
      }
    }
  } catch (e) {
    console.warn("[task-completions] couldn't read pending ticks (table not created yet?)", e);
  } finally {
    running = false;
  }
}

/** Start the background loop (once per session). Returns a stop function. */
export function startTaskCompletionProcessor(): () => void {
  if (!LIVE) return () => {};
  void import("../services/dataverse-live")
    .then(recordBuild)
    .catch((e) => console.warn("[task-completions] couldn't record this build", e));
  const first = setTimeout(() => void processTaskCompletions(), FIRST_AFTER_MS);
  const every = setInterval(() => void processTaskCompletions(), EVERY_MS);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
