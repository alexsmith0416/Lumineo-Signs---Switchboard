import type { Resource, ScheduledJob } from "../types";
import JobCard from "./JobCard";

interface Props {
  me: Resource;
  jobs: ScheduledJob[];
  contentW: number | null;
  onBack: () => void;
}

export default function MyScheduleScreen({ me, jobs, contentW, onBack }: Props) {
  const sorted = [...jobs].sort((a, b) => a.priority - b.priority);
  const thisWeek = sorted.filter((j) => j.weekBucket === "This week");
  const nextWeek = sorted.filter((j) => j.weekBucket === "Next week");

  const totalEst    = sorted.reduce((s, j) => s + j.estimatedHours, 0);
  const totalActual = sorted.reduce((s, j) => s + j.actualHours, 0);

  const style: React.CSSProperties = contentW
    ? {
        display: "grid",
        gridTemplateColumns: `${contentW}px`,
        gap: "12px",
        margin: "0 auto",
        padding: "10px 0 24px",
      }
    : {};

  return (
    <main className="myschedule-screen" style={style}>
      <div className="myschedule-screen__topbar">
        <button type="button" className="myschedule-screen__back" onClick={onBack}>
          ← Home
        </button>
        <div className="myschedule-screen__crumb">My Schedule</div>
      </div>

      <section className="myschedule-screen__summary">
        <div className="myschedule-screen__id">
          <div className="myschedule-screen__name">{me.name}</div>
          <div className="myschedule-screen__role">
            {me.trade} · {me.resourceNumber} · {me.department}
          </div>
        </div>
        <div className="myschedule-screen__totals">
          <div>
            <div className="myschedule-screen__totals-label">Jobs</div>
            <div className="myschedule-screen__totals-value">{sorted.length}</div>
          </div>
          <div>
            <div className="myschedule-screen__totals-label">Logged</div>
            <div className="myschedule-screen__totals-value">{totalActual}h</div>
          </div>
          <div>
            <div className="myschedule-screen__totals-label">Estimated</div>
            <div className="myschedule-screen__totals-value">{totalEst}h</div>
          </div>
        </div>
      </section>

      {thisWeek.length > 0 && (
        <section className="myschedule-screen__group">
          <div className="myschedule-screen__bucket">This week · {thisWeek.length}</div>
          <div className="myschedule-screen__list">
            {thisWeek.map((j) => (
              <JobCard key={j.id} job={j} variant="detail" />
            ))}
          </div>
        </section>
      )}

      {nextWeek.length > 0 && (
        <section className="myschedule-screen__group">
          <div className="myschedule-screen__bucket">Next week · {nextWeek.length}</div>
          <div className="myschedule-screen__list">
            {nextWeek.map((j) => (
              <JobCard key={j.id} job={j} variant="detail" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
