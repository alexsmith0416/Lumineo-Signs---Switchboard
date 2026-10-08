import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import DepartmentStepper, { type DepartmentStep } from "./DepartmentStepper";
import { bcHasStep, buildDepartmentSteps, missingStepDefs } from "../services/production-steps";
import { buildServiceSteps, missingServiceStepDefs } from "../services/service-steps";
import { useJobDeptCompletionStore, type CompletionStamp } from "../store/job-dept-completion-store";
import { useJobDeptOverrideStore } from "../store/job-dept-override-store";
import { isAdminLevel, useCurrentUser } from "../services/current-user";
import { cachedJobStepInfo } from "../hooks/useJobSteps";
import { useStepOrder } from "../store/job-flow-store";
import { useIsServiceJob } from "../store/service-jobs-store";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/**
 * A job's steppers. PRODUCTION: the departments its planning lines need (+
 * Install), in its flow order, each included / active / completed — the job's
 * lifecycle is its Current Status, not stepper steps (Oct 7). SERVICE (service
 * / contract jobs — BC Order Type SERVICE, SIGNCONT, MNTCCONT): Survey →
 * Service → Complete to Admin → Complete Invoiced, below it.
 *
 * Anyone can complete a step: click it (it glows), then Complete. Editors
 * (Admin / Ops / Developer) also get Edit to add a missing step, Delete under
 * a selected one, Reopen, and Set active. Each completion is stamped who +
 * when. Completing Install moves the job to Complete-need paperwork; the
 * Service stepper's Complete to Admin completes a service job in BC.
 */
export default function ProductionStepperSection({ jobNo }: { jobNo: string }) {
  const { fullName, upn, realType } = useCurrentUser();
  const canEdit = isAdminLevel(realType);
  const me = fullName || upn || "Unknown";

  // The job's production departments + whether it has install work — live only.
  // Starts from the Jobs list's bulk-loaded info when there is one, so it draws
  // at once; the fresh read below then replaces it.
  const [info, setInfo] = useState<{ production: string[]; hasInstall: boolean } | null>(
    () => (jobNo ? cachedJobStepInfo(jobNo) ?? null : null),
  );
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

  const prod = info?.production ?? [];
  const hasInstall = info?.hasInstall ?? false;
  const service = useIsServiceJob(jobNo);

  const order = useStepOrder(jobNo);
  const completed = useMemo(() => new Set(Object.keys(jobCompletions ?? {})), [jobCompletions]);
  const steps = useMemo(
    () => buildDepartmentSteps(prod, completed, hasInstall, overrides, order, service),
    [prod, completed, hasInstall, overrides, order, service],
  );
  const serviceSteps = useMemo(() => (service ? buildServiceSteps(completed, overrides) : []), [service, completed, overrides]);

  const missing = useMemo(
    () => (canEdit ? missingStepDefs(prod, hasInstall, overrides, service) : []),
    [canEdit, prod, hasInstall, overrides, service],
  );
  const missingService = useMemo(
    () => (canEdit && service ? missingServiceStepDefs(overrides) : []),
    [canEdit, service, overrides],
  );

  // Every step on both steppers — passed to setComplete so the store can tell
  // when Complete to Admin closes the job and push job completion to BC.
  const stepKeys = useMemo(() => [...steps, ...serviceSteps].map((s) => s.key), [steps, serviceSteps]);

  if (!info) return null;

  // --- Editor edits (map UI actions onto override rows) ---------------------
  // A step the job has by default is removed / restored with an "included:
  // false" row; one it doesn't (an added department) gets an "included: true"
  // row. Service steps are all there by default.
  const hasByDefault = (key: string) =>
    serviceSteps.some((s) => s.key === key) || missingService.some((s) => s.key === key)
      ? true
      : bcHasStep(key, prod, hasInstall, service);
  const remove = (key: string) => {
    if (hasByDefault(key)) void setOverride(jobNo, key, { included: false, active: false });
    else void clearOverride(jobNo, key); // an added step — just drop its row
  };
  const add = (key: string) => {
    if (hasByDefault(key)) void clearOverride(jobNo, key); // restore a removed default step
    else void setOverride(jobNo, key, { included: true, active: false });
  };
  const setActive = (key: string, active: boolean) => {
    const ov = overrides[key];
    const included = ov ? ov.included : true; // it's shown, so it's included
    if (hasByDefault(key) && included && !active) void clearOverride(jobNo, key);
    else void setOverride(jobNo, key, { included, active });
  };
  const actions = {
    canEdit,
    stamps: jobCompletions,
    complete: (key: string) => void setComplete(jobNo, key, me, true, stepKeys),
    reopen: (key: string) => void setComplete(jobNo, key, me, false, stepKeys),
    toggleActive: (key: string) => setActive(key, !overrides[key]?.active),
    isMarkedActive: (key: string) => !!overrides[key]?.active,
    remove,
    add,
  };

  // Nothing to show unless there are steps or an editor can add some.
  const showProduction = steps.length > 0 || (canEdit && !service);
  if (!showProduction && !service) return null;

  return (
    <>
      {showProduction && (
        <StepperBlock
          title="Production stage"
          hint="click a department, then Complete"
          emptyNote="No production stages yet — add one below."
          addLabel="Add stage:"
          steps={steps}
          missing={missing}
          {...actions}
        />
      )}
      {service && (
        <StepperBlock
          title="Service"
          hint="service / contract order"
          emptyNote="No service steps — add one below."
          addLabel="Add step:"
          steps={serviceSteps}
          missing={missingService}
          {...actions}
        />
      )}
    </>
  );
}

/** One stepper with its click-to-act panel, editor Add, and the Completed log. */
function StepperBlock({
  title,
  hint,
  emptyNote,
  addLabel,
  steps,
  missing,
  canEdit,
  stamps,
  complete,
  reopen,
  toggleActive,
  isMarkedActive,
  remove,
  add,
}: {
  title: string;
  hint: string;
  emptyNote: string;
  addLabel: string;
  steps: DepartmentStep[];
  missing: Array<{ key: string; label: string }>;
  canEdit: boolean;
  stamps: Record<string, CompletionStamp> | undefined;
  complete: (key: string) => void;
  reopen: (key: string) => void;
  toggleActive: (key: string) => void;
  isMarkedActive: (key: string) => boolean;
  remove: (key: string) => void;
  add: (key: string) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = steps.find((s) => s.key === selectedKey) ?? null;

  // Completed steps, with who/when, in flow order.
  const doneStamps = steps
    .filter((s) => s.state === "completed")
    .map((s) => ({ key: s.key, label: s.label, stamp: stamps?.[s.key] }));

  return (
    <div className="job-stepper">
      <div className="job-stepper__label">
        {title}
        <span className="job-stepper__hint"> · {hint}</span>
        {canEdit && (
          <button type="button" className={`job-stepper__edit${editing ? " is-on" : ""}`} onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {steps.length > 0 ? (
        <DepartmentStepper
          steps={steps}
          onNodeClick={(step) => setSelectedKey((k) => (k === step.key ? null : step.key))}
          selectedKey={selectedKey}
        />
      ) : (
        <div className="job-stepper__empty-note">{emptyNote}</div>
      )}

      {/* Action panel for the selected step. */}
      {selected && (
        <div className="job-stepper__actions">
          <span className="job-stepper__actions-label">{selected.label}</span>
          {selected.state === "completed" ? (
            <>
              <span className="job-stepper__done-tag">
                ✓ {stamps?.[selected.key]?.by || "done"}
                {stamps?.[selected.key]?.date ? ` · ${format(stamps[selected.key]!.date!, "MMM d")}` : ""}
              </span>
              {canEdit && (
                <button type="button" className="btn-secondary job-stepper__btn" onClick={() => reopen(selected.key)}>
                  Reopen
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="job-stepper__complete"
              onClick={() => {
                complete(selected.key);
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
              onClick={() => toggleActive(selected.key)}
              title="Mark this step as an additional active step"
            >
              {isMarkedActive(selected.key) ? "Unset active" : "Set active"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="job-stepper__delete"
              onClick={() => {
                remove(selected.key);
                setSelectedKey(null);
              }}
              title="Remove this step from the stepper"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Editor: add a missing step. */}
      {canEdit && editing && missing.length > 0 && (
        <div className="job-stepper__add">
          <span className="job-stepper__actions-label">{addLabel}</span>
          {missing.map((d) => (
            <button key={d.key} type="button" className="btn-secondary job-stepper__btn" onClick={() => add(d.key)}>
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
