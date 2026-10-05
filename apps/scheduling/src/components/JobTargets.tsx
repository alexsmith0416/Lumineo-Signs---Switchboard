import { useEffect } from "react";
import { format } from "date-fns";
import { useJobTargets } from "../hooks/useJobTargets";
import { useJobRow } from "../hooks/useJobRows";
import { useJobScheduleStore } from "../store/job-schedule-store";

const fmtLong = (d: Date | null): string => (d ? format(d, "EEE MMM d, yyyy") : "—");

/** Parse an <input type="date"> value ("yyyy-MM-dd") as a LOCAL date. */
function parseDateInput(v: string): Date | null {
  if (!v) return null;
  const [y, mo, d] = v.split("-").map(Number);
  return y ? new Date(y, (mo || 1) - 1, d || 1) : null;
}
const toDateInput = (d: Date | null): string => (d ? format(d, "yyyy-MM-dd") : "");

/**
 * Read-only target dates (production complete + estimated install window),
 * shown in its own section between the card text and the production stepper.
 */
const fmtShort = (d: Date): string => format(d, "MM/dd/yy");

export function JobTargetsSection({ jobNo }: { jobNo: string }) {
  const row = useJobRow(jobNo);
  const { targets, redDate, scheduledInstall } = useJobTargets(jobNo);
  // The Jobs list's own targets when the job is on it, so the panel and the list
  // always agree: Mfg target (Mfg Final — the modified date when set) and the
  // scheduled install, else the install target.
  const mfg = parseDateInput(row?.mfgFinalDate ?? "");
  if (row && mfg) {
    const sched = parseDateInput(row.scheduledInstall);
    const instTarget = parseDateInput(row.installTarget);
    return (
      <>
        {redDate && <div className="job-red-bar">Red Date: {fmtShort(redDate)}</div>}
        <div className="job-targets">
          <div className="job-targets__title">Target dates</div>
          <div className="job-targets__row">
            <span className="job-targets__label">
              Mfg target{row.mfgTargetMod && row.mfgFinalDate === row.mfgTargetMod ? " (modified)" : ""}
            </span>
            <strong>{fmtLong(mfg)}</strong>
          </div>
          {sched ? (
            <div className="job-targets__row">
              <span className="job-targets__label">Scheduled install</span>
              <strong>{fmtLong(sched)}</strong>
            </div>
          ) : (
            instTarget && (
              <div className="job-targets__row">
                <span className="job-targets__label">Install target</span>
                <strong>{fmtLong(instTarget)}</strong>
              </div>
            )
          )}
        </div>
      </>
    );
  }
  if (!targets.targetProductionComplete) return null;
  return (
    <>
      {redDate && <div className="job-red-bar">Red Date: {fmtShort(redDate)}</div>}
      <div className="job-targets">
        <div className="job-targets__title">Target dates</div>
        <div className="job-targets__row">
          <span className="job-targets__label">Target production complete</span>
          <strong>{fmtLong(targets.targetProductionComplete)}</strong>
        </div>
        {/* Once install is committed the window is replaced by the committed day;
            a Red date is shown by the bar above, so only show a Scheduled line here. */}
        {!redDate && scheduledInstall ? (
          <div className="job-targets__row">
            <span className="job-targets__label">Scheduled install</span>
            <strong>{fmtLong(scheduledInstall)}</strong>
          </div>
        ) : (
          !redDate &&
          targets.installWindowStart && (
            <div className="job-targets__row">
              <span className="job-targets__label">Est. install window</span>
              <strong>
                {fmtLong(targets.installWindowStart)} – {fmtLong(targets.installWindowEnd)}
              </strong>
            </div>
          )
        )}
      </div>
    </>
  );
}

/**
 * Editable override for the production-complete target. Blank = use the computed
 * date (shown as a hint). Setting it re-anchors the install window.
 */
export function ProductionCompleteField({ jobNo, readOnly = false }: { jobNo: string; readOnly?: boolean }) {
  const sched = useJobScheduleStore((s) => s.byJob[jobNo]);
  const load = useJobScheduleStore((s) => s.load);
  const update = useJobScheduleStore((s) => s.update);
  useEffect(() => {
    void load();
  }, [load]);
  const { targets } = useJobTargets(jobNo);
  if (readOnly) return null;

  const override = sched?.productionCompleteDate ?? null;
  return (
    <div className="form-field">
      <div className="form-field__label">Production completion (override)</div>
      <input
        type="date"
        className="form-field__input"
        value={toDateInput(override)}
        onChange={(e) => void update(jobNo, { productionCompleteDate: parseDateInput(e.target.value) })}
        title="Override the computed production-complete target. Clear to fall back to the computed date. A Red date overrides this."
      />
      {!override && targets.targetProductionComplete && (
        <div className="form-field__hint">
          Using computed target <strong>{fmtLong(targets.targetProductionComplete)}</strong>. Set a date to override it.
        </div>
      )}
    </div>
  );
}
