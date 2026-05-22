import { useState } from "react";
import { useScenarioStore } from "../../store/scenario-store";
import OvertimeForm from "./forms/OvertimeForm";
import WeekendsForm from "./forms/WeekendsForm";
import ShiftTaskForm from "./forms/ShiftTaskForm";
import RushJobForm from "./forms/RushJobForm";

type ChangeKind = "overtime" | "weekends" | "shift" | "rush" | null;

function describeChange(change: ReturnType<typeof useScenarioStore.getState>["changes"][number]): string {
  switch (change.type) {
    case "shift-task":
      return `Shift task ${change.lineId} → ${change.newStart.toLocaleString()}`;
    case "update-duration":
      return `Set task ${change.lineId} to ${change.overrideHours}h`;
    case "add-overtime":
      return `+${change.extraHours}h OT for ${change.employeeId} on ${change.date}`;
    case "enable-weekends":
      return `Enable weekends for ${change.employeeId}`;
    case "insert-rush-job":
      return `Insert rush job ${change.jobNo} (${change.tasks.length} tasks)`;
  }
}

export default function ChangeBuilder() {
  const { changes, removeChange } = useScenarioStore();
  const [active, setActive] = useState<ChangeKind>(null);

  if (active) {
    const onDone = () => setActive(null);
    return (
      <div className="scenario-changes">
        {active === "overtime" && <OvertimeForm onDone={onDone} />}
        {active === "weekends" && <WeekendsForm onDone={onDone} />}
        {active === "shift" && <ShiftTaskForm onDone={onDone} />}
        {active === "rush" && <RushJobForm onDone={onDone} />}
        <div style={{ padding: 12 }}>
          <button className="btn-secondary" onClick={onDone}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="scenario-changes">
      <h3 style={{ marginTop: 0 }}>Stacked changes</h3>
      {changes.length === 0 && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12, padding: "8px 0" }}>
          Nothing yet — pick a change type below.
        </div>
      )}
      {changes.map((c, i) => (
        <div key={i} className="scenario-change-row">
          <span style={{ flex: 1, fontSize: 12 }}>{describeChange(c)}</span>
          <button className="btn-secondary" onClick={() => removeChange(i)}>
            Remove
          </button>
        </div>
      ))}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button className="btn-primary" onClick={() => setActive("overtime")}>+ Overtime</button>
        <button className="btn-primary" onClick={() => setActive("weekends")}>+ Weekends</button>
        <button className="btn-primary" onClick={() => setActive("shift")}>+ Shift task</button>
        <button className="btn-primary" onClick={() => setActive("rush")}>+ Rush job</button>
      </div>
    </div>
  );
}
