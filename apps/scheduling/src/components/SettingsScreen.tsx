import { useSettingsStore } from "../store/settings-store";
import { applyHeaderVisibility, isInPowerPlayer } from "../services/power-host";

/** App settings. Cascade/conflict behavior + Power Apps header visibility. */
export default function SettingsScreen() {
  const cascadeEnabled = useSettingsStore((s) => s.cascadeEnabled);
  const setCascadeEnabled = useSettingsStore((s) => s.setCascadeEnabled);
  const hideHeader = useSettingsStore((s) => s.hideHeader);
  const setHideHeader = useSettingsStore((s) => s.setHideHeader);
  const setPresentationMode = useSettingsStore((s) => s.setPresentationMode);

  const toggleHeader = () => {
    const next = !hideHeader;
    setHideHeader(next);
    // Reloads the app at the with/without-hideNavBar play URL. No-op in dev.
    applyHeaderVisibility(next);
  };

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

      <div className="settings-section">
        <div className="settings-section__title">Display</div>

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Full screen (TV / presentation mode)</div>
            <div className="settings-row__desc">
              Hides the side navigation and everything above the calendar (search,
              week controls, toggles) — keeping just the schedule title — and shows
              the current schedule full size, ideal for a TV or monitor. Turning this
              <strong> on</strong> switches to the last schedule you were viewing.
              Press <strong>ESC</strong> or the corner button to exit.
            </div>
          </div>
          <button
            type="button"
            className="settings-switch"
            aria-label="Full screen presentation mode"
            onClick={() => setPresentationMode(true)}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          Displays the current schedule full size. Press <strong>ESC</strong> to exit.
        </div>

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Hide the Power Apps header</div>
            <div className="settings-row__desc">
              Hides the purple Power Apps bar at the very top of the window for more
              screen space. That bar is part of the Power Apps player (not this app), so
              toggling this <strong>reloads the app</strong> with the header hidden or
              shown. Only takes effect in the deployed app, not local preview.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hideHeader}
            aria-label="Hide the Power Apps header"
            className={"settings-switch" + (hideHeader ? " settings-switch--on" : "")}
            onClick={toggleHeader}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          The header is set to <strong>{hideHeader ? "hidden" : "shown"}</strong>.
          {!isInPowerPlayer() && " (Preview mode — this applies only in the deployed app.)"}
        </div>
      </div>
    </div>
  );
}
