import { useEffect, useState } from "react";
import { useLeadTimeStore } from "../store/lead-time-store";
import {
  DEFAULT_LEAD_TIME,
  LEAD_TIME_STEP_OPTIONS,
  type LeadTimeMatch,
  type LeadTimeRule,
} from "../services/lead-times";

/**
 * Settings → Lead times. How many weeks after a job's release its Mfg Target
 * and Install Target fall, by the combination of stepper steps the job has.
 * The first matching rule (top to bottom) wins; no match → the default
 * (7 / 10 weeks). Admin / Developer / Ops only (the caller gates it).
 *
 * A row with an "Edit Lead Times" button; the rules open in a slide-over.
 */
export default function LeadTimesSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-section">
      <div className="settings-section__title">Lead times</div>

      <div className="settings-row">
        <div className="settings-row__text">
          <div className="settings-row__title">
            Mfg &amp; install target lead times
          </div>
          <div className="settings-row__desc">
            Weeks from a job's <strong>release</strong> to its{" "}
            <strong>Mfg Target</strong> and <strong>Install Target</strong>.
            Default {DEFAULT_LEAD_TIME.productionWeeks} and{" "}
            {DEFAULT_LEAD_TIME.installWeeks} weeks; add rules for jobs with
            particular combinations of steps.
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setOpen(true)}
        >
          Edit Lead Times
        </button>
      </div>

      {open && <LeadTimesPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

const blankRule = (): LeadTimeRule => ({
  id: "",
  name: "",
  steps: [],
  match: "only",
  productionWeeks: DEFAULT_LEAD_TIME.productionWeeks,
  installWeeks: DEFAULT_LEAD_TIME.installWeeks,
});

function LeadTimesPanel({ onClose }: { onClose: () => void }) {
  const rules = useLeadTimeStore((s) => s.rules);
  const loaded = useLeadTimeStore((s) => s.loaded);
  const load = useLeadTimeStore((s) => s.load);
  const saveRules = useLeadTimeStore((s) => s.saveRules);
  useEffect(() => {
    void load(true);
  }, [load]);

  const [draft, setDraft] = useState<LeadTimeRule[]>(rules);
  const [dirty, setDirty] = useState(false);
  // Follow the store until the user starts editing.
  useEffect(() => {
    if (!dirty) setDraft(rules);
  }, [rules, dirty]);

  const edit = (next: LeadTimeRule[]) => {
    setDraft(next);
    setDirty(true);
  };
  const patch = (i: number, p: Partial<LeadTimeRule>) =>
    edit(draft.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j]!, next[i]!];
    edit(next);
  };
  const toggleStep = (i: number, key: string) => {
    const steps = draft[i]!.steps;
    patch(i, {
      steps: steps.includes(key)
        ? steps.filter((k) => k !== key)
        : [...steps, key],
    });
  };

  const incomplete = draft.some((r) => r.steps.length === 0);
  const save = () => {
    // Keep the steps in flow order so a rule reads the same way everywhere.
    const order = LEAD_TIME_STEP_OPTIONS.map((o) => o.key);
    void saveRules(
      draft.map((r) => ({
        ...r,
        name: r.name.trim() || stepNames(r.steps),
        steps: [...r.steps].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      })),
    );
    onClose();
  };

  return (
    <div className="slide-over" onClick={dirty ? undefined : onClose}>
      <div
        className="slide-over__panel slide-over__panel--wide lead-times-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-title">Lead times</div>

        <div className="slide-over__body billing-periods-panel">
          <p className="billing-periods-panel__note">
            Rules are checked <strong>top to bottom</strong>; the first one that
            matches a job's stepper steps sets its lead times.{" "}
            <strong>Only these steps</strong> matches a job whose production
            steps are all in the rule (a Vinyl-only job matches “only Material
            Cut + Vinyl”). <strong>Includes these steps</strong> matches a job
            that has every step in the rule, plus any others. Jobs no rule
            matches use{" "}
            <strong>{DEFAULT_LEAD_TIME.productionWeeks} weeks</strong> to Mfg
            Target and <strong>{DEFAULT_LEAD_TIME.installWeeks} weeks</strong>{" "}
            to Install Target.
          </p>

          {!loaded ? (
            <p className="billing-periods-panel__note">Loading…</p>
          ) : (
            <div className="lead-times__scroll">
              <table className="billing-periods lead-times">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Match</th>
                    <th>Steps</th>
                    <th>Mfg weeks</th>
                    <th>Install weeks</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          value={r.name}
                          placeholder={stepNames(r.steps) || "Rule name"}
                          aria-label="Rule name"
                          onChange={(e) => patch(i, { name: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={r.match}
                          aria-label="How the steps match"
                          onChange={(e) =>
                            patch(i, { match: e.target.value as LeadTimeMatch })
                          }
                        >
                          <option value="only">Only these steps</option>
                          <option value="includes">Includes these steps</option>
                        </select>
                      </td>
                      <td>
                        <div className="lead-times__steps">
                          {LEAD_TIME_STEP_OPTIONS.map((o) => (
                            <button
                              key={o.key}
                              type="button"
                              className={`lead-times__step${r.steps.includes(o.key) ? " lead-times__step--on" : ""}`}
                              aria-pressed={r.steps.includes(o.key)}
                              onClick={() => toggleStep(i, o.key)}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <WeeksInput
                          value={r.productionWeeks}
                          label="Mfg weeks"
                          onChange={(v) => patch(i, { productionWeeks: v })}
                        />
                      </td>
                      <td>
                        <WeeksInput
                          value={r.installWeeks}
                          label="Install weeks"
                          onChange={(v) => patch(i, { installWeeks: v })}
                        />
                      </td>
                      <td className="lead-times__actions">
                        <button
                          type="button"
                          className="lead-times__icon"
                          title="Move up"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="lead-times__icon"
                          title="Move down"
                          disabled={i === draft.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="lead-times__icon lead-times__icon--delete"
                          title="Delete rule"
                          onClick={() => edit(draft.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            className="btn-secondary lead-times__add"
            onClick={() => edit([...draft, blankRule()])}
          >
            + Add rule
          </button>
          {incomplete && (
            <div className="billing-periods__problem">
              Pick at least one step for every rule.
            </div>
          )}
        </div>

        <div className="users-admin__footer" style={{ gap: 8 }}>
          {dirty ? (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={incomplete}
                onClick={save}
              >
                Save
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WeeksInput({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={104}
      className="lead-times__weeks"
      value={value}
      aria-label={label}
      onChange={(e) => {
        const v = Math.round(Number(e.target.value));
        if (Number.isFinite(v) && v >= 0) onChange(v);
      }}
    />
  );
}

const stepNames = (keys: readonly string[]): string =>
  LEAD_TIME_STEP_OPTIONS.filter((o) => keys.includes(o.key))
    .map((o) => o.label)
    .join(" + ");
