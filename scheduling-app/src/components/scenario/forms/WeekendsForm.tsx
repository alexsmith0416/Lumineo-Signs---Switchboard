import { useState } from "react";
import { useScenarioStore } from "../../../store/scenario-store";
import { useScheduleStore } from "../../../store/schedule-store";

export default function WeekendsForm({ onDone }: { onDone: () => void }) {
  const employees = useScheduleStore((s) => s.employees);
  const addChange = useScenarioStore((s) => s.addChange);
  const [employeeId, setEmployeeId] = useState("");

  return (
    <div>
      <div className="section-title">Enable Weekends</div>
      <div className="form-field">
        <div className="form-field__label">Employee</div>
        <select
          className="form-field__select"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">Choose…</option>
          {[...employees.values()]
            .filter((e) => !e.worksWeekends)
            .map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
        </select>
      </div>
      <div style={{ padding: 12 }}>
        <button
          className="btn-primary"
          disabled={!employeeId}
          onClick={() => {
            addChange({ type: "enable-weekends", employeeId });
            onDone();
          }}
        >
          Add to scenario
        </button>
      </div>
    </div>
  );
}
