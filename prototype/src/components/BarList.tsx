import type { BarRow } from "../types";

interface Props {
  rows: BarRow[];
}

export default function BarList({ rows }: Props) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="barlist">
      {rows.map((row) => {
        const pct = Math.round((row.value / max) * 100);
        const tone = row.color ?? "navy";
        return (
          <li key={row.label} className="barlist__row">
            <div className="barlist__head">
              <span className="barlist__label">{row.label}</span>
              <span className="barlist__value">{row.valueLabel}</span>
            </div>
            <div className="barlist__track">
              <div className={`barlist__fill barlist__fill--${tone}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
