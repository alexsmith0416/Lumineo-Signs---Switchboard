import { useState } from "react";
import { format } from "date-fns";
import { useScheduleStore } from "../store/schedule-store";
import { dataverseService } from "../services/dataverse";
import type { ScheduleLine } from "../engine/types";

interface EditJobPanelProps {
  line: ScheduleLine;
  onClose: () => void;
}

export default function EditJobPanel({ line, onClose }: EditJobPanelProps) {
  const employees = useScheduleStore((s) => s.employees);
  const updateTaskHours = useScheduleStore((s) => s.updateTaskHours);
  const shiftTaskAndCommit = useScheduleStore((s) => s.shiftTaskAndCommit);
  const loadWeek = useScheduleStore((s) => s.loadWeek);

  const [overrideHours, setOverrideHours] = useState(
    line.overrideHours?.toString() ?? line.estimatedHours.toString(),
  );
  const [employeeId, setEmployeeId] = useState(line.employeeId);
  const [startDate, setStartDate] = useState(
    format(line.startDateTime, "yyyy-MM-dd'T'HH:mm"),
  );
  const [isLocked, setIsLocked] = useState(line.isLocked);
  const [busy, setBusy] = useState(false);

  const employee = employees.get(line.employeeId);

  const onSave = async () => {
    setBusy(true);
    try {
      const newHours = Number(overrideHours);
      if (!Number.isNaN(newHours) && newHours !== line.overrideHours) {
        await updateTaskHours(line.id, newHours);
      }
      const newStart = new Date(startDate);
      if (
        newStart.getTime() !== line.startDateTime.getTime() ||
        employeeId !== line.employeeId
      ) {
        await shiftTaskAndCommit(line.id, newStart, employeeId, true);
      }
      if (isLocked !== line.isLocked) {
        await dataverseService.updateScheduleLine(line.id, { isLocked });
        await loadWeek();
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await dataverseService.deleteScheduleLine(line.id);
      await loadWeek();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          {line.jobNo} · {line.customerName}
        </div>

        <div style={{ padding: 12, fontSize: 11, color: "var(--text-secondary)" }}>
          {line.planningLineDescription}
        </div>

        <div className="form-field">
          <div className="form-field__label">Employee</div>
          <select
            className="form-field__select"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {[...employees.values()].map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <div className="form-field__label">Start</div>
          <input
            className="form-field__input"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Hours</div>
          <input
            className="form-field__input"
            type="number"
            min="0.25"
            step="0.25"
            value={overrideHours}
            onChange={(e) => setOverrideHours(e.target.value)}
            placeholder={`est. ${line.estimatedHours}`}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Locked</div>
          <label
            style={{
              background: "var(--input-bg)",
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
            />
            <span style={{ fontSize: 12 }}>Pin task — cascade flows around it</span>
          </label>
        </div>

        {employee && (
          <div
            style={{
              padding: 12,
              fontSize: 11,
              color: "var(--text-tertiary)",
              borderTop: "1px solid var(--border)",
            }}
          >
            Effective hours: {(Number(overrideHours) / (employee.productivityRate || 1)).toFixed(2)}h
            at {Math.round(employee.productivityRate * 100)}% productivity ·
            current end {format(line.endDateTime, "EEE MMM d HH:mm")}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
          }}
        >
          <button className="btn-danger" disabled={busy} onClick={onDelete}>
            Delete
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
