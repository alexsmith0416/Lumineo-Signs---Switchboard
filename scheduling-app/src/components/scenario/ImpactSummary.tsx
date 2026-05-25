import { useScenarioStore, type UseScenarioStore } from "../../store/scenario-store";

interface ImpactSummaryProps {
  useStore?: UseScenarioStore;
}

export default function ImpactSummary({ useStore = useScenarioStore }: ImpactSummaryProps = {}) {
  const { impact } = useStore();
  if (!impact) {
    return (
      <div className="impact-card">
        <h3>Impact</h3>
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
          No changes staged yet.
        </div>
      </div>
    );
  }
  return (
    <div className="impact-card">
      <h3>Impact</h3>
      <div className="impact-stat">
        <span>Tasks moved</span>
        <span className="value">{impact.movedCount}</span>
      </div>
      <div className="impact-stat">
        <span>New tasks</span>
        <span className="value">{impact.newCount}</span>
      </div>
      <div className="impact-stat">
        <span>Rescued jobs</span>
        <span className="value good">{impact.rescuedJobs.length}</span>
      </div>
      <div className="impact-stat">
        <span>Newly past due</span>
        <span className={`value ${impact.nowPastDue.length ? "bad" : ""}`}>
          {impact.nowPastDue.length}
        </span>
      </div>
      <div className="impact-stat">
        <span>Pushed jobs</span>
        <span className={`value ${impact.pushedJobs.length ? "bad" : ""}`}>
          {impact.pushedJobs.length}
        </span>
      </div>
      <div className="impact-stat">
        <span>OT cost delta</span>
        <span className={`value ${impact.overtimeCostDelta > 0 ? "bad" : ""}`}>
          ${impact.overtimeCostDelta.toFixed(2)}
        </span>
      </div>
      {impact.rescuedJobs.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
          Rescued: {impact.rescuedJobs.join(", ")}
        </div>
      )}
      {impact.nowPastDue.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--lumineo-red)" }}>
          Past due: {impact.nowPastDue.join(", ")}
        </div>
      )}
    </div>
  );
}
