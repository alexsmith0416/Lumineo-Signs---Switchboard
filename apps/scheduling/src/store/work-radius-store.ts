import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import {
  EMPTY_WORK_RADIUS,
  parseWorkRadius,
  type RadiusFlag,
  type RadiusMode,
  type WorkRadiusConfig,
} from "../services/work-radius";

/**
 * Work radius per install location + out-of-radius display (outline / whole
 * card) + per-card hand settings — SHARED (Jobs views config, key
 * "work-radius"; Admin / Ops edit). `flags` are worked out by the
 * Installation board for its cards (services/work-radius.ts) and read by
 * JobCard; `active` = an install board is showing (enables the card menu item).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const KEY = "work-radius";

interface WorkRadiusState {
  config: WorkRadiusConfig;
  loaded: boolean;
  flags: ReadonlyMap<string, RadiusFlag>;
  active: boolean;
  load: () => Promise<void>;
  setRadius: (locationId: string, miles: number | null) => void;
  setMode: (mode: RadiusMode) => void;
  /** A card's hand setting: a location id, "none", or null = automatic. */
  setOverride: (lineId: string, value: string | null) => void;
  setFlags: (flags: ReadonlyMap<string, RadiusFlag>, active: boolean) => void;
}

export const useWorkRadiusStore = create<WorkRadiusState>((set, get) => {
  const persist = (config: WorkRadiusConfig, what: string) => {
    set({ config });
    if (!LIVE) return;
    void persistOrReport(what, async () =>
      (await import("../services/dataverse-live")).saveJobsViewConfig(KEY, config),
    );
  };
  return {
    config: EMPTY_WORK_RADIUS,
    loaded: false,
    flags: new Map(),
    active: false,

    load: async () => {
      if (get().loaded) return;
      if (!LIVE) {
        set({ loaded: true });
        return;
      }
      try {
        const rows = await (await import("../services/dataverse-live")).fetchJobsViewConfig();
        set({ config: parseWorkRadius(rows.get(KEY)), loaded: true });
      } catch (e) {
        console.warn("[work-radius] couldn't load", e);
        set({ loaded: true });
      }
    },

    setRadius: (locationId, miles) => {
      const cur = get().config;
      const radius = { ...cur.radius };
      if (miles && miles > 0) radius[locationId] = miles;
      else delete radius[locationId];
      persist({ ...cur, radius }, "Change a work radius");
    },

    setMode: (mode) => persist({ ...get().config, mode }, "Change the out-of-radius look"),

    setOverride: (lineId, value) => {
      const cur = get().config;
      const overrides = { ...cur.overrides };
      if (value) overrides[lineId] = value;
      else delete overrides[lineId];
      persist({ ...cur, overrides }, "Set a card's work-radius colour");
    },

    setFlags: (flags, active) => set({ flags, active }),
  };
});

export const useRadiusFlag = (lineId: string): RadiusFlag | undefined =>
  useWorkRadiusStore((s) => s.flags.get(lineId));
