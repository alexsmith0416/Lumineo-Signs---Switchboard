import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import type { SavedTrip } from "../services/saved-trips";

/**
 * Install Planner — saved trips (crfdf_installtrip). Admin / Ops save them in
 * the planner; installers read them on the Install Trips screen. Optimistic:
 * a failed save keeps the trip on screen and is reported (write-status-store).
 * Dev: in memory.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const dv = () => import("../services/dataverse-live");

interface TripState {
  trips: SavedTrip[];
  loaded: boolean;
  error: string;
  load: (force?: boolean) => Promise<void>;
  save: (t: SavedTrip) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  loaded: false,
  error: "",

  load: async (force = false) => {
    if (get().loaded && !force) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    try {
      set({ trips: await (await dv()).fetchInstallTrips(), loaded: true, error: "" });
    } catch (e) {
      console.warn("[trips] crfdf_installtrip not available yet (table not created?)", e);
      set({ loaded: true, error: e instanceof Error ? e.message : String(e) });
    }
  },

  save: async (t) => {
    const isNew = !get().trips.some((x) => x.id === t.id);
    set((s) => ({ trips: isNew ? [...s.trips, t] : s.trips.map((x) => (x.id === t.id ? t : x)) }));
    if (!LIVE) return;
    await persistOrReport("Save trip", async () => (await dv()).saveInstallTrip(t, isNew));
  },

  remove: async (id) => {
    set((s) => ({ trips: s.trips.filter((x) => x.id !== id) }));
    if (!LIVE) return;
    await persistOrReport("Delete trip", async () => (await dv()).deleteInstallTrip(id));
  },
}));
