import type { JobDept, SalesActiveJob } from "../types";

interface Props {
  jobs: SalesActiveJob[];
}

function deptTone(d: JobDept): string {
  switch (d) {
    case "Sales":         return "navy";
    case "Estimating":    return "amber";
    case "Spec / Design": return "amber";
    case "Production":    return "navy";
    case "Shipping":      return "green";
    case "Installation":  return "red";
    case "Invoicing":     return "gray";
  }
}

function whenLabel(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `${daysUntil} d`;
}

function formatMoney(n: number): string {
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function SalesActiveJobsWidget({ jobs }: Props) {
  const rows = [...jobs].sort((a, b) => a.daysUntil - b.daysUntil);
  const totalValue = rows.reduce((s, j) => s + j.value, 0);

  return (
    <section className="salesjobs">
      <header className="salesjobs__head">
        <div>
          <h3 className="salesjobs__title">My Active Jobs</h3>
          <div className="salesjobs__sub">
            {rows.length} jobs in flight · {formatMoney(totalValue)} pipeline · nearest target first
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="salesjobs__empty">No active jobs.</div>
      ) : (
        <ul className="salesjobs__list">
          {rows.map((j) => (
            <li key={j.id} className="salesjobs__row">
              <div className="salesjobs__when">
                <div className="salesjobs__date">{j.estCompletionLabel}</div>
                <div className="salesjobs__until">{whenLabel(j.daysUntil)}</div>
              </div>
              <div className="salesjobs__body">
                <div className="salesjobs__customer">{j.customer}</div>
                <div className="salesjobs__scope">{j.jobNumber} · {j.scope}</div>
              </div>
              <div className="salesjobs__right">
                <span className={`salesjobs__dept salesjobs__dept--${deptTone(j.currentDept)}`}>
                  {j.currentDept}
                </span>
                <span className="salesjobs__value">{formatMoney(j.value)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
