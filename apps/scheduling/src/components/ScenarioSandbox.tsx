import { useEffect, useState } from "react";
import {
  useInstallationScenarioStoreNEK,
  useInstallationScenarioStoreWK,
  useProductionScenarioStore,
  useShippingScenarioStore,
} from "../store/scenario-store";
import {
  useInstallationStoreNEK,
  useInstallationStoreWK,
  useScheduleStore,
  useShippingStore,
} from "../store/schedule-store";
import { useScenarioPreviewStore } from "../store/scenario-preview-store";
import { detectConflicts } from "../engine/conflicts";
import { KIND_META } from "../services/data-source";
import ScenarioBanner from "./scenario/ScenarioBanner";
import ChangeBuilder from "./scenario/ChangeBuilder";
import ImpactSummary from "./scenario/ImpactSummary";
import ScheduleDiff from "./scenario/ScheduleDiff";
import CalendarView from "./CalendarView";

type Kind = "production" | "install-wk" | "install-nek" | "shipping";

const KIND_TABS: Array<{ id: Kind; label: string }> = [
  { id: "production", label: "Production" },
  { id: "install-wk", label: "Install · WK" },
  { id: "install-nek", label: "Install · NEK" },
  { id: "shipping", label: "Shipping" },
];

export default function ScenarioSandbox() {
  const [kind, setKind] = useState<Kind>("production");
  // Which kinds have finished their initial live-schedule load. Used to gate the
  // "Loading…" screen — an EMPTY week is a valid loaded state, so we can't key
  // off schedule.length (that left the sandbox stuck loading forever).
  const [loadedKinds, setLoadedKinds] = useState<Set<Kind>>(new Set());

  // Subscribe to every scenario store's pending-change count so the tab
  // labels can show "(N)" badges. Hook order is stable across renders.
  const prodCount = useProductionScenarioStore((s) => s.changes.length);
  const wkCount = useInstallationScenarioStoreWK((s) => s.changes.length);
  const nekCount = useInstallationScenarioStoreNEK((s) => s.changes.length);
  const shipCount = useShippingScenarioStore((s) => s.changes.length);
  const counts: Record<Kind, number> = {
    production: prodCount,
    "install-wk": wkCount,
    "install-nek": nekCount,
    shipping: shipCount,
  };

  // Resolve the matching store pair for the selected kind. Calling all of
  // them by selector each render is fine — Zustand only re-renders when
  // the selected slice changes.
  const scenarioStore =
    kind === "production"
      ? useProductionScenarioStore
      : kind === "install-wk"
        ? useInstallationScenarioStoreWK
        : kind === "install-nek"
          ? useInstallationScenarioStoreNEK
          : useShippingScenarioStore;
  const scheduleStore =
    kind === "production"
      ? useScheduleStore
      : kind === "install-wk"
        ? useInstallationStoreWK
        : kind === "install-nek"
          ? useInstallationStoreNEK
          : useShippingStore;
  const kindMeta =
    kind === "production"
      ? KIND_META.production
      : kind === "shipping"
        ? KIND_META.shipping
        : KIND_META.installation;

  const active = scenarioStore((s) => s.active);
  const result = scenarioStore((s) => s.result);
  const enter = scenarioStore((s) => s.enter);
  const getContext = scheduleStore((s) => s.getContext);
  const loadWeek = scheduleStore((s) => s.loadWeek);
  const liveWeekStart = scheduleStore((s) => s.weekStart);

  const booted = loadedKinds.has(kind);

  // Load the selected kind's live schedule once, then mark it booted. An empty
  // result is fine — we still proceed (the old code hung waiting for rows).
  useEffect(() => {
    if (booted) return;
    let alive = true;
    void loadWeek().finally(() => {
      if (alive) setLoadedKinds((prev) => new Set(prev).add(kind));
    });
    return () => {
      alive = false;
    };
  }, [booted, kind, loadWeek]);

  // Auto-enter the sandbox once its data is loaded (even for an empty week), and
  // after the user Commits / Discards. No splash screen.
  useEffect(() => {
    if (booted && !active) enter(getContext());
  }, [booted, active, enter, getContext]);

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
  }, [active, result, liveWeekStart, getContext, kind]);

  if (!booted) {
    return <div className="loading">Loading schedule…</div>;
  }

  return (
    <div>
      {/* Kind tabs — switch which calendar this sandbox is for */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 10,
          padding: 4,
          background: "var(--bg-secondary)",
          borderRadius: 6,
          flexWrap: "wrap",
        }}
        role="tablist"
        aria-label="Scenario sandbox kind"
      >
        {KIND_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={kind === t.id}
            onClick={() => setKind(t.id)}
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 4,
              background: kind === t.id ? "var(--lumineo-navy)" : "transparent",
              color: kind === t.id ? "#fff" : "var(--text-primary)",
              fontWeight: kind === t.id ? 600 : 500,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1px 6px",
                  borderRadius: 8,
                  background: kind === t.id ? "rgba(255,255,255,0.25)" : "var(--lumineo-red)",
                  color: "#fff",
                  fontSize: 10,
                }}
              >
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <ScenarioBanner useStore={scenarioStore} />
      <div className="scenario-grid" style={{ marginTop: 12 }}>
        <ChangeBuilder useStore={scenarioStore} useScheduleStore={scheduleStore} />
        <div>
          <ImpactSummary useStore={scenarioStore} />
          <ScheduleDiff useStore={scenarioStore} />
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
            ...kindMeta,
            title: "Scenario Preview",
          }}
          readOnly
        />
      </div>
    </div>
  );
}
