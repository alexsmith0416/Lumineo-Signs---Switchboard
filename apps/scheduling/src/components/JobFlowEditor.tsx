/**
 * Job flow editing (services/job-flow.ts):
 *  - <JobFlowSettings>   Settings → Job flow: the company flow every job starts from.
 *  - <JobFlowJobSection> the job panel's ▸ Job flow: where this job is, and
 *                        (editors) its own order / statuses.
 * Both use <FlowStagesEditor>: an ordered list of stages (step + status) with
 * ↑ / ↓ / ✕ and "Add a stage".
 */
import { useEffect, useMemo, useState } from "react";
import { useJobFlowStore } from "../store/job-flow-store";
import { useJobTrackingStore } from "../store/job-tracking-store";
import { useFieldOptionsStore } from "../store/field-options-store";
import { builtinOptions } from "./jobs/field-options";
import { STATUS_OPTIONS } from "../services/job-status";
import { ALL_STEP_DEFS, stepLabel } from "../services/production-steps";
import { DEFAULT_STATUS_RULES } from "../services/status-rules";
import {
  addStage,
  currentStage,
  effectiveFlow,
  flowFromRules,
  isStageDone,
  moveStage,
  parseStages,
  parseStagesDone,
  removeStage,
  stageId,
  updateStage,
  type FlowStage,
} from "../services/job-flow";
import { Collapsible } from "./JobInfoSections";

/** The Current Status choices (the Jobs list's edited list, else the built-in one). */
function useStatusOptions(): string[] {
  const override = useFieldOptionsStore((s) => s.overrides.status);
  return useMemo(() => {
    const list = builtinOptions("status", override);
    return list.length ? list : [...STATUS_OPTIONS];
  }, [override]);
}

function StatusSelect({ value, options, onChange, disabled }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select className="form-field__select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {!value && <option value="">Pick a status…</option>}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function FlowStagesEditor({ stages, onChange, steps, readOnly, progress }: {
  stages: FlowStage[];
  onChange: (next: FlowStage[]) => void;
  /** The steps a stage may use (Settings: every step; a job: the steps on its stepper). */
  steps: ReadonlyArray<{ key: string; label: string }>;
  readOnly?: boolean;
  /** A job's progress: which stages are done and where it is now. */
  progress?: { done: (s: FlowStage) => boolean; currentId: string | null };
}) {
  const options = useStatusOptions();
  const [newStep, setNewStep] = useState(steps[0]?.key ?? "");
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!steps.some((s) => s.key === newStep)) setNewStep(steps[0]?.key ?? "");
  }, [steps, newStep]);

  const tryChange = (next: FlowStage[], before: FlowStage[]) => {
    if (JSON.stringify(next) === JSON.stringify(before)) {
      setNote("That step already has a stage with that status.");
      return;
    }
    setNote("");
    onChange(next);
  };
  const stepCount = (k: string) => stages.filter((s) => s.step === k).length;

  return (
    <div className="flow-editor">
      <table className="flow-editor__table">
        <thead>
          <tr>
            <th className="flow-editor__num">#</th>
            <th>Step</th>
            <th>Current Status</th>
            {!readOnly && <th />}
          </tr>
        </thead>
        <tbody>
          {stages.map((s, i) => {
            const id = stageId(s);
            const done = progress?.done(s) ?? false;
            const current = progress?.currentId === id;
            const multi = stepCount(s.step) > 1;
            return (
              <tr key={id} className={`${done ? "flow-editor__row--done" : ""}${current ? " flow-editor__row--current" : ""}`}>
                <td className="flow-editor__num">
                  {progress ? (done ? "✓" : current ? "●" : i + 1) : i + 1}
                </td>
                <td>
                  {readOnly ? (
                    stepLabel(s.step)
                  ) : (
                    <select
                      className="form-field__select"
                      value={s.step}
                      onChange={(e) => tryChange(updateStage(stages, i, { ...s, step: e.target.value }), stages)}
                    >
                      {!steps.some((d) => d.key === s.step) && <option value={s.step}>{stepLabel(s.step)}</option>}
                      {steps.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {multi && <span className="flow-editor__tag" title="This step has more than one stage; it completes after its last one">stage {stages.slice(0, i + 1).filter((x) => x.step === s.step).length} of {stepCount(s.step)}</span>}
                </td>
                <td>
                  {readOnly ? (
                    <span>
                      {s.status}
                      {current && <span className="flow-editor__now"> · now</span>}
                    </span>
                  ) : (
                    <StatusSelect value={s.status} options={options} onChange={(v) => tryChange(updateStage(stages, i, { ...s, status: v }), stages)} />
                  )}
                </td>
                {!readOnly && (
                  <td className="flow-editor__actions">
                    <button type="button" className="flow-editor__btn" disabled={i === 0} onClick={() => onChange(moveStage(stages, i, -1))} aria-label="Move up" title="Move up">
                      ↑
                    </button>
                    <button type="button" className="flow-editor__btn" disabled={i === stages.length - 1} onClick={() => onChange(moveStage(stages, i, 1))} aria-label="Move down" title="Move down">
                      ↓
                    </button>
                    <button type="button" className="flow-editor__btn flow-editor__btn--x" onClick={() => onChange(removeStage(stages, i))} aria-label="Remove stage" title="Remove this stage">
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!readOnly && (
        <div className="flow-editor__add">
          <span className="flow-editor__add-label">Add a stage</span>
          <select className="form-field__select" value={newStep} onChange={(e) => setNewStep(e.target.value)}>
            {steps.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
          <StatusSelect value={newStatus} options={options} onChange={setNewStatus} />
          <button
            type="button"
            className="btn-primary flow-editor__add-btn"
            disabled={!newStep || !newStatus}
            onClick={() => {
              const next = addStage(stages, { step: newStep, status: newStatus });
              if (next.length === stages.length) {
                setNote("That step already has a stage with that status.");
                return;
              }
              setNote("");
              setNewStatus("");
              onChange(next);
            }}
          >
            Add
          </button>
        </div>
      )}
      {note && <div className="flow-editor__note">{note}</div>}
    </div>
  );
}

// ---- Settings → Job flow ---------------------------------------------------

export function JobFlowSettings() {
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-section">
      <div className="settings-section__title">Job flow</div>
      <div className="settings-row">
        <div className="settings-row__text">
          <div className="settings-row__title">The order jobs move through the shop, and the status at each stage</div>
          <div className="settings-row__desc">
            Every job follows this flow, using only the steps on its own stepper; editors can change one job&apos;s flow in
            its panel. A step can have more than one stage (e.g. Vinyl → <em>MFG - Vinyl Cut</em>, then <em>MFG - Vinyl
            Application</em>). When someone ticks <strong>Task complete</strong> on a BC punch, the job moves to its next
            stage; the stepper department completes after its last stage. Holds and special statuses are never moved.
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          Edit Job Flow
        </button>
      </div>
      {open && <JobFlowSettingsPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

function JobFlowSettingsPanel({ onClose }: { onClose: () => void }) {
  const company = useJobFlowStore((s) => s.company);
  const load = useJobFlowStore((s) => s.load);
  const setCompany = useJobFlowStore((s) => s.setCompany);
  const options = useStatusOptions();
  useEffect(() => {
    void load(true);
  }, [load]);

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel slide-over__panel--wide" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Job flow</div>
        <div className="slide-over__body status-rules">
          <p className="status-rules__note">
            Top to bottom is the order a job moves through. Each job uses only the steps on its stepper, in this order —
            so this also sets the stepper&apos;s order and which department goes active next (Business Central follows).
            Changes save for everyone straight away; jobs given their own flow keep theirs.
          </p>
          <FlowStagesEditor stages={company.stages} onChange={(stages) => setCompany({ ...company, stages })} steps={ALL_STEP_DEFS} />
          <div className="flow-editor__done">
            <span>When every stage is done, the status moves to</span>
            <StatusSelect value={company.doneStatus} options={options} onChange={(doneStatus) => setCompany({ ...company, doneStatus })} />
          </div>
          <button
            type="button"
            className="status-rules__reset"
            onClick={() => {
              if (window.confirm("Put the job flow back to the original order and statuses?")) setCompany(flowFromRules(DEFAULT_STATUS_RULES));
            }}
          >
            Reset to the original flow
          </button>
        </div>
        <div className="users-admin__footer">
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Job panel ▸ Job flow ---------------------------------------------------

export function JobFlowJobSection({ jobNo, steps, canEdit }: {
  jobNo: string;
  /** The job's stepper steps (order + completed state). */
  steps: ReadonlyArray<{ key: string; label: string; state: string }>;
  canEdit: boolean;
}) {
  const company = useJobFlowStore((s) => s.company);
  const ownRaw = useJobTrackingStore((s) => s.tracks.find((t) => t.jobNo === jobNo)?.flow ?? "");
  const doneRaw = useJobTrackingStore((s) => s.tracks.find((t) => t.jobNo === jobNo)?.stagesDone ?? "");
  const setJobFlow = useJobTrackingStore((s) => s.setJobFlow);
  useEffect(() => {
    void useJobFlowStore.getState().load();
  }, []);

  const own = parseStages(ownRaw);
  const stepKeys = useMemo(() => steps.map((s) => s.key), [steps]);
  const flow = useMemo(() => effectiveFlow(company, own, stepKeys), [company, own, stepKeys]);
  const completed = useMemo(() => new Set(steps.filter((s) => s.state === "completed").map((s) => s.key)), [steps]);
  const done = useMemo(() => new Set(parseStagesDone(doneRaw)), [doneRaw]);
  const at = currentStage(flow, done, completed);
  const choices = useMemo(() => steps.map((s) => ({ key: s.key, label: s.label })), [steps]);

  if (!steps.length) return null;
  return (
    <Collapsible title={`Job flow${own ? " · this job's own" : ""}`}>
      <p className="flow-editor__intro">
        {at ? (
          <>
            Now at <strong>{stepLabel(at.step)}</strong> · {at.status}.{" "}
          </>
        ) : (
          <>Every stage is done. </>
        )}
        {own ? "This job has its own flow." : "Follows the company flow (Settings → Job flow)."}
        {canEdit && " Changing it here changes this job only — including its stepper order."}
      </p>
      <FlowStagesEditor
        stages={flow}
        onChange={(next) => void setJobFlow(jobNo, next)}
        steps={choices}
        readOnly={!canEdit}
        progress={{ done: (s) => isStageDone(s, done, completed), currentId: at ? stageId(at) : null }}
      />
      {canEdit && own && (
        <button type="button" className="status-rules__reset" onClick={() => void setJobFlow(jobNo, null)}>
          Back to the company flow
        </button>
      )}
    </Collapsible>
  );
}
