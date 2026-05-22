import { useScenarioStore } from "../../store/scenario-store";

interface ScenarioBannerProps {
  onCommit?: () => void;
}

export default function ScenarioBanner({ onCommit }: ScenarioBannerProps) {
  const { active, changes, discard, commit } = useScenarioStore();
  if (!active) return null;
  return (
    <div className="scenario-banner">
      <span>⚠ SCENARIO SANDBOX</span>
      <span style={{ flex: 1, opacity: 0.9 }}>
        {changes.length} pending change{changes.length === 1 ? "" : "s"} — nothing is live yet
      </span>
      <button onClick={() => void discard()}>Discard</button>
      <button
        onClick={async () => {
          await commit();
          onCommit?.();
        }}
      >
        Commit
      </button>
    </div>
  );
}
