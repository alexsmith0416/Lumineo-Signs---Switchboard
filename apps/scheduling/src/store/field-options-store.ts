import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import type { FieldOptionOverride } from "../components/jobs/field-options";

/**
 * "Edit field…" edits to the Jobs list's built-in columns — names, and for
 * choice columns (Current Status, Priority, Hold, Vendor, …) option lists,
 * colours and Single / Multi Select — SHARED by everyone. Stored in the
 * Jobs views table (crfdf_jobsview) under the key "options:<column key>".
 * Columns nobody has edited use their defaults (components/jobs/field-options.ts).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const KEY = (field: string) => `options:${field}`;

interface FieldOptionsState {
  overrides: Record<string, FieldOptionOverride>;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  save: (field: string, override: FieldOptionOverride) => void;
}

export const useFieldOptionsStore = create<FieldOptionsState>((set, get) => ({
  overrides: {},
  loaded: false,

  load: async (force = false) => {
    if (get().loaded && !force) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    try {
      const rows = await (await import("../services/dataverse-live")).fetchJobsViewConfig();
      const overrides: Record<string, FieldOptionOverride> = {};
      for (const [k, v] of rows) {
        if (!k.startsWith("options:") || !v || typeof v !== "object") continue;
        const o = v as FieldOptionOverride;
        overrides[k.slice("options:".length)] = {
          ...(Array.isArray(o.opts) ? { opts: o.opts.filter((x) => typeof x === "string") } : {}),
          ...(o.colors && typeof o.colors === "object" ? { colors: o.colors } : {}),
          ...(typeof o.label === "string" && o.label.trim() ? { label: o.label.trim() } : {}),
          ...(typeof o.multi === "boolean" ? { multi: o.multi } : {}),
        };
      }
      set({ overrides, loaded: true });
    } catch (e) {
      console.warn("[field-options] couldn't load (views table not there yet?)", e);
      set({ loaded: true });
    }
  },

  save: (field, override) => {
    set((s) => ({ overrides: { ...s.overrides, [field]: override } }));
    if (!LIVE) return;
    void persistOrReport("Edit field options", async () =>
      (await import("../services/dataverse-live")).saveJobsViewConfig(KEY(field), override),
    );
  },
}));
