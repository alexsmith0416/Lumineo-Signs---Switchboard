import { create } from "zustand";

/**
 * App-wide scheduling preferences (per device, persisted in localStorage).
 *
 * `cascadeEnabled` controls the conflict/cascade behavior: when ON (default),
 * moving or resizing a task that would push other tasks shows the cascade
 * preview dialog, and the board settles to a conflict-free fixpoint on load.
 * When OFF, tasks move/resize freely (a "full override") — nothing auto-moves,
 * the dialog never appears, and the loaded board keeps its stored positions
 * (overlaps just surface a conflict icon). Toggle it in Settings, or turn it
 * off from the cascade dialog itself.
 */
const CASCADE_KEY = "lumineo.settings.cascadeEnabled";
// Whether to hide the purple Power Apps player header. Default ON (hidden).
// The actual hide/show happens by reloading the app at the hideNavBar play URL
// (see services/power-host.ts) — this flag just remembers the preference.
const HIDE_HEADER_KEY = "lumineo.settings.hideHeader";

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
  // Presentation ("TV") mode hides the app's own top + side nav and shows the
  // current screen full-bleed for display on a monitor. Transient by design —
  // it's a mode you drop with ESC, not a saved preference — so it is NOT
  // persisted to localStorage and always starts off on load.
  presentationMode: boolean;
  setPresentationMode: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  cascadeEnabled: readBool(CASCADE_KEY, true),
  setCascadeEnabled: (value) => {
    writeBool(CASCADE_KEY, value);
    set({ cascadeEnabled: value });
  },
  hideHeader: readBool(HIDE_HEADER_KEY, true),
  setHideHeader: (value) => {
    writeBool(HIDE_HEADER_KEY, value);
    set({ hideHeader: value });
  },
  presentationMode: false,
  setPresentationMode: (value) => set({ presentationMode: value }),
}));
