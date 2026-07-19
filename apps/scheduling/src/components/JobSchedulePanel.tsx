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

/**
 * Job-level scheduling: the release-date anchor and the target dates computed
 * from it (production target + estimated install window). Job-wide (keyed by
 * jobNo), so it's the same on every card for a job. Phases 2–3 add the
 * scheduled / red dates and the production stepper here.
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

  // Vinyl/graphics-only jobs get a 4-week production target instead of 7. Detect
  // it from the job's production planning-line departments (live only).
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
  const targets = useMemo(() => computeJobTargets(released, vinylOnly), [released, vinylOnly]);

  return (
    <div className="job-sched">
      <div className="job-sched__title">Targets &amp; Dates</div>

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
          <div>
            Est. install window:{" "}
            <strong>
              {fmtLong(targets.installWindowStart)} – {fmtLong(targets.installWindowEnd)}
            </strong>
          </div>
        </div>
      ) : (
        <div className="job-sched__hint">Set the release date to compute the production &amp; install targets.</div>
      )}
    </div>
  );
}
