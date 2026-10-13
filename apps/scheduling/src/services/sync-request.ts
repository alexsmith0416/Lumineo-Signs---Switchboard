/**
 * "Check BC now" (Oct 12, 2026). The app adds a crfdf_syncrequest row per BC
 * pull; each pull's flow fires on its row, runs, and writes Status (Requested →
 * Running → Done / Failed) and a Result line back. BCSync_Scheduler asks the
 * same way on each pull's regular timing, so a button press during a
 * scheduled run waits its turn (one run at a time per pull).
 *
 * Pure: the pulls, and what a request row says given how long the app has
 * been waiting.
 */
export type SyncKind = "taskcompletions" | "neworders" | "jobdescriptions" | "jobpos" | "jobsketches";

export interface SyncPull {
  kind: SyncKind;
  /** Shown before its result: "Shop-floor ticks: 2 new shop-floor ticks". */
  label: string;
  flow: string;
}

/** Every pull Check BC now runs, in the order the results are listed. */
export const SYNC_PULLS: SyncPull[] = [
  { kind: "taskcompletions", label: "Shop-floor & install ticks", flow: "BCSync_TaskCompletions" },
  { kind: "neworders", label: "New orders", flow: "BCSync_NewOrders" },
  { kind: "jobdescriptions", label: "Descriptions", flow: "BCSync_JobDescriptions" },
  { kind: "jobpos", label: "Purchase orders", flow: "BCSync_JobPOs" },
  { kind: "jobsketches", label: "Sketches", flow: "BCSync_JobSketches" },
];

export type SyncPhase = "waiting" | "running" | "done" | "failed";

export interface SyncView {
  phase: SyncPhase;
  message: string;
}

/** How often the app re-reads its requests. */
export const SYNC_POLL_MS = 3000;
/** Not picked up after this long → the flow is probably off. */
export const SYNC_PICKUP_LIMIT_MS = 5 * 60_000;
/** Still running after this long → stop watching (the flow keeps going). */
export const SYNC_RUN_LIMIT_MS = 20 * 60_000;

const flowOf = (kind: SyncKind) => SYNC_PULLS.find((p) => p.kind === kind)?.flow ?? kind;

export function readSyncRequest(
  kind: SyncKind,
  row: { status: string; result: string } | null,
  waitedMs: number,
): SyncView {
  const flow = flowOf(kind);
  if (!row) return { phase: "failed", message: "The request was removed before it finished." };
  const status = row.status.trim().toLowerCase();
  if (status === "done") return { phase: "done", message: row.result || "Done." };
  if (status === "failed") return { phase: "failed", message: row.result || `${flow} couldn't check BC.` };
  if (status === "running") {
    return waitedMs > SYNC_RUN_LIMIT_MS
      ? { phase: "failed", message: `${flow} is taking unusually long — it keeps going; press Refresh later.` }
      : { phase: "running", message: "Checking…" };
  }
  // Requested: waiting for the flow to pick it up (or for a scheduled run to finish first).
  if (waitedMs > SYNC_PICKUP_LIMIT_MS) {
    return { phase: "failed", message: `${flow} didn't pick the request up — check that it's turned on in Power Automate.` };
  }
  return { phase: "waiting", message: waitedMs > 60_000 ? "Waiting its turn…" : "Asking…" };
}

/** The whole check's state from each pull's: busy while any is, else failed if any failed. */
export function overallPhase(phases: SyncPhase[]): SyncPhase | "idle" {
  if (!phases.length) return "idle";
  if (phases.some((p) => p === "waiting" || p === "running")) return "running";
  return phases.some((p) => p === "failed") ? "failed" : "done";
}
