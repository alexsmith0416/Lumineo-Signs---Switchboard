import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import { newFieldKey, type CustomFieldDef } from "../services/custom-fields";

/**
 * The Jobs list's custom fields (crfdf_jobfield) — shared by everyone; editors
 * (Admin / Ops / Developer) add, edit and delete them. Values live on each
 * job's tracking row (job-tracking-store `setCustomValue`). Saves are
 * optimistic: a failed save keeps the change on screen and reports it.
 * Dev keeps them in memory for the session.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

interface CustomFieldState {
  defs: CustomFieldDef[];
  loaded: boolean;
  loading: boolean;
  /** Set when the table isn't there yet (scripts/create-customfield-schema.ps1). */
  missing: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Add fields at the end; returns their keys. */
  addFields: (fields: Array<Omit<CustomFieldDef, "key">>) => string[];
  updateField: (key: string, patch: Partial<Omit<CustomFieldDef, "key" | "type">>) => void;
  deleteField: (key: string) => void;
}

const dv = () => import("../services/dataverse-live");

export const useCustomFieldStore = create<CustomFieldState>((set, get) => ({
  defs: [],
  loaded: false,
  loading: false,
  missing: false,

  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    if (!LIVE) {
      set({ loaded: true, loading: false });
      return;
    }
    try {
      set({ defs: await (await dv()).fetchCustomFieldDefs(), loaded: true, loading: false, missing: false });
    } catch (e) {
      console.warn("[custom-fields] load failed (table not created yet?)", e);
      set({ loaded: true, loading: false, missing: true });
    }
  },

  addFields: (fields) => {
    const start = get().defs.length;
    const added = fields.map((f) => ({ ...f, key: newFieldKey() }));
    set((s) => ({ defs: [...s.defs, ...added] }));
    if (LIVE) {
      void persistOrReport("Add custom field", async () => {
        const m = await dv();
        for (const [i, d] of added.entries()) await m.saveCustomFieldDef(d, start + i);
      });
    }
    return added.map((d) => d.key);
  },

  updateField: (key, patch) => {
    set((s) => ({ defs: s.defs.map((d) => (d.key === key ? { ...d, ...patch } : d)) }));
    const i = get().defs.findIndex((d) => d.key === key);
    const def = get().defs[i];
    if (!LIVE || !def) return;
    void persistOrReport("Edit custom field", async () => (await dv()).saveCustomFieldDef(def, i));
  },

  deleteField: (key) => {
    set((s) => ({ defs: s.defs.filter((d) => d.key !== key) }));
    if (!LIVE) return;
    void persistOrReport("Delete custom field", async () => (await dv()).deleteCustomFieldDef(key));
  },
}));
