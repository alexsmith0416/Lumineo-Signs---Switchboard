import { useEffect, useState } from "react";
import { bcService } from "../services/bc";
import {
  departmentNameForLine,
  isInstallResource,
  isProductionResource,
  mapPlanningLines,
  type MappedPlanningLine,
} from "../services/planning-line-mapping";
import { cardStepKey } from "../services/production-steps";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

interface JobTaskPickerProps {
  jobNo: string;
  /** Production shows 2000-band shop labor; installation shows the rest. */
  kind: "production" | "installation";
  /** Task lines currently on the card, used to pre-check the matching rows. */
  currentDescriptions: string[];
  /** Fires on user toggle only (not on initial pre-check) with the new task
   *  descriptions and their summed BC estimated hours. */
  onChange: (descriptions: string[], totalHours: number) => void;
  disabled?: boolean;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" aria-hidden="true"
      style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/**
 * A job's BC planning lines (tasks) as a collapsible checklist. Each row carries
 * two independent states:
 *  - **on card** (the checkbox) — whether this task's text is scheduled on the
 *    card. Toggling re-links the card's text AND summed estimated hours, so you
 *    no longer have to delete + re-add a job to change its tasks. Checked rows
 *    are highlighted; pre-checked by matching the card's (editable) task text.
 *  - **done** — derived, read-only: the task's department has been marked
 *    complete on the production stepper, so completing a department node greys
 *    out all of that department's tasks here. Install-kind tasks grey when the
 *    Install step completes.
 */
export default function JobTaskPicker({
  jobNo,
  kind,
  currentDescriptions,
  onChange,
  disabled = false,
}: JobTaskPickerProps) {
  const [lines, setLines] = useState<MappedPlanningLine[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  // Department completions drive the derived "done" grey-out.
  const load = useJobDeptCompletionStore((s) => s.load);
  const jobCompletions = useJobDeptCompletionStore((s) => s.byJob[jobNo]);
  useEffect(() => {
    void load();
  }, [load]);
  const completed = new Set(Object.keys(jobCompletions ?? {}));

  useEffect(() => {
    let alive = true;
    setLines(null);
    setError(false);
    void bcService
      .getJob(jobNo)
      .then((job) => {
        if (!alive) return;
        if (!job) {
          setLines([]);
          return;
        }
        const mapped = mapPlanningLines(job.planningLines).filter((l) =>
          kind === "production" ? isProductionResource(l.resourceNo) : isInstallResource(l.resourceNo),
        );
        setLines(mapped);
        // Pre-check the rows whose description matches what's on the card now.
        const current = new Set(currentDescriptions.map(norm).filter(Boolean));
        const pre = new Set<number>();
        mapped.forEach((l, i) => {
          if (current.has(norm(l.description))) pre.add(i);
        });
        setSelected(pre);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
    // Pre-check only on (re)load of the job — not when the parent edits text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobNo, kind]);

  const toggle = (i: number) => {
    if (disabled || !lines) return;
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
    const chosen = lines.filter((_, idx) => next.has(idx));
    onChange(
      chosen.map((l) => l.description),
      chosen.reduce((sum, l) => sum + l.estimatedHours, 0),
    );
  };

  // A task is "done" when its department (via resource code / description) has
  // been completed on the stepper; install-kind tasks key off the Install step.
  const isDone = (l: MappedPlanningLine): boolean => {
    const key = cardStepKey(kind, departmentNameForLine(l.resourceNo, l.description));
    return !!key && completed.has(key);
  };

  const onCard = selected.size;
  const doneCount = lines ? lines.filter(isDone).length : 0;

  return (
    <div className="jtp">
      <button
        type="button"
        className="jtp__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Chevron open={open} />
        <span className="jtp__header-title">Job tasks</span>
        <span className="jtp__summary">
          {lines === null
            ? "…"
            : `${lines.length} task${lines.length === 1 ? "" : "s"}`}
          {lines && lines.length > 0 && (
            <>
              {" · "}
              <span className="jtp__summary-on">{onCard} on card</span>
              {doneCount > 0 && <span className="jtp__summary-done"> · {doneCount} done</span>}
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="jtp__body">
          {error ? (
            <div className="jtp__note">Couldn&apos;t load job tasks from BC.</div>
          ) : lines === null ? (
            <div className="jtp__note">Loading job tasks…</div>
          ) : lines.length === 0 ? (
            <div className="jtp__note">No BC tasks found for this job.</div>
          ) : (
            <>
              {lines.map((l, i) => {
                const done = isDone(l);
                return (
                  <label
                    key={`${l.lineNo}-${i}`}
                    className={
                      "jtp__row" +
                      (selected.has(i) ? " jtp__row--on" : "") +
                      (done ? " jtp__row--done" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      disabled={disabled}
                      onChange={() => toggle(i)}
                    />
                    <span className="jtp__desc">{l.description}</span>
                    {done && <span className="jtp__done">✓ done</span>}
                    <span className="jtp__hours">{l.estimatedHours}h</span>
                  </label>
                );
              })}
              <div className="jtp__total">
                {onCard} on card · {doneCount} done ·{" "}
                {lines.filter((_, i) => selected.has(i)).reduce((s, l) => s + l.estimatedHours, 0)}h estimated
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
