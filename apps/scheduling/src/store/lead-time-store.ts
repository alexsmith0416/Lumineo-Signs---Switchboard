import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import { DEFAULT_RULES, type LeadTimeRule } from "../services/lead-times";

/**
 * Lead-time rules (crfdf_leadtimerule) — shared by everyone, edited in
 * Settings → Lead times by Admin / Developer / Ops. They set each job's Mfg
 * Target / Install Target (services/lead-times.ts). Until the list has been
 * saved (or the table exists) the built-in DEFAULT_RULES apply.
 * Saves are optimistic: a failed save keeps the edit on screen and reports it.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

interface LeadTimeState {
  rules: LeadTimeRule[];
  loaded: boolean;
  loading: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Replace the whole list (order = priority). */
  saveRules: (rules: LeadTimeRule[]) => Promise<void>;
}

export const useLeadTimeStore = create<LeadTimeState>((set, get) => ({
  rules: DEFAULT_RULES,
  loaded: false,
  loading: false,

  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    if (!LIVE) {
      set({ loaded: true, loading: false });
      return;
    }
    try {
      const rules = await (await import("../services/dataverse-live")).fetchLeadTimeRules();
      set({ rules: rules.length ? rules : DEFAULT_RULES, loaded: true, loading: false });
    } catch (e) {
      console.warn("[lead-times] load failed (table not created yet?) — using the defaults", e);
      set({ loaded: true, loading: false });
    }
  },

  saveRules: async (rules) => {
    set({ rules });
    if (!LIVE) return;
    await persistOrReport("Save lead times", async () => {
      const saved = await (await import("../services/dataverse-live")).saveLeadTimeRules(rules);
      // Only adopt the saved ids if nobody edited the list again meanwhile.
      if (get().rules === rules) set({ rules: saved });
    });
  },
}));
