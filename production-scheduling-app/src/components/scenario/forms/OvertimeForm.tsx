import { useState } from "react";
import { format } from "date-fns";
import { useScenarioStore } from "../../../store/scenario-store";
import { useScheduleStore } from "../../../store/schedule-store";
import { dayKey } from "../../../engine/capacity";

export default function OvertimeForm({ onDone }: { onDone: () => void }) {
  const employees = useScheduleStore((s) => s.employees);
  const addChange = useScenarioStore((s) => s.addChange);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(dayKey(new Date()));
  const [hours, setHours] = useState("2");

  return (
    <div>
      <div className="section-title">Add Overtime</div>
      <div className="form-field">
        <div className="form-field__label">Employee</div>
        <select
          className="form-field__select"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">Choose…</option>
          {[...employees.values()].map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <div className="form-field__label">Date</div>
        <input
          className="form-field__input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="form-field">
        <div className="form-field__label">Hours</div>
        <input
          className="form-field__input"
          type="number"
          min="0.5"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </div>
      <div style={{ padding: 12 }}>
        <button
          className="btn-primary"
          disabled={!employeeId || !hours || !date}
          onClick={() => {
            addChange({
              type: "add-overtime",
              employeeId,
              date,
              extraHours: Number(hours),
              costMultiplier: 1.5,
            });
            onDone();
          }}
        >
          Add to scenario
        </button>
      </div>
      {employeeId && (
        <div style={{ padding: 12, color: "var(--text-tertiary)", fontSize: 11 }}>
          Will give {employees.get(employeeId)?.name} +{hours}h on{" "}
          {format(new Date(date), "EEE MMM d")} (1.5× cost).
        </div>
      )}
    </div>
  );
}
