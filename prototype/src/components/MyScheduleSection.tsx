import type { Resource, ScheduledJob } from "../types";
import JobCard from "./JobCard";

interface Props {
  me: Resource;
  jobs: ScheduledJob[];
  onOpenFull: () => void;
}

export default function MyScheduleSection({ me, jobs, onOpenFull }: Props) {
  const sorted = [...jobs].sort((a, b) => a.priority - b.priority);
  const thisWeek = sorted.filter((j) => j.weekBucket === "This week").slice(0, 3);
  const nextWeek = sorted.filter((j) => j.weekBucket === "Next week").slice(0, 2);

  return (
    <section className="myschedule">
      <header className="myschedule__head">
        <div>
          <h3 className="myschedule__title">My Schedule</h3>
          <div className="myschedule__sub">
            {me.name} · {me.trade} · {me.resourceNumber} · {me.department}
          </div>
        </div>
        <button type="button" className="myschedule__action" onClick={onOpenFull}>
          See full schedule →
        </button>
      </header>

      {thisWeek.length > 0 && (
        <>
          <div className="myschedule__bucket">This week</div>
          <div className="myschedule__list">
            {thisWeek.map((j) => (
              <JobCard key={j.id} job={j} variant="compact" />
            ))}
          </div>
        </>
      )}

      {nextWeek.length > 0 && (
        <>
          <div className="myschedule__bucket">Look ahead · next week</div>
          <div className="myschedule__list">
            {nextWeek.map((j) => (
              <JobCard key={j.id} job={j} variant="compact" />
            ))}
          </div>
        </>
      )}

      {thisWeek.length === 0 && nextWeek.length === 0 && (
        <div className="myschedule__empty">
          No jobs scheduled for you in the current window.
        </div>
      )}
    </section>
  );
}
