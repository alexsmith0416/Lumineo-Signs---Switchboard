import { useEffect, useState } from "react";
import type { FullSyncPlan } from "../../services/bc-full-sync";
import { planBcSync, sendBcSync } from "../../store/bc-full-sync-run";
import { ensureJobsLoaded, useJobTrackingStore } from "../../store/job-tracking-store";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

type Phase =
  | { kind: "planning" }
  | { kind: "ready"; plan: FullSyncPlan }
  | { kind: "sending"; plan: FullSyncPlan; done: number }
  | { kind: "done"; queued: number; failed: number }
  | { kind: "error"; message: string };

/**
 * "Sync to BC": works out what BC Project Planning should say for every tracked
 * job — Started / Complete from the stepper, dates + assignee only for steps on
 * the calendar — shows what would change, and queues it on confirm. The
 * BCPush_PlanningSteps flow then writes it to BC. Opened from Settings →
 * Business Central; it loads the tracked jobs itself.
 */
export default function BcSyncDialog({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "planning" });
  const [jobCount, setJobCount] = useState(0);

  useEffect(() => {
    if (!LIVE) {
      setPhase({ kind: "error", message: "Sync to BC only runs in the live app." });
      return;
    }
    let alive = true;
    (async () => {
      await ensureJobsLoaded();
      // The tracked jobs as they are now — a re-plan mid-dialog would reset the count.
      const jobs = useJobTrackingStore.getState().tracks.map((t) => t.jobNo);
      if (alive) setJobCount(jobs.length);
      return planBcSync(jobs);
    })()
      .then((plan) => alive && setPhase({ kind: "ready", plan }))
      .catch((e) => alive && setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, []);

  const send = async (plan: FullSyncPlan) => {
    setPhase({ kind: "sending", plan, done: 0 });
    const r = await sendBcSync(plan, (done) => setPhase({ kind: "sending", plan, done }));
    setPhase({ kind: "done", ...r });
  };

  const busy = phase.kind === "planning" || phase.kind === "sending";
  return (
    <div className="slide-over" onClick={busy ? undefined : onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Sync to Business Central</div>
        <div className="slide-over__body jobs-sync">
          {phase.kind === "planning" && <p>Comparing {jobCount ? `${jobCount.toLocaleString()} tracked jobs` : "the tracked jobs"} with what BC was last sent…</p>}
          {phase.kind === "ready" && (
            phase.plan.pushes.length === 0 ? (
              <p>BC is already up to date — nothing to send.</p>
            ) : (
              <>
                <p>
                  This will update <strong>{phase.plan.jobs.toLocaleString()}</strong> jobs in BC Project Planning:
                </p>
                <ul>
                  <li><strong>{phase.plan.stateChanges.toLocaleString()}</strong> Started / Complete changes (from the steppers — active departments are Started, which is what lists a job in BC's step tiles)</li>
                  <li><strong>{phase.plan.scheduleChanges.toLocaleString()}</strong> date / assignee changes (only for steps that are on the calendar)</li>
                </ul>
                <p className="jobs-sync__muted">
                  {phase.plan.unchanged.toLocaleString()} steps already match and are skipped. The updates reach BC over
                  the next while — a big first sync can take some time to work through.
                </p>
              </>
            )
          )}
          {phase.kind === "sending" && (
            <p>
              Queuing {phase.done.toLocaleString()} of {phase.plan.pushes.length.toLocaleString()}…
            </p>
          )}
          {phase.kind === "done" && (
            <p>
              Queued <strong>{phase.queued.toLocaleString()}</strong> updates for BC.
              {phase.failed > 0 && <> <strong>{phase.failed}</strong> couldn't be queued — run Sync again to retry them.</>}
            </p>
          )}
          {phase.kind === "error" && <p className="jobs-sync__error">Couldn't prepare the sync: {phase.message}</p>}
        </div>
        <div className="users-admin__footer" style={{ gap: 8 }}>
          {phase.kind === "ready" && phase.plan.pushes.length > 0 ? (
            <>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={() => void send(phase.plan)}>
                Send {phase.plan.pushes.length.toLocaleString()} updates
              </button>
            </>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={onClose}>
              {busy ? "Working…" : "Close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
