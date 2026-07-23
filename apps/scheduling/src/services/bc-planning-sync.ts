/**
 * BC planning-step write-back — payload builders (pure).
 *
 * The scheduler is the authority for the START/END times, the ASSIGNEE, and the
 * STARTED/COMPLETE state of the production + install *labor* steps of a BC job.
 * When a user commits one of those on the board, we push it back to Business
 * Central's `projectPlanningEntries` custom API (infotechConsultingGroup/
 * sign365/v1.0) so the BC Project Planning list mirrors the board.
 *
 * This module is PURE — it only turns app state into a transport-agnostic
 * `BcPlanningPush`. The actual write is done by `enqueueBcPush()` in
 * `dataverse-live.ts` (writes an outbox row) + a Power Automate flow
 * (BCPush_PlanningSteps) that PATCHes BC. Keeping the mapping here makes it
 * unit-testable without the Power runtime.
 *
 * ── The identity/granularity gap ─────────────────────────────────────────────
 * A ScheduleLine is one row per *department* per job; a BC planning entry is one
 * row per *step*. We join on `jobNo` + `planningStep` (the app's
 * planningLineDescription is copied straight from the BC planning line
 * description, so they match). The flow resolves that to the entry's systemId
 * and PATCHes it. See flows/BCPush_PlanningSteps.md.
 */
import type { ScheduleLine } from "../engine/types";

export type BcPushKind = "schedule" | "completion";

/** A transport-agnostic instruction to update one BC planning step. */
export interface BcPlanningPush {
  kind: BcPushKind;
  /** BC project/job number — projectPlanningEntries.projectNo (aux index 2/4). */
  jobNo: string;
  /** BC step description — projectPlanningEntries.planningStepDescription. The
   *  join key together with jobNo. Empty on department-level completion pushes,
   *  where the flow resolves every step of `deptKey`'s resource band. */
  planningStep: string;
  /** App department id/key — lets the flow resolve which BC steps a
   *  department-level completion applies to. */
  deptKey: string;
  /** ISO 8601, or null when this push doesn't set the time (completion). */
  startDateTime: string | null;
  endDateTime: string | null;
  /** Who the step is scheduled to — the BC resource number, resolved in-app from
   *  the roster employee's crfdf_no. Passed straight to BC's `assignedTo`. "" for
   *  team/department lines and completion pushes. */
  assignedTo: string;
  assignedToName: string;
  complete: boolean;
  /** A step that has a scheduled slot on the board is "started" in BC terms. */
  started: boolean;
  /** Source schedule-line id — traceability + de-dupe in the outbox. */
  sourceLineId: string;
}

const iso = (d: Date | null | undefined): string | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;

/**
 * Whether a schedule line should sync to BC. Custom cards (PTO, group
 * containers) and lines with no BC job number or planning-step text have no
 * planning entry behind them, so they never sync.
 */
export function shouldSyncLine(
  line: Pick<ScheduleLine, "jobNo" | "isCustom" | "planningLineDescription">,
): boolean {
  return Boolean(line.jobNo) && !line.isCustom && Boolean(line.planningLineDescription);
}

/** Build a start/end + assignee push from a committed schedule line, or null
 *  when the line isn't BC-backed. */
export function buildSchedulePush(
  line: ScheduleLine,
  opts: { assignedTo?: string; assignedToName?: string } = {},
): BcPlanningPush | null {
  if (!shouldSyncLine(line)) return null;
  return {
    kind: "schedule",
    jobNo: line.jobNo,
    planningStep: line.planningLineDescription,
    deptKey: line.departmentId,
    startDateTime: iso(line.startDateTime),
    endDateTime: iso(line.endDateTime),
    assignedTo: opts.assignedTo ?? "",
    assignedToName: opts.assignedToName ?? "",
    complete: false,
    started: true, // scheduled on the board ⇒ started in BC
    sourceLineId: line.id,
  };
}

/** Build a started/complete push for a department the stepper just toggled. */
export function buildCompletionPush(input: {
  jobNo: string;
  deptKey: string;
  complete: boolean;
  planningStep?: string;
  completedBy?: string;
}): BcPlanningPush | null {
  if (!input.jobNo || !input.deptKey) return null;
  return {
    kind: "completion",
    jobNo: input.jobNo,
    planningStep: input.planningStep ?? "",
    deptKey: input.deptKey,
    startDateTime: null,
    endDateTime: null,
    assignedTo: "",
    assignedToName: input.completedBy ?? "",
    complete: input.complete,
    // Completing (or re-opening) a dept implies it was at least started.
    started: true,
    sourceLineId: "",
  };
}

/** Human-readable primary-name for the outbox row. */
export function pushRowName(p: BcPlanningPush): string {
  const step = p.planningStep || p.deptKey || p.kind;
  return `${p.jobNo} · ${step}`.slice(0, 100);
}
