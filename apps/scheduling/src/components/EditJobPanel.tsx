import { useState } from "react";
import { format } from "date-fns";
import { type UseScheduleStore, useScheduleStore } from "../store/schedule-store";
import type { ScheduleContext, ScheduleLine } from "../engine/types";
import { calculateEndTime } from "../engine/time-walker";
import { useLivePreview } from "../hooks/useLivePreview";
import ConfirmDialog from "./ConfirmDialog";

interface EditJobPanelProps {
  line: ScheduleLine;
  onClose: () => void;
  useStore?: UseScheduleStore;
}

export default function EditJobPanel({ line, onClose, useStore = useScheduleStore }: EditJobPanelProps) {
  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.departments);
  const schedule = useStore((s) => s.schedule);
  const workHours = useStore((s) => s.workHours);
  const overtime = useStore((s) => s.overtime);
  const dataSource = useStore((s) => s.dataSource);
  const updateTaskHours = useStore((s) => s.updateTaskHours);
  const shiftTaskAndCommit = useStore((s) => s.shiftTaskAndCommit);
  const loadWeek = useStore((s) => s.loadWeek);
  const deleteScheduleLine = useStore((s) => s.deleteScheduleLine);

  // Trips/crew and Install ZIP are install-only widgets.
  const isInstall = dataSource.kind === "installation";

  const [overrideHours, setOverrideHours] = useState(
    line.overrideHours?.toString() ?? line.estimatedHours.toString(),
  );
  const [jobDescription, setJobDescription] = useState(line.jobDescription ?? "");
  const [taskDescription, setTaskDescription] = useState(line.planningLineDescription ?? "");
  const [crewTrips, setCrewTrips] = useState(line.crewTrips?.toString() ?? "");
  const [crewPersons, setCrewPersons] = useState(line.crewPersons?.toString() ?? "");
  const [crewTrucks, setCrewTrucks] = useState(line.crewTrucks?.toString() ?? "");
  const [installZip, setInstallZip] = useState(line.installZip ?? "");
  const [employeeId, setEmployeeId] = useState(line.employeeId);
  const [startDate, setStartDate] = useState(
    format(line.startDateTime, "yyyy-MM-dd'T'HH:mm"),
  );
  const [isLocked, setIsLocked] = useState(line.isLocked);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const employee = employees.get(line.employeeId);

  // Live end preview shared by the End field + the Predicted pane.
  const startObj = startDate ? new Date(startDate) : null;
  const hoursNum = Number(overrideHours);
  const preview = useLivePreview(
    startObj,
    Number.isNaN(hoursNum) ? line.estimatedHours : hoursNum,
    null,
    employeeId,
    useStore,
  );

  // Editing End sets the duration: binary-search the hours whose engine end lands
  // on the picked date (the engine re-derives end from hours on reload, so the
  // end has to be expressed as hours to persist).
  const onEndChange = (v: string) => {
    const emp = employees.get(employeeId);
    if (!emp || !startObj || !v) return;
    const target = new Date(v);
    if (Number.isNaN(target.getTime()) || target.getTime() <= startObj.getTime()) return;
    const ctx: ScheduleContext = { employees, departments, schedule, workHours, overtime };
    const endAt = (h: number) => calculateEndTime(startObj, h, emp, ctx, line.id).getTime();
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40 && endAt(hi) < target.getTime(); i++) hi *= 2;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (endAt(mid) < target.getTime()) lo = mid;
      else hi = mid;
    }
    const rate = emp.productivityRate === 0 ? 1 : emp.productivityRate;
    const raw = Math.max(0.25, Math.round(((lo + hi) / 2) * rate * 4) / 4);
    setOverrideHours(String(raw));
  };

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
      const numOrNull = (v: string): number | null => {
        const t = v.trim();
        if (t === "") return null;
        const n = Number(t);
        return Number.isNaN(n) ? null : n;
      };
      const changes: Partial<ScheduleLine> = {};
      if (isLocked !== line.isLocked) changes.isLocked = isLocked;
      if (
        jobDescription !== (line.jobDescription ?? "") ||
        taskDescription !== (line.planningLineDescription ?? "")
      ) {
        changes.jobDescription = jobDescription;
        changes.planningLineDescription = taskDescription;
      }
      if (numOrNull(crewTrips) !== (line.crewTrips ?? null)) changes.crewTrips = numOrNull(crewTrips);
      if (numOrNull(crewPersons) !== (line.crewPersons ?? null))
        changes.crewPersons = numOrNull(crewPersons);
      if (numOrNull(crewTrucks) !== (line.crewTrucks ?? null))
        changes.crewTrucks = numOrNull(crewTrucks);
      if ((installZip.trim() || null) !== (line.installZip ?? null))
        changes.installZip = installZip.trim() || null;
      if (Object.keys(changes).length > 0) {
        await dataSource.updateScheduleLine(line.id, changes);
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
      await deleteScheduleLine(line.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          {line.jobNo} · {line.customerName}
        </div>

        <div className="form-field">
          <div className="form-field__label">Job description</div>
          <textarea
            className="form-field__input"
            rows={2}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="BC job summary (shown under the job name)"
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Task / card text</div>
          <textarea
            className="form-field__input"
            rows={2}
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Task description shown on the card"
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
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
          <div className="form-field__label">End</div>
          <input
            className="form-field__input"
            type="datetime-local"
            value={preview.end ? format(preview.end, "yyyy-MM-dd'T'HH:mm") : ""}
            onChange={(e) => onEndChange(e.target.value)}
            title="Set the end date — adjusts the hours to land here"
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

        {isInstall && (
        <>
        <div className="form-field">
          <div className="form-field__label">Trips · crew per trip</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input
              className="form-field__input"
              type="number"
              min="0"
              step="1"
              value={crewTrips}
              onChange={(e) => setCrewTrips(e.target.value)}
              placeholder="Trips"
              title="Number of trips"
            />
            <input
              className="form-field__input"
              type="number"
              min="0"
              step="1"
              value={crewPersons}
              onChange={(e) => setCrewPersons(e.target.value)}
              placeholder="Men"
              title="Men per trip"
            />
            <input
              className="form-field__input"
              type="number"
              min="0"
              step="1"
              value={crewTrucks}
              onChange={(e) => setCrewTrucks(e.target.value)}
              placeholder="Trucks"
              title="Trucks per trip"
            />
          </div>
        </div>
        <div className="form-field">
          <div className="form-field__label">Install ZIP (weather)</div>
          <input
            className="form-field__input"
            value={installZip}
            onChange={(e) => setInstallZip(e.target.value)}
            placeholder="e.g. 67501"
          />
        </div>
        </>
        )}

        <PreviewPane
          startInput={startDate}
          hours={Number(overrideHours)}
          employeeId={employeeId}
          useStore={useStore}
          currentEnd={line.endDateTime}
        />
        {employee && (
          <div
            style={{
              padding: "0 12px 12px",
              fontSize: 11,
              color: "var(--text-tertiary)",
            }}
          >
            {Math.round(employee.productivityRate * 100)}% productivity ·
            standard {employee.standardHoursPerDay}h/day
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
          <button
            className="btn-danger"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
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
    {confirmingDelete && (
      <ConfirmDialog
        title="Delete this card?"
        message="Are you sure you want to delete this scheduled job card? This can't be undone."
        confirmLabel="Yes"
        cancelLabel="Cancel"
        danger
        busy={busy}
        onConfirm={onDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    )}
    </>
  );
}

interface PreviewPaneProps {
  startInput: string;
  hours: number;
  employeeId: string;
  useStore: UseScheduleStore;
  currentEnd: Date;
}

function PreviewPane({ startInput, hours, employeeId, useStore, currentEnd }: PreviewPaneProps) {
  const start = startInput ? new Date(startInput) : null;
  const preview = useLivePreview(
    start,
    hours,
    null,
    employeeId,
    useStore,
  );
  const changedEnd =
    preview.end && preview.end.getTime() !== currentEnd.getTime();
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--text-secondary)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
        Predicted
      </div>
      {preview.end ? (
        <>
          <div>
            End{changedEnd && <span style={{ color: "var(--lumineo-red)", marginLeft: 6, fontSize: 10 }}>changed</span>}:{" "}
            <strong>{format(preview.end, "EEE MMM d HH:mm")}</strong>
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>
            {preview.effectiveHours.toFixed(2)}h scheduled · was {format(currentEnd, "MMM d HH:mm")}
          </div>
        </>
      ) : (
        <div style={{ color: "var(--text-tertiary)" }}>Enter a valid start and hours.</div>
      )}
    </div>
  );
}
