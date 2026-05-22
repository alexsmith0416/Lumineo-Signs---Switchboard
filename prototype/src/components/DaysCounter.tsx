import type { SafetyMetric } from "../types";

interface Props {
  safety: SafetyMetric;
}

export default function DaysCounter({ safety }: Props) {
  return (
    <div className="safety" title={`Last reset ${safety.lastResetDate}`}>
      <div className="safety__head">
        <span className="safety__label">Days since lost time</span>
        <span className="safety__pill">Safety</span>
      </div>
      <div className="safety__value">{safety.currentStreakDays}</div>
      <div className="safety__sub">
        Record <strong>{safety.longestStreakDays}</strong>
      </div>
    </div>
  );
}
