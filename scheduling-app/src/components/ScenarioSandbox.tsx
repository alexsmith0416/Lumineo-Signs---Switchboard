import { useEffect } from "react";
import { useScenarioStore } from "../store/scenario-store";
import { useScheduleStore } from "../store/schedule-store";
import { useScenarioPreviewStore } from "../store/scenario-preview-store";
import { detectConflicts } from "../engine/conflicts";
import { KIND_META } from "../services/data-source";
import ScenarioBanner from "./scenario/ScenarioBanner";
import ChangeBuilder from "./scenario/ChangeBuilder";
import ImpactSummary from "./scenario/ImpactSummary";
import ScheduleDiff from "./scenario/ScheduleDiff";
import CalendarView from "./CalendarView";

export default function ScenarioSandbox() {
  const { active, enter, result } = useScenarioStore();
  const getContext = useScheduleStore((s) => s.getContext);
  const loadWeek = useScheduleStore((s) => s.loadWeek);
  const schedule = useScheduleStore((s) => s.schedule);
  const liveWeekStart = useScheduleStore((s) => s.weekStart);

  // Make sure the live schedule has been loaded once before we try to enter.
  useEffect(() => {
    if (schedule.length === 0) void loadWeek();
  }, [schedule.length, loadWeek]);

  // Auto-enter the sandbox the moment the user lands on this view (or after
  // they Commit / Discard). No more splash screen.
  useEffect(() => {
    if (!active && schedule.length > 0) {
      enter(getContext());
    }
  }, [active, schedule.length, enter, getContext]);

  // Keep the preview store in sync with the scenario state so the embedded
  // CalendarView reflects every staged change in real time.
  useEffect(() => {
    if (!active) return;
    const ctx = result ? result.scenario : getContext();
    const conflicts = result ? result.conflicts : detectConflicts(ctx);
    useScenarioPreviewStore.setState({
      employees: ctx.employees,
      departments: ctx.departments,
      schedule: ctx.schedule,
      workHours: ctx.workHours,
      overtime: ctx.overtime,
      conflicts,
      weekStart: liveWeekStart,
      loading: false,
      error: null,
    });
  }, [active, result, liveWeekStart, getContext]);

  if (schedule.length === 0) {
    return <div className="loading">Loading schedule…</div>;
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

      <div style={{ marginTop: 16 }}>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          Preview — schedule with proposed changes applied
        </h3>
        <CalendarView
          useStore={useScenarioPreviewStore}
          kindMeta={{
            ...KIND_META.production,
            title: "Scenario Preview",
          }}
          readOnly
        />
      </div>
    </div>
  );
}
