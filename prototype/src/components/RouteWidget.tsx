import type { RouteStop } from "../types";

interface Props {
  stops: RouteStop[];
}

export default function RouteWidget({ stops }: Props) {
  return (
    <ol className="route">
      {stops.map((s) => (
        <li key={s.id} className={`route__stop route__stop--${s.status.toLowerCase()}`}>
          <div className="route__order">{s.order}</div>
          <div className="route__body">
            <div className="route__top">
              <span className="route__customer">{s.customer}</span>
              <span className={`route__status route__status--${s.status.toLowerCase()}`}>{s.status}</span>
            </div>
            <div className="route__addr">
              <span className="route__pin">📍</span>
              <span>
                {s.address}, {s.cityState}
              </span>
            </div>
            <div className="route__meta">
              <span className="route__window">🕗 {s.windowLabel}</span>
              <span className="route__crew">👥 {s.crewLabel}</span>
              <span className="route__job">{s.jobNumber}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
