import { create } from "zustand";
import {
  getCardPresetDataSource,
  type PresetKind,
  type SavedCardPreset,
} from "../services/custom-card-data";

/**
 * Saved custom-card presets, per board family (production / installation). The
 * Add Job → Custom Card panel loads the current kind's presets and can save new
 * ones or delete them. Writes are optimistic (local first, persist in the
 * background) and resync on failure — same pattern as the job-queue store.
 */
interface CardPresetsState {
  byKind: Record<PresetKind, SavedCardPreset[]>;
  loaded: Record<PresetKind, boolean>;
  loading: Record<PresetKind, boolean>;

  load: (kind: PresetKind, force?: boolean) => Promise<void>;
  save: (preset: SavedCardPreset) => Promise<void>;
  remove: (id: string, kind: PresetKind) => Promise<void>;
}

const ds = getCardPresetDataSource();

export const useCardPresetsStore = create<CardPresetsState>((set, get) => ({
  byKind: { production: [], installation: [] },
  loaded: { production: false, installation: false },
  loading: { production: false, installation: false },

  load: async (kind, force = false) => {
    if (get().loading[kind]) return;
    if (get().loaded[kind] && !force) return;
    set((s) => ({ loading: { ...s.loading, [kind]: true } }));
    try {
      const presets = await ds.loadPresets(kind);
      set((s) => ({
        byKind: { ...s.byKind, [kind]: presets },
        loaded: { ...s.loaded, [kind]: true },
        loading: { ...s.loading, [kind]: false },
      }));
    } catch (e) {
      console.error("[card-presets] load failed", e);
      set((s) => ({ loading: { ...s.loading, [kind]: false } }));
    }
  },

  save: async (preset) => {
    set((s) => ({
      byKind: { ...s.byKind, [preset.kind]: [...s.byKind[preset.kind], preset] },
    }));
    void ds.createPreset(preset).catch((e) => {
      console.error("[card-presets] save failed — resyncing", e);
      void get().load(preset.kind, true);
    });
  },

  remove: async (id, kind) => {
    set((s) => ({
      byKind: { ...s.byKind, [kind]: s.byKind[kind].filter((p) => p.id !== id) },
    }));
    void ds.deletePreset(id).catch((e) => {
      console.error("[card-presets] remove failed — resyncing", e);
      void get().load(kind, true);
    });
  },
}));
