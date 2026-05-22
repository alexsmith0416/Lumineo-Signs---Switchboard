import { useState } from "react";
import { useScenarioStore } from "../../../store/scenario-store";
import { useScheduleStore } from "../../../store/schedule-store";

export default function ShiftTaskForm({ onDone }: { onDone: () => void }) {
  const schedule = useScheduleStore((s) => s.schedule);
  const employees = useScheduleStore((s) => s.employees);
  const addChange = useScenarioStore((s) => s.addChange);
  const [lineId, setLineId] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");

  return (
    <div>
      <div className="section-title">Shift Task</div>
      <div className="form-field">
        <div className="form-field__label">Task</div>
        <select
          className="form-field__select"
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
        >
          <option value="">Choose…</option>
          {schedule.map((l) => (
            <option key={l.id} value={l.id}>
              {l.jobNo} — {l.planningLineDescription}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <div className="form-field__label">New start</div>
        <input
          className="form-field__input"
          type="datetime-local"
          value={newStart}
          onChange={(e) => setNewStart(e.target.value)}
        />
      </div>
      <div className="form-field">
        <div className="form-field__label">New employee</div>
        <select
          className="form-field__select"
          value={newEmployeeId}
          onChange={(e) => setNewEmployeeId(e.target.value)}
        >
          <option value="">(keep current)</option>
          {[...employees.values()].map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div style={{ padding: 12 }}>
        <button
          className="btn-primary"
          disabled={!lineId || !newStart}
          onClick={() => {
            addChange({
              type: "shift-task",
              lineId,
              newStart: new Date(newStart),
              newEmployeeId: newEmployeeId || undefined,
            });
            onDone();
          }}
        >
          Add to scenario
        </button>
      </div>
    </div>
  );
}
