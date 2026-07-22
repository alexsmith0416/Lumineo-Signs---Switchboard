import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import DepartmentStepper, { type DepartmentStep } from "./DepartmentStepper";
import { bcHasStep, buildDepartmentSteps, missingStepDefs } from "../services/production-steps";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";
import { useJobDeptOverrideStore } from "../store/job-dept-override-store";
import { isAdminLevel, useCurrentUser } from "../services/current-user";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/**
 * Production stepper for a job — the departments its planning lines need (plus a
 * final Install step), in flow order, with standing (included / active /
 * completed). Anyone can complete a step: click a department (it glows), then a
 * blue Complete button appears. Editors (Admin / Ops / Developer) also get an
 * Edit button to add a missing department, a red Delete under a selected node,
 * and can mark extra departments active. Each completion is stamped who + when.
 */
export default function ProductionStepperSection({ jobNo }: { jobNo: string }) {
  const { fullName, upn, realType } = useCurrentUser();
  const canEdit = isAdminLevel(realType);
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

  const loadCompletions = useJobDeptCompletionStore((s) => s.load);
  const jobCompletions = useJobDeptCompletionStore((s) => s.byJob[jobNo]);
  const setComplete = useJobDeptCompletionStore((s) => s.setComplete);
  const loadOverrides = useJobDeptOverrideStore((s) => s.load);
  const overrides = useJobDeptOverrideStore((s) => s.byJob[jobNo]) ?? {};
  const setOverride = useJobDeptOverrideStore((s) => s.setOverride);
  const clearOverride = useJobDeptOverrideStore((s) => s.clearOverride);
  useEffect(() => {
    void loadCompletions();
    void loadOverrides();
  }, [loadCompletions, loadOverrides]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const prod = info?.production ?? [];
  const hasInstall = info?.hasInstall ?? false;

  const steps = useMemo(() => {
    const completed = new Set(Object.keys(jobCompletions ?? {}));
    return buildDepartmentSteps(prod, completed, hasInstall, overrides);
  }, [prod, hasInstall, jobCompletions, overrides]);

  const missing = useMemo(
    () => (canEdit ? missingStepDefs(prod, hasInstall, overrides) : []),
    [canEdit, prod, hasInstall, overrides],
  );

  if (!info) return null;
  // Nothing to show unless there are steps or an editor can add some.
  if (steps.length === 0 && !canEdit) return null;

  const selected = steps.find((s) => s.key === selectedKey) ?? null;

  const onNodeClick = (step: DepartmentStep) => {
    setSelectedKey((k) => (k === step.key ? null : step.key));
  };

  // --- Editor edits (map UI actions onto override rows) ---------------------
  const removeDept = (key: string) => {
    if (bcHasStep(key, prod, hasInstall)) void setOverride(jobNo, key, { included: false, active: false });
    else void clearOverride(jobNo, key); // an added dept — just drop its row
    setSelectedKey(null);
  };
  const addDept = (key: string) => {
    if (bcHasStep(key, prod, hasInstall)) void clearOverride(jobNo, key); // restore a removed BC dept
    else void setOverride(jobNo, key, { included: true, active: false });
  };
  const setActive = (key: string, active: boolean) => {
    const ov = overrides[key];
    const included = ov ? ov.included : true; // it's shown, so it's included
    if (bcHasStep(key, prod, hasInstall) && included && !active) {
      void clearOverride(jobNo, key); // plain BC dept, no other override → drop row
    } else {
      void setOverride(jobNo, key, { included, active });
    }
  };

  // Completed steps, with who/when, in flow order.
  const doneStamps = steps
    .filter((s) => s.state === "completed")
    .map((s) => ({ key: s.key, label: s.label, stamp: jobCompletions?.[s.key] }));

  return (
    <div className="job-stepper">
      <div className="job-stepper__label">
        Production stage
        <span className="job-stepper__hint"> · click a department, then Complete</span>
        {canEdit && (
          <button
            type="button"
            className={`job-stepper__edit${editing ? " is-on" : ""}`}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {steps.length > 0 ? (
        <DepartmentStepper steps={steps} onNodeClick={onNodeClick} selectedKey={selectedKey} />
      ) : (
        <div className="job-stepper__empty-note">No production stages yet — add one below.</div>
      )}

      {/* Action panel for the selected department. */}
      {selected && (
        <div className="job-stepper__actions">
          <span className="job-stepper__actions-label">{selected.label}</span>
          {selected.state === "completed" ? (
            <>
              <span className="job-stepper__done-tag">
                ✓ {jobCompletions?.[selected.key]?.by || "done"}
                {jobCompletions?.[selected.key]?.date
                  ? ` · ${format(jobCompletions[selected.key]!.date!, "MMM d")}`
                  : ""}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="btn-secondary job-stepper__btn"
                  onClick={() => void setComplete(jobNo, selected.key, me, false)}
                >
                  Reopen
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="job-stepper__complete"
              onClick={() => {
                void setComplete(jobNo, selected.key, me, true);
                setSelectedKey(null);
              }}
            >
              Complete
            </button>
          )}
          {canEdit && selected.state !== "completed" && (
            <button
              type="button"
              className="btn-secondary job-stepper__btn"
              onClick={() => setActive(selected.key, !overrides[selected.key]?.active)}
              title="Mark this department as an additional active step"
            >
              {overrides[selected.key]?.active ? "Unset active" : "Set active"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="job-stepper__delete"
              onClick={() => removeDept(selected.key)}
              title="Remove this department from the stepper"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Editor: add a missing department. */}
      {canEdit && editing && missing.length > 0 && (
        <div className="job-stepper__add">
          <span className="job-stepper__actions-label">Add department:</span>
          {missing.map((d) => (
            <button
              key={d.key}
              type="button"
              className="btn-secondary job-stepper__btn"
              onClick={() => addDept(d.key)}
            >
              + {d.label}
            </button>
          ))}
        </div>
      )}

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
