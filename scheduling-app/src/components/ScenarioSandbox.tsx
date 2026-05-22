import { useEffect } from "react";
import { useScenarioStore } from "../store/scenario-store";
import { useScheduleStore } from "../store/schedule-store";
import ScenarioBanner from "./scenario/ScenarioBanner";
import ChangeBuilder from "./scenario/ChangeBuilder";
import ImpactSummary from "./scenario/ImpactSummary";
import ScheduleDiff from "./scenario/ScheduleDiff";

export default function ScenarioSandbox() {
  const { active, enter } = useScenarioStore();
  const getContext = useScheduleStore((s) => s.getContext);
  const loadWeek = useScheduleStore((s) => s.loadWeek);
  const schedule = useScheduleStore((s) => s.schedule);

  useEffect(() => {
    if (schedule.length === 0) void loadWeek();
  }, [schedule.length, loadWeek]);

  if (!active) {
    return (
      <div className="scenario-empty">
        <h2>Scenario Sandbox</h2>
        <p style={{ maxWidth: 460, margin: "8px auto 16px" }}>
          A separate workspace cloned from the live schedule. Stack hypothetical changes —
          add overtime, enable weekends, insert a rush job, shift a task — and see the
          impact before anything goes live.
        </p>
        <button
          className="btn-primary"
          onClick={() => enter(getContext())}
          disabled={schedule.length === 0}
        >
          Enter Sandbox
        </button>
      </div>
    );
  }

  return (
    <div>
      <ScenarioBanner />
      <div className="scenario-grid" style={{ marginTop: 12 }}>
        <ChangeBuilder />
        <div>
          <ImpactSummary />
          <ScheduleDiff />
        </div>
      </div>
    </div>
  );
}
