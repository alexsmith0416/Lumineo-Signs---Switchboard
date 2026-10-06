import { useEffect, useState } from "react";
import { useStatusRulesStore } from "../store/status-rules-store";
import { STATUS_OPTIONS } from "../services/job-status";
import { ALL_DONE, DEFAULT_STATUS_RULES } from "../services/status-rules";
import { ALL_STEP_DEFS, INSTALL_STEP } from "../services/production-steps";

/**
 * Settings → Status rules. When a department is completed from the shop floor
 * (a "Task complete" tick on a BC job punch), the job's Current Status moves
 * to the status set here for its NEW active step. Admin / Developer / Ops only
 * (the caller gates it). Saved for everyone as soon as a status is picked.
 */
export default function StatusRulesSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-section">
      <div className="settings-section__title">Status rules</div>
      <div className="settings-row">
        <div className="settings-row__text">
          <div className="settings-row__title">Current Status after a shop-floor completion</div>
          <div className="settings-row__desc">
            When someone ticks <strong>Task complete</strong> on a BC job punch, that department completes on the
            job&apos;s stepper and its <strong>Current Status</strong> moves to the status set here for the next
            active step. Jobs on a hold or a special status (Service, Morton, Billboards…) are never moved.
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          Edit Status Rules
        </button>
      </div>
      {open && <StatusRulesPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

const ROWS: Array<{ key: string; label: string }> = [
  ...ALL_STEP_DEFS.filter((d) => d.key !== INSTALL_STEP.key),
  { key: INSTALL_STEP.key, label: INSTALL_STEP.label },
  { key: ALL_DONE, label: "Every step complete" },
];

function StatusRulesPanel({ onClose }: { onClose: () => void }) {
  const rules = useStatusRulesStore((s) => s.rules);
  const load = useStatusRulesStore((s) => s.load);
  const setRule = useStatusRulesStore((s) => s.setRule);
  useEffect(() => {
    void load(true);
  }, [load]);

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Status rules</div>
        <div className="slide-over__body status-rules">
          <p className="status-rules__note">
            The step that becomes <strong>active</strong> after a shop-floor completion → the Current Status the job
            moves to. Changes save for everyone straight away.
          </p>
          <table className="status-rules__table">
            <thead>
              <tr>
                <th>Next active step</th>
                <th>Moves to</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const value = rules[r.key] ?? "";
                const isDefault = value === DEFAULT_STATUS_RULES[r.key];
                return (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>
                      <select
                        className="form-field__select"
                        value={value}
                        onChange={(e) => setRule(r.key, e.target.value)}
                      >
                        {!STATUS_OPTIONS.includes(value) && value && <option value={value}>{value}</option>}
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {!isDefault && (
                        <button
                          type="button"
                          className="status-rules__reset"
                          title={`Back to the default (${DEFAULT_STATUS_RULES[r.key]})`}
                          onClick={() => setRule(r.key, "")}
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
