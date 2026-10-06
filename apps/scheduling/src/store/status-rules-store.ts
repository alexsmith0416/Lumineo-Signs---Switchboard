import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import { DEFAULT_STATUS_RULES, withDefaults, type StatusRules } from "../services/status-rules";

/**
 * Step → Current Status rules (Settings → Status rules), shared by everyone.
 * Kept in the Jobs config table (crfdf_jobsview) under the key "statusRules",
 * next to the shared Jobs views — no table of its own. Missing keys fall back
 * to DEFAULT_STATUS_RULES. Dev keeps edits in memory.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const KEY = "statusRules";

interface StatusRulesState {
  rules: StatusRules;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Set one step's status ("" = back to the default). */
  setRule: (stepKey: string, status: string) => void;
}

export const useStatusRulesStore = create<StatusRulesState>((set, get) => ({
  rules: DEFAULT_STATUS_RULES,
  loaded: false,

  load: async (force = false) => {
    if (get().loaded && !force) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    try {
      const rows = await (await import("../services/dataverse-live")).fetchJobsViewConfig();
      set({ rules: withDefaults(rows.get(KEY) as Record<string, string> | undefined), loaded: true });
    } catch (e) {
      console.warn("[status-rules] load failed — using the defaults", e);
      set({ loaded: true });
    }
  },

  setRule: (stepKey, status) => {
    const next: Record<string, string> = { ...get().rules };
    next[stepKey] = status || DEFAULT_STATUS_RULES[stepKey] || "";
    set({ rules: next });
    if (!LIVE) return;
    void persistOrReport("Save status rules", async () =>
      (await import("../services/dataverse-live")).saveJobsViewConfig(KEY, next),
    );
  },
}));
