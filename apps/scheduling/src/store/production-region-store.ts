import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import type { Region } from "../services/geo";

/**
 * Which region each PRODUCTION employee works in (Oct 17, 2026) — the
 * Production board's WK / NEK toggle shows one region's people. Everyone is WK
 * unless set to NEK here (Aaron Waters, Olathe). Production employees have no
 * region column in Dataverse, so this is one shared entry in the Jobs views
 * config table (key "production-regions": { employeeId: "NEK" }). Set in the
 * employee's edit panel (right-click a name).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const KEY = "production-regions";

interface ProductionRegionState {
  nek: Record<string, true>;
  loaded: boolean;
  load: () => Promise<void>;
  regionOf: (employeeId: string) => Region;
  setRegion: (employeeId: string, region: Region) => void;
}

export const useProductionRegionStore = create<ProductionRegionState>((set, get) => ({
  nek: {},
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    try {
      const v = (await (await import("../services/dataverse-live")).fetchJobsViewConfig()).get(KEY);
      const nek: Record<string, true> = {};
      if (v && typeof v === "object") {
        for (const [id, r] of Object.entries(v as Record<string, unknown>)) if (r === "NEK") nek[id] = true;
      }
      set({ nek, loaded: true });
    } catch (e) {
      console.warn("[production-regions] couldn't load", e);
      set({ loaded: true });
    }
  },

  regionOf: (employeeId) => (get().nek[employeeId] ? "NEK" : "WK"),

  setRegion: (employeeId, region) => {
    const nek = { ...get().nek };
    if (region === "NEK") nek[employeeId] = true;
    else delete nek[employeeId];
    set({ nek });
    if (!LIVE) return;
    const stored = Object.fromEntries(Object.keys(nek).map((id) => [id, "NEK"]));
    void persistOrReport("Change an employee's region", async () =>
      (await import("../services/dataverse-live")).saveJobsViewConfig(KEY, stored),
    );
  },
}));
