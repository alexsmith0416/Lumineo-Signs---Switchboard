import { create } from "zustand";

/**
 * App-wide scheduling preferences (per device, persisted in localStorage).
 *
 * `cascadeEnabled` controls the conflict/cascade behavior. Default OFF: editing
 * a card (move / resize / hours) changes ONLY that card, nothing auto-moves, no
 * dialog appears, and the loaded board keeps its stored positions exactly
 * (overlaps just surface a conflict icon). When ON, moving/resizing a task that
 * would push others shows the cascade preview dialog and the board settles to a
 * conflict-free fixpoint on load. Toggle it in Settings.
 */
const CASCADE_KEY = "lumineo.settings.cascadeEnabled";
// Whether to hide the purple Power Apps player header. Default OFF (shown).
// The actual hide/show happens by reloading the app at the hideNavBar play URL
// (see services/power-host.ts) — this flag just remembers the preference. We
// can't read the cross-origin play URL, so the stored flag can drift from the
// real state; defaulting to "shown" matches the no-param URL you land on after a
// deploy, so a single toggle hides the header (no toggle-off-then-on dance).
const HIDE_HEADER_KEY = "lumineo.settings.hideHeader";
// Whether to draw the faint pulsing red "now" line at the current day + time on
// the calendars. Default ON.
const NOW_LINE_KEY = "lumineo.settings.showNowLine";
// Whether hovering a person's day shows the scheduled-hours readout pill
// ("6h of 8h · 2h open"). Default ON. Off for anyone who finds it distracting
// while dragging cards around, or on a wall display.
const DAY_HOURS_KEY = "lumineo.settings.showDayHours";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore disabled / quota-exceeded storage */
  }
}

interface SettingsState {
  cascadeEnabled: boolean;
  setCascadeEnabled: (value: boolean) => void;
  hideHeader: boolean;
  setHideHeader: (value: boolean) => void;
  showNowLine: boolean;
  setShowNowLine: (value: boolean) => void;
  showDayHours: boolean;
  setShowDayHours: (value: boolean) => void;
  // Presentation ("TV") mode hides the app's own top + side nav and shows the
  // current screen full-bleed for display on a monitor. Transient by design —
  // it's a mode you drop with ESC, not a saved preference — so it is NOT
  // persisted to localStorage and always starts off on load.
  presentationMode: boolean;
  setPresentationMode: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  cascadeEnabled: readBool(CASCADE_KEY, false),
  setCascadeEnabled: (value) => {
    writeBool(CASCADE_KEY, value);
    set({ cascadeEnabled: value });
  },
  hideHeader: readBool(HIDE_HEADER_KEY, false),
  setHideHeader: (value) => {
    writeBool(HIDE_HEADER_KEY, value);
    set({ hideHeader: value });
  },
  showNowLine: readBool(NOW_LINE_KEY, true),
  setShowNowLine: (value) => {
    writeBool(NOW_LINE_KEY, value);
    set({ showNowLine: value });
  },
  showDayHours: readBool(DAY_HOURS_KEY, true),
  setShowDayHours: (value) => {
    writeBool(DAY_HOURS_KEY, value);
    set({ showDayHours: value });
  },
  presentationMode: false,
  setPresentationMode: (value) => set({ presentationMode: value }),
}));
