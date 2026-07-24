import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { useJobTargets } from "../hooks/useJobTargets";

// The Release date field anchors the targets (now shown in their own section —
// see JobTargets). The anchor is the real BC order-release date
// (crfdf_bcjobs.crfdf_releasedate); the in-app date field is an optional override.
const SHOW_RELEASE = true;

/** Parse an <input type="date"> value ("yyyy-MM-dd") as a LOCAL date (no tz shift). */
function parseDateInput(v: string): Date | null {
  if (!v) return null;
  const [y, mo, d] = v.split("-").map(Number);
  return y ? new Date(y, (mo || 1) - 1, d || 1) : null;
}
const toDateInput = (d: Date | null): string => (d ? format(d, "yyyy-MM-dd") : "");

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
 * Job-level scheduling dates (keyed by jobNo) — the Install Dates section. These
 * are situational "unused" fields, so the whole section is editor-only: view-only
 * users (readOnly) never see the section or its eye toggle. For an editor the eye
 * shows/hides the Scheduled install + drop-dead Red date fields (collapsed by
 * default). Setting a Red date auto-fills and locks the scheduled date and drives
 * the pulsing red outline on the card. The release-anchored targets stay hidden
 * (SHOW_TARGETS) until a real BC release date is available.
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

  const [revealed, setRevealed] = useState(false);

  // The anchor date (BC release date, or the in-app override) — shared with the
  // targets section + tooltip so they all compute identically.
  const { released } = useJobTargets(jobNo);
  const scheduled = sched?.scheduledInstallDate ?? null;
  const red = sched?.redDate ?? null;

  const onRedChange = (v: string) => {
    const d = parseDateInput(v);
    if (d) void update(jobNo, { redDate: d, scheduledInstallDate: d });
    else void update(jobNo, { redDate: null });
  };

  // Editor-only section: view-only users never see it (nor the eye toggle).
  if (readOnly) return null;

  return (
    <div className="job-sched">
      <div className="job-sched__head">
        <span className="job-sched__title">Install Dates</span>
        {red && <span className="job-sched__reddot" title="Fixed drop-dead install date">🔴 Red date</span>}
        <button
          type="button"
          className="job-sched__eye"
          onClick={() => setRevealed((v) => !v)}
          title={revealed ? "Hide install date fields" : "Show install date fields"}
          aria-pressed={revealed}
        >
          <EyeIcon open={revealed} />
        </button>
      </div>

      {revealed && (
        <>
          {SHOW_RELEASE && (
            <div className="job-sched__row">
              <span className="job-sched__label">Release date</span>
              <input
                type="date"
                className="form-field__input job-sched__date"
                value={toDateInput(released)}
                onChange={(e) => void update(jobNo, { releasedDate: parseDateInput(e.target.value) })}
                title="Order-release date from BC — anchors the target dates. Editing overrides it for this job; clear to fall back to the BC date."
              />
            </div>
          )}

          <div className="job-sched__reveal">
            <div className="job-sched__row">
              <span className="job-sched__label">Scheduled install</span>
              <input
                type="date"
                className="form-field__input job-sched__date"
                value={toDateInput(scheduled)}
                disabled={!!red}
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
                onChange={(e) => onRedChange(e.target.value)}
                title="Fixed, drop-dead install date. Locks the scheduled date and flags the job everywhere."
              />
            </div>
            <div className="job-sched__hint">
              A red date is a fixed drop-dead install date — it locks the scheduled date and adds a pulsing
              red outline to this job&apos;s card on every schedule.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
