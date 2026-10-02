import { useState } from "react";
import { useSettingsStore } from "../store/settings-store";
import { applyHeaderVisibility, isInPowerPlayer } from "../services/power-host";
import { canEditBillingPeriods, isAdminLevel, useCurrentUser } from "../services/current-user";
import UsersAdminPanel from "./UsersAdminPanel";
import BillingPeriodsSection from "./BillingPeriodsSection";
import LeadTimesSection from "./LeadTimesSection";
import BusinessCentralSection from "./BusinessCentralSection";

/** App settings. Cascade/conflict behavior + Power Apps header visibility, plus
 *  the admin-only Users manager (tucked away here). */
export default function SettingsScreen() {
  const cascadeEnabled = useSettingsStore((s) => s.cascadeEnabled);
  const setCascadeEnabled = useSettingsStore((s) => s.setCascadeEnabled);
  const hideHeader = useSettingsStore((s) => s.hideHeader);
  const setHideHeader = useSettingsStore((s) => s.setHideHeader);
  const showNowLine = useSettingsStore((s) => s.showNowLine);
  const setShowNowLine = useSettingsStore((s) => s.setShowNowLine);
  const showDayHours = useSettingsStore((s) => s.showDayHours);
  const setShowDayHours = useSettingsStore((s) => s.setShowDayHours);
  const compactSidebar = useSettingsStore((s) => s.compactSidebar);
  const setCompactSidebar = useSettingsStore((s) => s.setCompactSidebar);
  const hideWeekendDefault = useSettingsStore((s) => s.hideWeekendDefault);
  const showDayValue = useSettingsStore((s) => s.showDayValue);
  const setShowDayValue = useSettingsStore((s) => s.setShowDayValue);
  const setHideWeekendDefault = useSettingsStore((s) => s.setHideWeekendDefault);
  const setPresentationMode = useSettingsStore((s) => s.setPresentationMode);
  // Only real admins see + open the Users manager.
  const { realType } = useCurrentUser();
  const [showUsers, setShowUsers] = useState(false);

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

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Current time line</div>
            <div className="settings-row__desc">
              Shows a faint, softly pulsing <strong>red line</strong> at the current day and time
              on the Production, Installation and Shipping calendars — a quick visual marker of
              where “now” falls in the week. It only appears when you're viewing the current week.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showNowLine}
            aria-label="Current time line"
            className={"settings-switch" + (showNowLine ? " settings-switch--on" : "")}
            onClick={() => setShowNowLine(!showNowLine)}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          The current-time line is <strong>{showNowLine ? "on" : "off"}</strong>.
        </div>

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Day hours on hover</div>
            <div className="settings-row__desc">
              Hovering a day on someone's row pops up how many hours are scheduled that day
              against their capacity — <em>“6h of 8h · 2h open”</em>, red when over, and
              <strong> PTO / off</strong> for blocked days. Turn it off if you'd rather have a
              clean board while you're dragging cards around, or on a wall display.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showDayHours}
            aria-label="Day hours on hover"
            className={"settings-switch" + (showDayHours ? " settings-switch--on" : "")}
            onClick={() => setShowDayHours(!showDayHours)}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          The hover readout is <strong>{showDayHours ? "on" : "off"}</strong>.
        </div>

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Compact sidebar</div>
            <div className="settings-row__desc">
              Shrinks the side navigation to a slim strip of icons (with the Lumineo logo on
              top) so the schedule gets more of the screen. Move the mouse over the strip and
              it opens out to the full sidebar; move away and it slides back.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={compactSidebar}
            aria-label="Compact sidebar"
            className={"settings-switch" + (compactSidebar ? " settings-switch--on" : "")}
            onClick={() => setCompactSidebar(!compactSidebar)}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          The sidebar is <strong>{compactSidebar ? "compact" : "full"}</strong>.
        </div>

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Hide the weekend by default</div>
            <div className="settings-row__desc">
              Opens the Production and Installation calendars with <strong>Saturday and Sunday
              hidden</strong>, so Monday–Friday spread across the full width. You can still
              show or hide the weekend any time by <strong>right-clicking a day header</strong>.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hideWeekendDefault}
            aria-label="Hide the weekend by default"
            className={"settings-switch" + (hideWeekendDefault ? " settings-switch--on" : "")}
            onClick={() => setHideWeekendDefault(!hideWeekendDefault)}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          The calendars open with the weekend <strong>{hideWeekendDefault ? "hidden" : "shown"}</strong>.
        </div>

        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">Day value on hover</div>
            <div className="settings-row__desc">
              Hovering a <strong>day header</strong> on the Production or Installation calendar pops up
              the total value scheduled that day — <strong>WK</strong>, <strong>NEK</strong> and the two{" "}
              <strong>combined</strong>. Each job counts once per day it's on, at the value its cards
              show (BC remaining balance, else the invoice amount). Only shown to people who can see $.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showDayValue}
            aria-label="Day value on hover"
            className={"settings-switch" + (showDayValue ? " settings-switch--on" : "")}
            onClick={() => setShowDayValue(!showDayValue)}
          >
            <span className="settings-switch__knob" />
          </button>
        </div>

        <div className="settings-row__status">
          The day-value popup is <strong>{showDayValue ? "on" : "off"}</strong>.
        </div>
      </div>

      {canEditBillingPeriods(realType) && <BillingPeriodsSection />}
      {canEditBillingPeriods(realType) && <LeadTimesSection />}
      {canEditBillingPeriods(realType) && <BusinessCentralSection />}

      {isAdminLevel(realType) && (
        <div className="settings-section">
          <div className="settings-section__title">Users</div>

          <div className="settings-row">
            <div className="settings-row__text">
              <div className="settings-row__title">Edit users</div>
              <div className="settings-row__desc">
                Manage who signs in and the role they get (Admin, Ops, Production, Install,
                Sales, PM). This controls what a signed-in user <strong>sees</strong> — not who
                can open the app, which is set by sharing it in Power Apps.
              </div>
            </div>
            <button type="button" className="btn-primary" onClick={() => setShowUsers(true)}>
              Manage users…
            </button>
          </div>
        </div>
      )}

      {showUsers && <UsersAdminPanel onClose={() => setShowUsers(false)} />}
    </div>
  );
}
