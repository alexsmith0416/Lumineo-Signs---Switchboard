import { create } from "zustand";
import { persistOrReport } from "./write-status-store";

/**
 * Header colours for the Job Queue's "From BC steps" groups (Fabrication,
 * Routing, …, Ready for Install), SHARED by everyone and used on both the
 * Production and Installation boards. Stored as one entry in the Jobs views
 * table (crfdf_jobsview, key "queue-step-colors"). A step with no colour set
 * keeps the default header.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const KEY = "queue-step-colors";

export interface StepColor {
  color: string;
  textColor: string;
}

interface StepColorsState {
  byStep: Record<string, StepColor>;
  loaded: boolean;
  load: () => Promise<void>;
  /** Set a step's header colour; null puts the default back. */
  setColor: (step: string, color: StepColor | null) => void;
}

export const useStepColorsStore = create<StepColorsState>((set, get) => ({
  byStep: {},
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    try {
      const rows = await (await import("../services/dataverse-live")).fetchJobsViewConfig();
      const v = rows.get(KEY);
      set({ byStep: v && typeof v === "object" ? (v as Record<string, StepColor>) : {}, loaded: true });
    } catch (e) {
      console.warn("[step-colors] couldn't load", e);
      set({ loaded: true });
    }
  },

  setColor: (step, color) => {
    const byStep = { ...get().byStep };
    if (color) byStep[step] = color;
    else delete byStep[step];
    set({ byStep });
    if (!LIVE) return;
    void persistOrReport("Change a queue step colour", async () =>
      (await import("../services/dataverse-live")).saveJobsViewConfig(KEY, byStep),
    );
  },
}));
