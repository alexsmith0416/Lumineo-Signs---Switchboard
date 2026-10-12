import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import type { SavedPlan } from "../services/saved-plans";

/**
 * Install Planner — saved week plans (crfdf_installplan), from the auto-planner,
 * to compare two side by side and keep what was committed. Optimistic:
 * a failed save keeps the trip on screen and is reported (write-status-store).
 * Dev: in memory.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const dv = () => import("../services/dataverse-live");

interface PlanState {
  plans: SavedPlan[];
  loaded: boolean;
  error: string;
  load: (force?: boolean) => Promise<void>;
  save: (p: SavedPlan) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  loaded: false,
  error: "",

  load: async (force = false) => {
    if (get().loaded && !force) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    try {
      set({ plans: await (await dv()).fetchInstallPlans(), loaded: true, error: "" });
    } catch (e) {
      console.warn("[plans] crfdf_installplan not available yet (table not created?)", e);
      set({ loaded: true, error: e instanceof Error ? e.message : String(e) });
    }
  },

  save: async (p) => {
    const isNew = !get().plans.some((x) => x.id === p.id);
    set((s) => ({ plans: isNew ? [...s.plans, p] : s.plans.map((x) => (x.id === p.id ? p : x)) }));
    if (!LIVE) return;
    await persistOrReport("Save week plan", async () => (await dv()).saveInstallPlan(p, isNew));
  },

  remove: async (id) => {
    set((s) => ({ plans: s.plans.filter((x) => x.id !== id) }));
    if (!LIVE) return;
    await persistOrReport("Delete week plan", async () => (await dv()).deleteInstallPlan(id));
  },
}));
