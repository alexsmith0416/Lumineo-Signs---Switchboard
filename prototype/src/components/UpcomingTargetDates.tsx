import { useState } from "react";
import type { TargetDept, UpcomingTarget } from "../types";

interface Props {
  targets: UpcomingTarget[];
}

const DEPTS: TargetDept[] = ["Production", "Installation"];

function statusTone(s: UpcomingTarget["status"]): string {
  return s === "On track" ? "green" : s === "At risk" ? "amber" : "red";
}

function whenLabel(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil <= 7) return `${daysUntil} d`;
  return `${daysUntil} d`;
}

export default function UpcomingTargetDates({ targets }: Props) {
  const [dept, setDept] = useState<TargetDept>("Production");
  const rows = targets
    .filter((t) => t.dept === dept && t.daysUntil <= 21)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <section className="targets">
      <header className="targets__head">
        <div>
          <h3 className="targets__title">Upcoming Target Dates</h3>
          <div className="targets__sub">
            3-week look-ahead · sorted nearest first
          </div>
        </div>
        <div className="targets__toggle" role="tablist" aria-label="Department">
          {DEPTS.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={dept === d}
              className={`targets__toggle-btn ${dept === d ? "is-active" : ""}`}
              onClick={() => setDept(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="targets__empty">No {dept.toLowerCase()} targets in the next 3 weeks.</div>
      ) : (
        <ul className="targets__list">
          {rows.map((t) => (
            <li key={t.id} className="targets__row">
              <div className="targets__when">
                <div className="targets__date">{t.targetDateLabel}</div>
                <div className="targets__until">{whenLabel(t.daysUntil)}</div>
              </div>
              <div className="targets__body">
                <div className="targets__customer">{t.customer}</div>
                <div className="targets__scope">
                  {t.jobNumber} · {t.scope}
                  {t.partnerLabel && <> · <span className="targets__partner">{t.partnerLabel}</span></>}
                </div>
              </div>
              <span className={`targets__status targets__status--${statusTone(t.status)}`}>
                {t.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
