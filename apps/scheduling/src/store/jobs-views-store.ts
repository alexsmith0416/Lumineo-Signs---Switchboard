import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import { defaultLayout, sanitizeLayout, type ViewDef, type ViewLayout } from "../components/jobs/jobs-view-layout";
import type { GridPrefs } from "../components/jobs/jobs-grid-state";
import { JOB_FIELDS } from "../components/jobs/jobs-fields";

/**
 * The Jobs list's views, SHARED by everyone (Dataverse crfdf_jobsview): the
 * sections, views and their columns ("layout"), and each view's sorts, filters,
 * groups and collapsed groups ("prefs:<view id>"). A change anyone makes is
 * saved to the view for everybody.
 *
 * A copy is kept in this browser so the list draws at once; the shared copy
 * replaces it when it loads. The first time the shared table is empty, this
 * browser's views are uploaded to start it. Until the table exists
 * (scripts/create-jobsview-table.ps1) views stay on this device, as before.
 *
 * Which view you last had open, and column widths, stay per person.
 *
 * READ-ONLY users (no Jobs edit rights — see `setReadOnly`) never write the
 * shared copy: they can't change the layout at all, and their sorts / filters /
 * groups apply to their own screen for the session only (not even saved on the
 * device), so nobody else's view moves.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const LAYOUT_KEY = "lumineo.jobs.layout.v1";
const PREFS_KEY = (viewId: string) => `lumineo.jobs.view.${viewId}`;
const SAVE_DELAY_MS = 800;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // private window / blocked storage
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* non-critical */
  }
}

/** A view's prefs with every part present (old saves have no `collapsed`). */
export function cleanPrefs(raw: unknown, view?: ViewDef): GridPrefs {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<GridPrefs>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    sorts: arr(p.sorts),
    filters: arr(p.filters),
    groups: raw ? arr(p.groups) : view?.defaultGroup ? [{ field: view.defaultGroup, asc: true }] : [],
    collapsed: arr<string>(p.collapsed).filter((x) => typeof x === "string"),
  };
}

interface JobsViewsState {
  layout: ViewLayout;
  prefsByView: Record<string, GridPrefs>;
  /** Shared views loaded (or known to be unavailable). */
  loaded: boolean;
  /** True when the views are saved for everyone; false = this device only. */
  shared: boolean;
  /** No Jobs edit rights: layout changes are ignored, prefs stay in this session. */
  readOnly: boolean;
  setReadOnly: (readOnly: boolean) => void;
  load: (knownFields: ReadonlySet<string>, force?: boolean) => Promise<void>;
  setLayout: (layout: ViewLayout) => void;
  prefsFor: (view: ViewDef) => GridPrefs;
  setPrefs: (viewId: string, prefs: GridPrefs) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
function saveLater(key: string, value: unknown) {
  const { shared, readOnly } = useJobsViewsStore.getState();
  if (!LIVE || !shared || readOnly) return;
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void persistOrReport("Save Jobs view", async () =>
        (await import("../services/dataverse-live")).saveJobsViewConfig(key, value),
      );
    }, SAVE_DELAY_MS),
  );
}

function localPrefs(layout: ViewLayout): Record<string, GridPrefs> {
  const out: Record<string, GridPrefs> = {};
  for (const v of Object.values(layout.views)) {
    const saved = read<unknown>(PREFS_KEY(v.id));
    if (saved) out[v.id] = cleanPrefs(saved, v);
  }
  return out;
}

// This browser's copy, so the list draws straight away; the shared copy replaces it.
const initialLayout = (() => {
  const saved = read<unknown>(LAYOUT_KEY);
  return saved ? sanitizeLayout(saved, new Set(Object.keys(JOB_FIELDS))) : defaultLayout();
})();

export const useJobsViewsStore = create<JobsViewsState>((set, get) => ({
  layout: initialLayout,
  prefsByView: localPrefs(initialLayout),
  loaded: false,
  shared: false,
  readOnly: false,
  setReadOnly: (readOnly) => set({ readOnly }),

  load: async (knownFields, force = false) => {
    if (get().loaded && !force) return;
    if (!LIVE) {
      set({ loaded: true });
      return;
    }
    let rows: Map<string, unknown>;
    try {
      rows = await (await import("../services/dataverse-live")).fetchJobsViewConfig();
    } catch (e) {
      console.warn("[jobs-views] shared views unavailable (table not created yet?) — keeping them on this device", e);
      set({ loaded: true, shared: false });
      return;
    }
    set({ shared: true });
    const sharedLayout = rows.get("layout");
    if (!sharedLayout) {
      // First time: start the shared views from this browser's.
      const { layout, prefsByView } = get();
      saveLater("layout", layout);
      for (const [id, p] of Object.entries(prefsByView)) saveLater(`prefs:${id}`, p);
      set({ loaded: true });
      return;
    }
    const layout = sanitizeLayout(sharedLayout, knownFields);
    const prefsByView: Record<string, GridPrefs> = {};
    for (const v of Object.values(layout.views)) {
      const p = rows.get(`prefs:${v.id}`);
      if (p) prefsByView[v.id] = cleanPrefs(p, v);
    }
    write(LAYOUT_KEY, layout);
    for (const [id, p] of Object.entries(prefsByView)) write(PREFS_KEY(id), p);
    set({ layout, prefsByView, loaded: true });
  },

  setLayout: (layout) => {
    if (get().readOnly) return;
    set({ layout });
    write(LAYOUT_KEY, layout);
    saveLater("layout", layout);
  },

  prefsFor: (view) => get().prefsByView[view.id] ?? cleanPrefs(null, view),

  setPrefs: (viewId, prefs) => {
    set((s) => ({ prefsByView: { ...s.prefsByView, [viewId]: prefs } }));
    if (get().readOnly) return;
    write(PREFS_KEY(viewId), prefs);
    saveLater(`prefs:${viewId}`, prefs);
  },
}));
