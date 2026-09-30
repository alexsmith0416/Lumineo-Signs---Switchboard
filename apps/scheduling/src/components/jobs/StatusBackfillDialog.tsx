import { useEffect, useState } from "react";
import type { JobRow } from "../../services/job-tracking";
import { planStatusBackfill, type StatusBackfillItem } from "../../services/job-status";
import { buildDepartmentSteps } from "../../services/production-steps";
import { useJobDeptCompletionStore } from "../../store/job-dept-completion-store";
import { useJobDeptOverrideStore } from "../../store/job-dept-override-store";
import { useCurrentUser } from "../../services/current-user";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

type Phase =
  | { kind: "planning" }
  | { kind: "ready"; plan: StatusBackfillItem[] }
  | { kind: "applying"; plan: StatusBackfillItem[]; done: number }
  | { kind: "done"; jobs: number }
  | { kind: "error"; message: string };

/**
 * One-time catch-up for the status automation: jobs already in a complete
 * status get every stepper step completed, jobs in an Installation status get
 * their production steps completed. Shows the counts first. Writes the
 * completions only — BC is brought in line afterwards with "Sync to BC".
 */
export default function StatusBackfillDialog({ rows, onClose }: { rows: JobRow[]; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "planning" });
  // The rows as they were when the dialog opened (the parent rebuilds its array).
  const [jobRows] = useState(rows);
  const { fullName, upn } = useCurrentUser();
  const by = `${fullName || upn || "Unknown"} (status backfill)`;

  useEffect(() => {
    if (!LIVE) {
      setPhase({ kind: "error", message: "The backfill only runs in the live app." });
      return;
    }
    let alive = true;
    (async () => {
      const dv = await import("../../services/dataverse-live");
      await Promise.all([useJobDeptCompletionStore.getState().load(true), useJobDeptOverrideStore.getState().load(true)]);
      const info = await dv.allJobStepInfo();
      const completions = useJobDeptCompletionStore.getState().byJob;
      const overrides = useJobDeptOverrideStore.getState().byJob;
      const plan = planStatusBackfill(
        jobRows.filter((r) => r.inBc),
        (jobNo) => {
          const i = info.get(jobNo) ?? { production: [], hasInstall: false };
          return buildDepartmentSteps(i.production, new Set(Object.keys(completions[jobNo] ?? {})), i.hasInstall, overrides[jobNo] ?? {});
        },
      );
      if (alive) setPhase({ kind: "ready", plan });
    })().catch((e) => alive && setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [jobRows]);

  const apply = async (plan: StatusBackfillItem[]) => {
    setPhase({ kind: "applying", plan, done: 0 });
    const completeMany = useJobDeptCompletionStore.getState().completeMany;
    for (let i = 0; i < plan.length; i += 6) {
      await Promise.all(
        plan.slice(i, i + 6).map((p) => completeMany(p.jobNo, p.keys, by, p.allKeys, { pushBc: false })),
      );
      setPhase({ kind: "applying", plan, done: Math.min(plan.length, i + 6) });
    }
    setPhase({ kind: "done", jobs: plan.length });
  };

  const sum = (plan: StatusBackfillItem[], kind: StatusBackfillItem["kind"]) => {
    const items = plan.filter((p) => p.kind === kind);
    return { jobs: items.length, steps: items.reduce((n, p) => n + p.keys.length, 0) };
  };
  const busy = phase.kind === "planning" || phase.kind === "applying";
  return (
    <div className="slide-over" onClick={busy ? undefined : onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Match steppers to status</div>
        <div className="slide-over__body jobs-sync">
          {phase.kind === "planning" && <p>Checking every job's stepper against its Current Status…</p>}
          {phase.kind === "ready" &&
            (phase.plan.length === 0 ? (
              <p>Every stepper already matches its job's status — nothing to change.</p>
            ) : (
              <>
                <p>
                  This will complete stepper steps on <strong>{phase.plan.length.toLocaleString()}</strong> jobs:
                </p>
                <ul>
                  <li>
                    <strong>{sum(phase.plan, "complete").jobs.toLocaleString()}</strong> jobs in a Complete status —{" "}
                    {sum(phase.plan, "complete").steps.toLocaleString()} steps (every step)
                  </li>
                  <li>
                    <strong>{sum(phase.plan, "install").jobs.toLocaleString()}</strong> jobs in an Installation status —{" "}
                    {sum(phase.plan, "install").steps.toLocaleString()} production steps
                  </li>
                </ul>
                <p className="jobs-sync__muted">
                  Completions are stamped “{by}”. BC isn't updated here — run <strong>Sync to BC</strong> afterwards.
                </p>
              </>
            ))}
          {phase.kind === "applying" && (
            <p>
              Updated {phase.done.toLocaleString()} of {phase.plan.length.toLocaleString()} jobs…
            </p>
          )}
          {phase.kind === "done" && (
            <p>
              Updated <strong>{phase.jobs.toLocaleString()}</strong> jobs. Run <strong>Sync to BC</strong> to send the
              new step states to BC.
            </p>
          )}
          {phase.kind === "error" && <p className="jobs-sync__error">Couldn't check the steppers: {phase.message}</p>}
        </div>
        <div className="users-admin__footer" style={{ gap: 8 }}>
          {phase.kind === "ready" && phase.plan.length > 0 ? (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => void apply(phase.plan)}>
                Update {phase.plan.length.toLocaleString()} jobs
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
