import type { SafetyMetric } from "../types";

interface Props {
  safety: SafetyMetric;
}

export default function DaysCounter({ safety }: Props) {
  const padded = String(safety.currentStreakDays).padStart(3, "0");
  const digits = padded.split("");

  return (
    <div className="days">
      <span className="days__badge">Safety</span>
      <div className="days__digits">
        {digits.map((d, i) => (
          <div key={i} className="days__digit">
            {d}
          </div>
        ))}
      </div>
      <div className="days__text">
        <h2 className="days__title">DAYS SINCE LOST TIME</h2>
        <div className="days__subtitle">
          Previous record: <strong>{safety.longestStreakDays} days</strong>
          {" · "}Last reset {safety.lastResetDate}
        </div>
      </div>
    </div>
  );
}
