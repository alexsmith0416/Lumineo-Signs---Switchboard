/**
 * Applies the shop floor's "Task complete" ticks (crfdf_taskcompletion rows the
 * BCSync_TaskCompletions flow copies in as "pending"):
 *
 *  1. which department the tick completes (services/task-completion.ts);
 *  2. completes it on the job's stepper — the same store call as an editor's
 *     click, so the next department becomes active and BC Project Planning
 *     follows (stepper state push + job-level completion);
 *  3. moves Current Status to the new active step's status
 *     (services/status-rules.ts) — only from normal production statuses;
 *  4. records what it did on the row ("done" / "skipped" + why), shown in the
 *     Jobs panel's Shop floor list.
 *
 * Runs in the app of anyone who edits the whole Jobs list (Admin / Ops /
 * Developer, by their REAL login): every 2 minutes while it's open, so the
 * office's open sessions keep up through the day. Everything here is
 * idempotent — a department already complete is left, a status already right
 * isn't re-set — so two open sessions handling the same tick do no harm.
 */
import { format } from "date-fns";
import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";
import { ensureJobsLoaded, useJobTrackingStore } from "./job-tracking-store";
import { useStatusRulesStore } from "./status-rules-store";
import { buildDepartmentSteps, stepLabel } from "../services/production-steps";
import { currentStatus } from "../services/job-tracking";
import { deptForCompletion } from "../services/task-completion";
import { nextStatus } from "../services/status-rules";
import type { TaskCompletionDetail, TaskCompletionRow } from "../services/dataverse-live";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const EVERY_MS = 2 * 60_000;
const FIRST_AFTER_MS = 20_000;

let running = false;

async function stepsFor(jobNo: string) {
  const dv = await import("../services/dataverse-live");
  const info = await dv.jobStepInfo(jobNo);
  const steps = () =>
    buildDepartmentSteps(
      info.production,
      new Set(Object.keys(useJobDeptCompletionStore.getState().byJob[jobNo] ?? {})),
      info.hasInstall,
      useJobDeptOverrideStore.getState().byJob[jobNo] ?? {},
    );
  return steps;
}

type Outcome = { state: "done" | "skipped"; result: string; detail?: Partial<TaskCompletionDetail> };

/** The job's active step after the completion, for History ("All steps complete" when none is left). */
function nextDeptLabel(steps: ReadonlyArray<{ key: string; state: string }>): string {
  const active = steps.find((s) => s.state === "active");
  if (active) return stepLabel(active.key);
  return steps.length && steps.every((s) => s.state === "completed") ? "All steps complete" : "";
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
  let what: string;
  if (completed.has(pick.key)) {
    what = `${label} was already complete`;
  } else {
    await useJobDeptCompletionStore.getState().completeMany(t.jobNo, [pick.key], by, before.map((s) => s.key));
    what = `Completed ${label} (${pick.why})`;
  }

  // Current Status follows the new active step — normal production statuses only.
  await ensureJobsLoaded();
  const track = useJobTrackingStore.getState().tracks.find((x) => x.jobNo === t.jobNo);
  const current = currentStatus(track).status;
  const after = steps();
  const target = nextStatus(after, current, useStatusRulesStore.getState().rules);
  const detail = { department: label, nextDept: nextDeptLabel(after), statusFrom: current, statusTo: target ?? "" };
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
    // Fresh stepper + rules state, so another session's clicks are seen.
    await Promise.all([
      useJobDeptCompletionStore.getState().load(true),
      useJobDeptOverrideStore.getState().load(true),
      useStatusRulesStore.getState().load(true),
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
  const first = setTimeout(() => void processTaskCompletions(), FIRST_AFTER_MS);
  const every = setInterval(() => void processTaskCompletions(), EVERY_MS);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
