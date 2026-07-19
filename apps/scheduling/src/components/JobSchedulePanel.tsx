import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { computeJobTargets } from "../services/job-schedule-data";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** Parse an <input type="date"> value ("yyyy-MM-dd") as a LOCAL date (no tz shift). */
function parseDateInput(v: string): Date | null {
  if (!v) return null;
  const [y, mo, d] = v.split("-").map(Number);
  return y ? new Date(y, (mo || 1) - 1, d || 1) : null;
}
const toDateInput = (d: Date | null): string => (d ? format(d, "yyyy-MM-dd") : "");
const fmtLong = (d: Date | null): string => (d ? format(d, "EEE MMM d, yyyy") : "—");

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

/**
 * Job-level scheduling: release anchor + computed targets (Phase 1), plus the
 * scheduled install date and drop-dead Red date (Phase 2). All keyed by jobNo,
 * so it's the same on every card for a job. Setting a Red date auto-fills and
 * locks the scheduled date, and drives the pulsing red outline on the card.
 */
export default function JobSchedulePanel({
  jobNo,
  readOnly = false,
}: {
  jobNo: string;
  readOnly?: boolean;
}) {
  const sched = useJobScheduleStore((s) => s.byJob[jobNo]);
  const load = useJobScheduleStore((s) => s.load);
  const update = useJobScheduleStore((s) => s.update);
  useEffect(() => {
    void load();
  }, [load]);

  // Scheduled / Red pickers are tucked behind an eye toggle. Auto-open when a
  // date is already set so it's visible, otherwise hidden by default.
  const [revealed, setRevealed] = useState(false);

  // Vinyl/graphics-only jobs get a 4-week production target instead of 7.
  const [vinylOnly, setVinylOnly] = useState(false);
  useEffect(() => {
    if (!LIVE || !jobNo) return;
    let alive = true;
    void import("../services/dataverse-live")
      .then((m) => m.jobProductionDepartments(jobNo))
      .then((depts) => {
        if (alive) setVinylOnly(depts.length > 0 && depts.every((d) => /vinyl|graphic/i.test(d)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [jobNo]);

  const released = sched?.releasedDate ?? null;
  const scheduled = sched?.scheduledInstallDate ?? null;
  const red = sched?.redDate ?? null;
  const targets = useMemo(() => computeJobTargets(released, vinylOnly), [released, vinylOnly]);

  const onRedChange = (v: string) => {
    const d = parseDateInput(v);
    // A Red date is a fixed install due date — auto-fill + lock the scheduled
    // install date to it. Clearing the Red date leaves the scheduled date as-is.
    if (d) void update(jobNo, { redDate: d, scheduledInstallDate: d });
    else void update(jobNo, { redDate: null });
  };

  return (
    <div className="job-sched">
      <div className="job-sched__head">
        <span className="job-sched__title">Targets &amp; Dates</span>
        {red && <span className="job-sched__reddot" title="Fixed drop-dead install date">🔴 Red date</span>}
        <button
          type="button"
          className="job-sched__eye"
          onClick={() => setRevealed((v) => !v)}
          title={revealed ? "Hide scheduled / red date" : "Set scheduled / red date"}
          aria-pressed={revealed}
        >
          <EyeIcon open={revealed} />
        </button>
      </div>

      <div className="job-sched__row">
        <span className="job-sched__label">Release date</span>
        <input
          type="date"
          className="form-field__input job-sched__date"
          value={toDateInput(released)}
          disabled={readOnly}
          onChange={(e) => void update(jobNo, { releasedDate: parseDateInput(e.target.value) })}
          title="The day this job was released to production (BC status Open). Anchors the targets below."
        />
      </div>

      {released ? (
        <div className="job-sched__targets">
          <div>
            Target production complete: <strong>{fmtLong(targets.targetProductionComplete)}</strong>
            {vinylOnly && <span className="job-sched__note"> · vinyl/graphics (4 wk)</span>}
          </div>
          {/* Once a scheduled install date exists, it supersedes the estimate. */}
          {scheduled ? (
            <div>
              Scheduled install:{" "}
              <strong className={red ? "job-sched__red" : undefined}>{fmtLong(scheduled)}</strong>
              {red && <span className="job-sched__note"> · locked by red date</span>}
            </div>
          ) : (
            <div>
              Est. install window:{" "}
              <strong>
                {fmtLong(targets.installWindowStart)} – {fmtLong(targets.installWindowEnd)}
              </strong>
            </div>
          )}
        </div>
      ) : (
        <div className="job-sched__hint">Set the release date to compute the production &amp; install targets.</div>
      )}

      {revealed && (
        <div className="job-sched__reveal">
          <div className="job-sched__row">
            <span className="job-sched__label">Scheduled install</span>
            <input
              type="date"
              className="form-field__input job-sched__date"
              value={toDateInput(scheduled)}
              disabled={readOnly || !!red}
              onChange={(e) => void update(jobNo, { scheduledInstallDate: parseDateInput(e.target.value) })}
              title={red ? "Locked to the red date — clear the red date to change" : "Committed installation date"}
            />
          </div>
          <div className="job-sched__row">
            <span className="job-sched__label job-sched__label--red">Red date</span>
            <input
              type="date"
              className="form-field__input job-sched__date job-sched__date--red"
              value={toDateInput(red)}
              disabled={readOnly}
              onChange={(e) => onRedChange(e.target.value)}
              title="Fixed, drop-dead install date. Locks the scheduled date and flags the job everywhere."
            />
          </div>
          <div className="job-sched__hint">
            A red date is a fixed drop-dead install date — it locks the scheduled date and adds a pulsing
            red outline to this job&apos;s card on every schedule.
          </div>
        </div>
      )}
    </div>
  );
}
