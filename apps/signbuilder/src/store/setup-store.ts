import { create } from "zustand";
import type { SetupData, SpecReference } from "../domain/types";
import { SetupIndex } from "../engine/setup-index";
import { repo } from "../services/repo";
import { newVersionHeader } from "../setup/version-ops";
import { persistOrReport } from "./write-status-store";

interface SetupState {
  setup: SetupData | null;
  idx: SetupIndex | null;
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  /** Replace the setup (on screen at once; saved in the background). */
  replace: (next: SetupData, label: string) => void;
  /** This session's setup changes, newest last (Undo steps back one). */
  undoStack: { label: string; setup: SetupData }[];
  undo: () => void;
  /** One-time move from Business Central (Setup → Import). Saves a version of
   *  the setup it replaces first (when there is one). */
  importSetup: (next: SetupData, by: string) => Promise<void>;
  /** Puts a saved version back (saving the current setup as a version first). Undo can step back. */
  restoreVersion: (id: string, label: string, by: string, onProgress?: (done: number, total: number) => void) => Promise<void>;
  /** Spec reference images are fetched on demand (they're big). */
  referenceImages: (code: string) => Promise<Pick<SpecReference, "thumbnail" | "fullImage">>;
}

const imageCache = new Map<string, Pick<SpecReference, "thumbnail" | "fullImage">>();
// Undo keeps whole-setup snapshots in memory (they share unchanged arrays).
const UNDO_LIMIT = 50;

export const useSetupStore = create<SetupState>((set, get) => ({
  setup: null,
  idx: null,
  loading: false,
  error: "",

  load: async () => {
    set({ loading: true, error: "" });
    try {
      const setup = await repo().loadSetup();
      set({ setup, idx: new SetupIndex(setup), loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  undoStack: [],

  replace: (next, label) => {
    const prev = get().setup;
    const undoStack = prev ? [...get().undoStack, { label, setup: prev }].slice(-UNDO_LIMIT) : get().undoStack;
    set({ setup: next, idx: new SetupIndex(next), undoStack });
    void persistOrReport(label, () => repo().saveSetup(next));
  },

  undo: () => {
    const stack = get().undoStack;
    const last = stack[stack.length - 1];
    if (!last) return;
    set({ setup: last.setup, idx: new SetupIndex(last.setup), undoStack: stack.slice(0, -1) });
    void persistOrReport(`Undo: ${last.label}`, () => repo().saveSetup(last.setup));
  },

  importSetup: async (next, by) => {
    const prev = get().setup;
    if (prev && prev.signTypes.length > 0) {
      await repo().saveVersion(newVersionHeader(prev, "Before import from Business Central", "Saved automatically before the import replaced the setup.", "auto", by), prev);
    }
    imageCache.clear();
    set({ setup: next, idx: new SetupIndex(next), undoStack: [] });
    await repo().saveSetup(next);
    if (repo().kind === "live") {
      for (const ref of next.references) await repo().saveReference(ref);
    }
  },

  restoreVersion: async (id, label, by, onProgress) => {
    const current = get().setup;
    const restored = await repo().loadVersion(id);
    if (current) {
      await repo().saveVersion(newVersionHeader(current, `Before restoring “${label}”`, "Saved automatically before a version was restored.", "auto", by), current, onProgress);
      // Reference images aren't versioned — keep the ones already loaded.
      const images = new Map(current.references.map((r) => [r.code, r]));
      restored.references = restored.references.map((r) => ({ ...r, thumbnail: images.get(r.code)?.thumbnail, fullImage: images.get(r.code)?.fullImage }));
    }
    get().replace(restored, `Restore version “${label}”`);
  },

  referenceImages: async (code) => {
    const cached = imageCache.get(code);
    if (cached) return cached;
    const inSetup = get().setup?.references.find((r) => r.code === code);
    if (inSetup?.fullImage || inSetup?.thumbnail) return { thumbnail: inSetup.thumbnail, fullImage: inSetup.fullImage };
    const images = await repo().loadReferenceImages(code);
    imageCache.set(code, images);
    return images;
  },
}));
