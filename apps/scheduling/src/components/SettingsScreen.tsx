import { useSettingsStore } from "../store/settings-store";

/** App settings. Currently the cascade/conflict toggle; room to grow. */
export default function SettingsScreen() {
  const cascadeEnabled = useSettingsStore((s) => s.cascadeEnabled);
  const setCascadeEnabled = useSettingsStore((s) => s.setCascadeEnabled);

  return (
    <div className="settings-screen">
      <div className="settings-section">
        <div className="settings-section__title">Scheduling</div>

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Auto-cascade &amp; conflict prompts</div>
            <div className="settings-row__desc">
              When <strong>on</strong>, moving or resizing a task that would push other tasks
              shows a preview so you can cascade or move only, and the board settles
              conflict-free when it loads. Turn this <strong>off</strong> to move and resize
              tasks freely (a full override) — nothing auto-moves, no dialog appears, and any
              overlaps simply show a ⚡ conflict icon.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={cascadeEnabled}
            aria-label="Auto-cascade and conflict prompts"
            className={"settings-switch" + (cascadeEnabled ? " settings-switch--on" : "")}
            onClick={() => setCascadeEnabled(!cascadeEnabled)}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          Cascade is currently <strong>{cascadeEnabled ? "on" : "off"}</strong>.
        </div>
      </div>
    </div>
  );
}
