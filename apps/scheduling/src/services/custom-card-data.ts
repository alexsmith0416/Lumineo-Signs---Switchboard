import { CUSTOM_CARD_PRESETS, type CustomCardPreset } from "../data/custom-card-presets";

/**
 * Saved custom-card presets — the reusable "block out time" cards (PTO, Holiday,
 * Truck Maintenance, …) a user builds once on Add Job → Custom Card and saves so
 * they're one click next time.
 *
 * Scoped by `kind` ("production" / "installation") so each board family keeps
 * its own saved list; the hardcoded built-in presets (CUSTOM_CARD_PRESETS) show
 * on both. A SavedCardPreset is a superset of CustomCardPreset (adds id + kind +
 * sortOrder) so the same applyPreset() path handles either.
 */
export type PresetKind = "production" | "installation";

export interface SavedCardPreset {
  id: string;
  kind: PresetKind;
  label: string;
  bgColor: string;
  textColor: string;
  defaultHours: number;
  lockByDefault: boolean;
  applyAllByDefault: boolean;
  sortOrder: number;
}

export interface CardPresetDataSource {
  loadPresets(kind: PresetKind): Promise<SavedCardPreset[]>;
  createPreset(preset: SavedCardPreset): Promise<void>;
  updatePreset(id: string, changes: Partial<SavedCardPreset>): Promise<void>;
  deletePreset(id: string): Promise<void>;
}

export const newPresetId = (): string => crypto.randomUUID();

/** Map any ScheduleKind to the two preset buckets (shipping shares install). */
export const presetKindFor = (kind: string): PresetKind =>
  kind === "production" ? "production" : "installation";

/** Adapt either a built-in or a saved preset to the shape applyPreset() reads. */
export const toApplyShape = (p: SavedCardPreset | CustomCardPreset): CustomCardPreset => ({
  id: String(p.id),
  label: p.label,
  bgColor: p.bgColor,
  textColor: p.textColor,
  defaultHours: p.defaultHours,
  lockByDefault: p.lockByDefault,
  applyAllByDefault: p.applyAllByDefault,
});

/** Built-in presets shown on every board (not editable / deletable). */
export const builtInPresets = (): CustomCardPreset[] => CUSTOM_CARD_PRESETS;

// --- Live source (Dataverse) -------------------------------------------------
const liveCardPresetDataSource: CardPresetDataSource = {
  async loadPresets(kind) {
    const m = await import("./dataverse-live");
    return m.fetchCardPresets(kind);
  },
  async createPreset(preset) {
    const m = await import("./dataverse-live");
    await m.createCardPreset(preset);
  },
  async updatePreset(id, changes) {
    const m = await import("./dataverse-live");
    await m.updateCardPreset(id, changes);
  },
  async deletePreset(id) {
    const m = await import("./dataverse-live");
    await m.deleteCardPreset(id);
  },
};

// --- Mock source (dev / tests) — in-memory, persists for the session ---------
function createMockCardPresetDataSource(): CardPresetDataSource {
  const byKind = new Map<PresetKind, SavedCardPreset[]>();
  const get = (kind: PresetKind): SavedCardPreset[] => {
    if (!byKind.has(kind)) byKind.set(kind, []);
    return byKind.get(kind)!;
  };
  const findKind = (id: string): PresetKind | undefined => {
    for (const [k, ps] of byKind) if (ps.some((p) => p.id === id)) return k;
    return undefined;
  };
  return {
    async loadPresets(kind) {
      return get(kind).map((p) => ({ ...p }));
    },
    async createPreset(preset) {
      get(preset.kind).push({ ...preset });
    },
    async updatePreset(id, changes) {
      const k = findKind(id);
      if (!k) return;
      const ps = get(k);
      const idx = ps.findIndex((p) => p.id === id);
      if (idx >= 0) ps[idx] = { ...ps[idx]!, ...changes };
    },
    async deletePreset(id) {
      const k = findKind(id);
      if (!k) return;
      byKind.set(k, get(k).filter((p) => p.id !== id));
    },
  };
}

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
let _mock: CardPresetDataSource | null = null;

export function getCardPresetDataSource(): CardPresetDataSource {
  if (LIVE) return liveCardPresetDataSource;
  if (!_mock) _mock = createMockCardPresetDataSource();
  return _mock;
}
