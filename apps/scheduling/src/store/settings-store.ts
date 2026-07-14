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

function readCascade(): boolean {
  try {
    const v = localStorage.getItem(CASCADE_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

interface SettingsState {
  cascadeEnabled: boolean;
  setCascadeEnabled: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  cascadeEnabled: readCascade(),
  setCascadeEnabled: (value) => {
    try {
      localStorage.setItem(CASCADE_KEY, String(value));
    } catch {
      /* ignore disabled / quota-exceeded storage */
    }
    set({ cascadeEnabled: value });
  },
}));
