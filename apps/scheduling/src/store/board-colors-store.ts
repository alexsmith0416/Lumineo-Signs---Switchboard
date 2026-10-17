import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import {
  EMPTY_BOARD_COLORS,
  parseBoardColors,
  type BoardColors,
  type ColorScheme,
  type ColorScope,
  type NamedScheme,
} from "../services/board-colors";

/**
 * Card + banner colours per production department / install location, and the
 * saved named schemes — SHARED by everyone (one entry in the Jobs views table,
 * key "board-colors"). Edited in the Modify colors panel (Admin / Ops).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const KEY = "board-colors";

interface BoardColorsState {
  colors: BoardColors;
  loaded: boolean;
  load: () => Promise<void>;
  /** Set a department's / location's colours; null = back to the default. */
  setScheme: (scope: ColorScope, id: string, scheme: ColorScheme | null) => void;
  /** Save (or replace, by name) a named scheme. */
  saveNamed: (scheme: NamedScheme) => void;
  deleteNamed: (name: string) => void;
}

export const useBoardColorsStore = create<BoardColorsState>((set, get) => {
  const persist = (colors: BoardColors, what: string) => {
    set({ colors });
    if (!LIVE) return;
    void persistOrReport(what, async () =>
      (await import("../services/dataverse-live")).saveJobsViewConfig(KEY, colors),
    );
  };
  return {
    colors: EMPTY_BOARD_COLORS,
    loaded: false,

    load: async () => {
      if (get().loaded) return;
      if (!LIVE) {
        set({ loaded: true });
        return;
      }
      try {
        const rows = await (await import("../services/dataverse-live")).fetchJobsViewConfig();
        set({ colors: parseBoardColors(rows.get(KEY)), loaded: true });
      } catch (e) {
        console.warn("[board-colors] couldn't load", e);
        set({ loaded: true });
      }
    },

    setScheme: (scope, id, scheme) => {
      const cur = get().colors;
      const forScope = { ...cur[scope] };
      if (scheme) forScope[id] = scheme;
      else delete forScope[id];
      persist({ ...cur, [scope]: forScope }, "Change board colours");
    },

    saveNamed: (scheme) => {
      const cur = get().colors;
      const others = cur.schemes.filter((s) => s.name.toLowerCase() !== scheme.name.trim().toLowerCase());
      persist({ ...cur, schemes: [...others, { ...scheme, name: scheme.name.trim() }] }, "Save a colour scheme");
    },

    deleteNamed: (name) => {
      const cur = get().colors;
      persist({ ...cur, schemes: cur.schemes.filter((s) => s.name !== name) }, "Delete a colour scheme");
    },
  };
});
