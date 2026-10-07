/**
 * Job flow (pure): the order a job moves through the shop, as STAGES — each a
 * stepper step + the Current Status it means. A step can have several stages
 * (Vinyl → "MFG - Vinyl Cut", then "MFG - Vinyl Application"); the stepper
 * department completes only after its last stage.
 *
 *  - The COMPANY flow (Settings → Job flow; crfdf_jobsview key "jobFlow") is
 *    the default for every job. Until it's edited it's built from the old
 *    Settings → Status rules, in the stepper's flow order.
 *  - A job uses the company flow, narrowed to the steps on ITS stepper —
 *    unless an editor has given it its own flow (crfdf_jobtrack.crfdf_flow).
 *  - The flow's step order is also the job's stepper order (which step goes
 *    active next — and what BC is told is Started).
 *  - Progress inside a step: crfdf_jobtrack.crfdf_stagesdone holds the stages
 *    done on steps that aren't complete yet. A completed stepper step counts
 *    every one of its stages as done.
 *
 * A shop-floor "Task complete" tick (store/task-completion-processor.ts)
 * completes the job's next open stage of that step; the Current Status then
 * follows the first open stage of the whole flow.
 */
import { ALL_STEP_DEFS, isManualOnlyKey } from "./production-steps";
import { ALL_DONE, DEFAULT_STATUS_RULES, OLD_DONE_STATUS, isAutoMovableStatus, type StatusRules } from "./status-rules";

export interface FlowStage {
  /** Stepper step key (S, R, MF, P, V, A, CR, MC, I). */
  step: string;
  /** The Current Status while the job is at this stage. */
  status: string;
}

export interface FlowConfig {
  stages: FlowStage[];
  /** Status once every stage is done. */
  doneStatus: string;
}

/** A stage's id — its step + status (a flow never holds the same pair twice). */
export const stageId = (s: FlowStage): string => `${s.step}|${s.status}`;

/** The company flow from the old step → status rules: one stage per step, stepper order. */
export function flowFromRules(rules: StatusRules = DEFAULT_STATUS_RULES): FlowConfig {
  return {
    stages: ALL_STEP_DEFS.map((d) => ({ step: d.key, status: rules[d.key] ?? "" })).filter((s) => s.status),
    doneStatus: rules[ALL_DONE] ?? DEFAULT_STATUS_RULES[ALL_DONE]!,
  };
}

const isStage = (v: unknown): v is FlowStage =>
  !!v && typeof (v as FlowStage).step === "string" && typeof (v as FlowStage).status === "string" &&
  !!(v as FlowStage).step && !!(v as FlowStage).status.trim();

/** Stages from stored JSON (an array) — null when blank / damaged / empty. Repeats dropped. */
export function parseStages(raw: unknown): FlowStage[] | null {
  let v = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return null;
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(v)) return null;
  const seen = new Set<string>();
  const out: FlowStage[] = [];
  for (const s of v) {
    if (!isStage(s)) continue;
    const st = { step: s.step, status: s.status.trim() };
    if (seen.has(stageId(st))) continue;
    seen.add(stageId(st));
    out.push(st);
  }
  return out.length ? out : null;
}

/** The company flow from its stored config value, else built from the old rules.
 *  A flow saved before the lifecycle stages (no Complete Invoiced stage, done
 *  status still the old "Complete-need paperwork") gets the new done status —
 *  "Complete-need paperwork" is now the Complete-Need Paperwork stage's. */
export function companyFlow(stored: unknown, rules: StatusRules = DEFAULT_STATUS_RULES): FlowConfig {
  const fallback = flowFromRules(rules);
  if (!stored || typeof stored !== "object") return fallback;
  const stages = parseStages((stored as { stages?: unknown }).stages);
  const done = (stored as { doneStatus?: unknown }).doneStatus;
  const doneStatus = typeof done === "string" && done.trim() ? done.trim() : fallback.doneStatus;
  const legacyDone = doneStatus === OLD_DONE_STATUS && !(stages ?? []).some((s) => s.step === "CI");
  return {
    stages: stages ?? fallback.stages,
    doneStatus: legacyDone ? DEFAULT_STATUS_RULES[ALL_DONE]! : doneStatus,
  };
}

/** Stage ids from stored JSON (an array of strings) — [] when blank / damaged. */
export function parseStagesDone(raw: unknown): string[] {
  let v = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try {
      v = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x))] : [];
}

/**
 * The flow one job follows. `stepKeys` = the steps on its stepper (BC lines +
 * editor adds / removes). Its own stages if it has them, else the company
 * flow's — either way only for steps on its stepper. A step on the stepper
 * with no stage gets one (the company flow's first stage for it, else the old
 * rule), placed after the stages of the step that precedes it in the
 * company order.
 */
export function effectiveFlow(company: FlowConfig, jobStages: FlowStage[] | null, stepKeys: readonly string[]): FlowStage[] {
  const keys = new Set(stepKeys);
  const out = (jobStages ?? company.stages).filter((s) => keys.has(s.step));
  const have = new Set(out.map((s) => s.step));
  const companyOrder = stepOrder(company.stages);
  const defaultOrder = ALL_STEP_DEFS.map((d) => d.key);
  const rank = (k: string) => {
    const i = companyOrder.indexOf(k);
    return i >= 0 ? i : companyOrder.length + defaultOrder.indexOf(k);
  };
  for (const k of [...keys].sort((a, b) => rank(a) - rank(b))) {
    if (have.has(k)) continue;
    const stage = company.stages.find((s) => s.step === k) ?? { step: k, status: DEFAULT_STATUS_RULES[k] ?? "" };
    if (!stage.status) continue;
    // A step the company flow names: after the last stage of the nearest step
    // before it in the company order. One it doesn't name (e.g. the lifecycle
    // stages in a flow saved before they existed): after the nearest step that
    // precedes it in the DEFAULT order — so New Order lands first and Complete
    // Invoiced last, not at the end.
    const before = companyOrder.includes(k)
      ? (step: string) => rank(step) < rank(k)
      : (step: string) => defaultOrder.indexOf(step) < defaultOrder.indexOf(k);
    let at = 0;
    for (let i = out.length - 1; i >= 0; i--) {
      if (before(out[i]!.step)) {
        at = i + 1;
        break;
      }
    }
    out.splice(at, 0, { ...stage });
    have.add(k);
  }
  return out;
}

/** The step order a flow sets — each step at its first stage. */
export function stepOrder(stages: readonly FlowStage[]): string[] {
  const out: string[] = [];
  for (const s of stages) if (!out.includes(s.step)) out.push(s.step);
  return out;
}

/** Is this stage done? A completed step's stages all are; otherwise only the ones recorded. */
export function isStageDone(s: FlowStage, stagesDone: ReadonlySet<string>, completedSteps: ReadonlySet<string>): boolean {
  return completedSteps.has(s.step) || stagesDone.has(stageId(s));
}

/** The first stage not done — where the job is now (null = every stage done).
 *  A manual-only step (Purchasing) left open doesn't hold the job there: the
 *  status follows the departments, not the purchaser's to-do. */
export function currentStage(
  flow: readonly FlowStage[],
  stagesDone: ReadonlySet<string>,
  completedSteps: ReadonlySet<string>,
): FlowStage | null {
  return flow.find((s) => !isManualOnlyKey(s.step) && !isStageDone(s, stagesDone, completedSteps)) ?? null;
}

/** The Current Status a flow puts the job on now. */
export function flowStatus(
  flow: readonly FlowStage[],
  doneStatus: string,
  stagesDone: ReadonlySet<string>,
  completedSteps: ReadonlySet<string>,
): string {
  return currentStage(flow, stagesDone, completedSteps)?.status ?? doneStatus;
}

export interface TickResult {
  /** The stage this tick completes (null = the step has no stage in the flow). */
  stage: FlowStage | null;
  /** True when that was the step's last open stage — the stepper department completes. */
  completesStep: boolean;
  /** crfdf_stagesdone after the tick (a completing step's stages are dropped: the step holds them now). */
  stagesDone: string[];
}

/**
 * A "Task complete" tick on `step`: completes its first open stage. A status
 * set by hand on one of the step's later stages counts as the earlier ones
 * being done (someone moved the job on), so the tick completes the stage the
 * job is actually at.
 */
export function applyTick(
  flow: readonly FlowStage[],
  step: string,
  stagesDone: readonly string[],
  completedSteps: ReadonlySet<string>,
  currentStatus: string,
): TickResult {
  const mine = flow.filter((s) => s.step === step);
  const done = new Set(stagesDone);
  if (!mine.length) return { stage: null, completesStep: true, stagesDone: [...done] };
  const atStatus = mine.findIndex((s) => s.status === currentStatus);
  for (let i = 0; i < atStatus; i++) done.add(stageId(mine[i]!));
  const open = mine.filter((s) => !isStageDone(s, done, completedSteps));
  const stage = open[0] ?? mine[mine.length - 1]!;
  if (open.length <= 1) {
    for (const s of mine) done.delete(stageId(s));
    return { stage, completesStep: true, stagesDone: [...done] };
  }
  done.add(stageId(stage));
  return { stage, completesStep: false, stagesDone: [...done] };
}

/** May a job on `status` be moved automatically by this flow? (Holds / special statuses never are.) */
export function isFlowMovable(status: string, flow: readonly FlowStage[], doneStatus: string): boolean {
  return isAutoMovableStatus(status, [...flow.map((s) => s.status), doneStatus]);
}

/** The step a status belongs to in a flow (its first stage with that status), for History. */
export function stepForStatus(stages: readonly FlowStage[], doneStatus: string, status: string): string | null {
  if (!status) return null;
  if (status === doneStatus) return ALL_DONE;
  return stages.find((s) => s.status === status)?.step ?? null;
}

// ---- Editing (Settings → Job flow and the job panel) ----------------------

/** Move the stage at `i` by `by` places (−1 up, +1 down). */
export function moveStage(stages: readonly FlowStage[], i: number, by: number): FlowStage[] {
  const j = i + by;
  if (i < 0 || i >= stages.length || j < 0 || j >= stages.length) return [...stages];
  const out = [...stages];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Change one stage; refused (unchanged) when it would repeat another stage's step + status. */
export function updateStage(stages: readonly FlowStage[], i: number, next: FlowStage): FlowStage[] {
  if (!next.step || !next.status.trim()) return [...stages];
  const id = stageId(next);
  if (stages.some((s, k) => k !== i && stageId(s) === id)) return [...stages];
  return stages.map((s, k) => (k === i ? { step: next.step, status: next.status.trim() } : s));
}

/** Add a stage right after the step's last stage (or at the end); refused when it repeats one. */
export function addStage(stages: readonly FlowStage[], next: FlowStage): FlowStage[] {
  if (!next.step || !next.status.trim() || stages.some((s) => stageId(s) === stageId(next))) return [...stages];
  const at = stages.map((s) => s.step).lastIndexOf(next.step);
  const out = [...stages];
  out.splice(at >= 0 ? at + 1 : out.length, 0, { step: next.step, status: next.status.trim() });
  return out;
}

export function removeStage(stages: readonly FlowStage[], i: number): FlowStage[] {
  return stages.filter((_, k) => k !== i);
}
