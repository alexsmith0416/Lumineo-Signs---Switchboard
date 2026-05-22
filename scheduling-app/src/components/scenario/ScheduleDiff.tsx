import { format } from "date-fns";
import { useScenarioStore } from "../../store/scenario-store";

export default function ScheduleDiff() {
  const { result, base } = useScenarioStore();
  if (!result || !base) {
    return (
      <div className="impact-card">
        <h3>Diff</h3>
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
          Stack changes to see what moved.
        </div>
      </div>
    );
  }

  const baseById = new Map(base.schedule.map((l) => [l.id, l]));
  const moved = result.scenario.schedule.filter((l) => result.movedLineIds.has(l.id));
  const inserted = result.scenario.schedule.filter((l) => result.newLineIds.has(l.id));

  return (
    <div className="impact-card">
      <h3>Diff</h3>
      {moved.length === 0 && inserted.length === 0 && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>No movement.</div>
      )}
      {moved.map((line) => {
        const before = baseById.get(line.id);
        if (!before) return null;
        return (
          <div key={line.id} style={{ marginBottom: 8, fontSize: 11 }}>
            <div style={{ fontWeight: 600 }}>{line.jobNo} · {line.planningLineDescription}</div>
            <div style={{ color: "var(--text-secondary)" }}>
              {format(before.startDateTime, "EEE MMM d HH:mm")} → {format(line.startDateTime, "EEE MMM d HH:mm")}
            </div>
          </div>
        );
      })}
      {inserted.map((line) => (
        <div key={line.id} style={{ marginBottom: 8, fontSize: 11 }}>
          <div style={{ fontWeight: 600, color: "#0a7e2d" }}>
            + {line.jobNo} · {line.planningLineDescription}
          </div>
          <div style={{ color: "var(--text-secondary)" }}>
            inserted at {format(line.startDateTime, "EEE MMM d HH:mm")}
          </div>
        </div>
      ))}
    </div>
  );
}
