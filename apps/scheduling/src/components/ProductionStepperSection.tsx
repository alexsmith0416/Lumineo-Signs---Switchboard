import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import DepartmentStepper, { type DepartmentStep } from "./DepartmentStepper";
import { buildDepartmentSteps } from "../services/production-steps";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";
import { isAdminLevel, useCurrentUser } from "../services/current-user";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/**
 * Production stepper for a job — the departments its planning lines need (plus a
 * final Install step), in flow order, with standing (included / active /
 * completed). Admin / Ops / Developer can click a node to complete or re-open a
 * step; each completion is stamped with who + when.
 */
export default function ProductionStepperSection({ jobNo }: { jobNo: string }) {
  const { fullName, upn, realType } = useCurrentUser();
  const canEditSteps = isAdminLevel(realType);
  const me = fullName || upn || "Unknown";

  // The job's production departments + whether it has install work — live only.
  const [info, setInfo] = useState<{ production: string[]; hasInstall: boolean } | null>(null);
  useEffect(() => {
    if (!LIVE || !jobNo) {
      setInfo({ production: [], hasInstall: false });
      return;
    }
    let alive = true;
    void import("../services/dataverse-live")
      .then((m) => m.jobStepInfo(jobNo))
      .then((d) => {
        if (alive) setInfo(d);
      })
      .catch(() => {
        if (alive) setInfo({ production: [], hasInstall: false });
      });
    return () => {
      alive = false;
    };
  }, [jobNo]);

  const load = useJobDeptCompletionStore((s) => s.load);
  const jobCompletions = useJobDeptCompletionStore((s) => s.byJob[jobNo]);
  const setComplete = useJobDeptCompletionStore((s) => s.setComplete);
  useEffect(() => {
    void load();
  }, [load]);

  const steps = useMemo(() => {
    const completed = new Set(Object.keys(jobCompletions ?? {}));
    return buildDepartmentSteps(info?.production ?? [], completed, info?.hasInstall ?? false);
  }, [info, jobCompletions]);

  if (!info || steps.length === 0) return null;

  const onNodeClick = (step: DepartmentStep) => {
    if (!canEditSteps) return;
    void setComplete(jobNo, step.key, me, step.state !== "completed");
  };

  // Completed steps, with who/when, in flow order.
  const doneStamps = steps
    .filter((s) => s.state === "completed")
    .map((s) => ({ key: s.key, label: s.label, stamp: jobCompletions?.[s.key] }));

  return (
    <div className="job-stepper">
      <div className="job-stepper__label">
        Production stage
        {canEditSteps && <span className="job-stepper__hint"> · click a node to mark done</span>}
      </div>
      <DepartmentStepper steps={steps} onNodeClick={canEditSteps ? onNodeClick : undefined} />
      {doneStamps.length > 0 && (
        <div>
          <div className="job-stepper__log-title">Completed</div>
          <div className="job-stepper__log">
            {doneStamps.map((d) => (
              <div key={d.key}>
                <strong>{d.label}</strong> · {d.stamp?.by || "—"}
                {d.stamp?.date ? ` · ${format(d.stamp.date, "MMM d")}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
