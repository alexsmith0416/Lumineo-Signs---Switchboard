import { useEffect, useState } from "react";
import { bcService } from "../services/bc";
import {
  isInstallResource,
  isProductionResource,
  mapPlanningLines,
  type MappedPlanningLine,
} from "../services/planning-line-mapping";

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

/**
 * Re-pick which of a BC job's planning lines (tasks) are scheduled on a card.
 * Selecting tasks re-links the card's text AND its estimated labor hours (the
 * sum), so you no longer have to delete + re-add a job to change its tasks.
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

  if (error) return <div className="jtp__note">Couldn't load job tasks from BC.</div>;
  if (lines === null) return <div className="jtp__note">Loading job tasks…</div>;
  if (lines.length === 0) return <div className="jtp__note">No BC tasks found for this job.</div>;

  const selectedHours = lines.filter((_, i) => selected.has(i)).reduce((s, l) => s + l.estimatedHours, 0);

  return (
    <div className="jtp">
      {lines.map((l, i) => (
        <label key={`${l.lineNo}-${i}`} className={"jtp__row" + (selected.has(i) ? " jtp__row--on" : "")}>
          <input type="checkbox" checked={selected.has(i)} disabled={disabled} onChange={() => toggle(i)} />
          <span className="jtp__desc">{l.description}</span>
          <span className="jtp__hours">{l.estimatedHours}h</span>
        </label>
      ))}
      <div className="jtp__total">
        {selected.size} task{selected.size === 1 ? "" : "s"} · {selectedHours}h estimated
      </div>
    </div>
  );
}
