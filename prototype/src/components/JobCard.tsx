import type { ScheduledJob } from "../types";

interface Props {
  job: ScheduledJob;
  variant?: "compact" | "detail";
}

function statusTone(status: ScheduledJob["status"]): string {
  switch (status) {
    case "In progress": return "amber";
    case "Blocked":     return "red";
    case "Done":        return "green";
    default:            return "navy";
  }
}

export default function JobCard({ job, variant = "compact" }: Props) {
  const remaining = Math.max(job.estimatedHours - job.actualHours, 0);
  const overage   = Math.max(job.actualHours - job.estimatedHours, 0);
  const denom     = Math.max(job.estimatedHours + overage, 1);
  const actualPct = (Math.min(job.actualHours, job.estimatedHours) / denom) * 100;
  const remainPct = (remaining / denom) * 100;
  const overPct   = (overage / denom) * 100;

  return (
    <article className={`jobcard jobcard--${variant}`}>
      <header className="jobcard__head">
        <div className="jobcard__priority" aria-label={`Priority ${job.priority}`}>
          {job.priority}
        </div>
        <div className="jobcard__title">
          <div className="jobcard__customer">{job.customer}</div>
          <div className="jobcard__job">{job.jobNumber} · {job.scope}</div>
        </div>
        <span className={`jobcard__status jobcard__status--${statusTone(job.status)}`}>
          {job.status}
        </span>
      </header>

      <div className="jobcard__meta">
        <span className="jobcard__when">{job.startLabel}–{job.dueLabel}</span>
        {job.partnerLabel && <span className="jobcard__partner">· {job.partnerLabel}</span>}
        <span className="jobcard__hours">
          {job.actualHours}h / {job.estimatedHours}h{overage > 0 && ` · +${overage}h over`}
        </span>
      </div>

      <div className={`jobcard__bar jobcard__bar--${variant}`} aria-hidden="true">
        {actualPct > 0 && (
          <div
            className="jobcard__bar-seg jobcard__bar-seg--actual"
            style={{ width: `${actualPct}%` }}
          />
        )}
        {remainPct > 0 && (
          <div
            className="jobcard__bar-seg jobcard__bar-seg--remain"
            style={{ width: `${remainPct}%` }}
          />
        )}
        {overPct > 0 && (
          <div
            className="jobcard__bar-seg jobcard__bar-seg--over"
            style={{ width: `${overPct}%` }}
          />
        )}
      </div>

      {variant === "detail" && (
        <div className="jobcard__legend">
          <span><i className="jobcard__swatch jobcard__swatch--actual" />Hours logged</span>
          <span><i className="jobcard__swatch jobcard__swatch--remain" />Remaining</span>
          {overage > 0 && <span><i className="jobcard__swatch jobcard__swatch--over" />Over</span>}
        </div>
      )}
    </article>
  );
}
