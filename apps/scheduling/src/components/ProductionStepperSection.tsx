import { useEffect, useMemo, useState } from "react";
import DepartmentStepper from "./DepartmentStepper";
import { buildDepartmentSteps } from "../services/production-steps";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/**
 * Production stepper for a job — the departments its planning lines need, in
 * flow order, with their standing (included / active / completed). Shown in the
 * card details between the task text and the hours. Phase 4 adds click-to-complete.
 */
export default function ProductionStepperSection({ jobNo }: { jobNo: string }) {
  // The job's production departments (from BC planning lines) — live only.
  const [deptNames, setDeptNames] = useState<string[] | null>(null);
  useEffect(() => {
    if (!LIVE || !jobNo) {
      setDeptNames([]);
      return;
    }
    let alive = true;
    void import("../services/dataverse-live")
      .then((m) => m.jobProductionDepartments(jobNo))
      .then((d) => {
        if (alive) setDeptNames(d);
      })
      .catch(() => {
        if (alive) setDeptNames([]);
      });
    return () => {
      alive = false;
    };
  }, [jobNo]);

  const load = useJobDeptCompletionStore((s) => s.load);
  const jobCompletions = useJobDeptCompletionStore((s) => s.byJob[jobNo]);
  useEffect(() => {
    void load();
  }, [load]);

  const steps = useMemo(() => {
    const completed = new Set(Object.keys(jobCompletions ?? {}));
    return buildDepartmentSteps(deptNames ?? [], completed);
  }, [deptNames, jobCompletions]);

  if (!deptNames || steps.length === 0) return null;

  return (
    <div className="job-stepper">
      <div className="job-stepper__label">Production stage</div>
      <DepartmentStepper steps={steps} />
    </div>
  );
}
