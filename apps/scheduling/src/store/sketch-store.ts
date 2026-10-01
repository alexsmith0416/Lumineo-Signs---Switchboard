import { create } from "zustand";

/**
 * Job sketches for the Jobs list's Sketch column (crfdf_jobsketch, filled by
 * the BCSync_JobSketches flow). The file link + name of every job load with the
 * list; the thumbnails (a few KB each) load only for rows that come on screen,
 * a batch at a time. Live only — dev shows no sketches.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export interface JobSketch {
  fileUrl: string;
  fileName: string;
}

interface SketchState {
  byJob: Map<string, JobSketch>;
  /** jobNo → thumbnail data: URL ("" = none could be made). */
  thumbs: Map<string, string>;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Ask for a job's thumbnail; batched with the other rows on screen. */
  wantThumb: (jobNo: string) => void;
}

const pending = new Set<string>();
const requested = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const BATCH = 15;

async function flush() {
  timer = null;
  const jobs = [...pending];
  pending.clear();
  const m = await import("../services/dataverse-live");
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    try {
      const got = await m.fetchSketchThumbnails(batch);
      useSketchStore.setState((s) => {
        const thumbs = new Map(s.thumbs);
        for (const j of batch) thumbs.set(j, got.get(j) ?? "");
        return { thumbs };
      });
    } catch (e) {
      console.warn("[sketches] thumbnail load failed", e);
      for (const j of batch) requested.delete(j); // let a later scroll retry
    }
  }
}

export const useSketchStore = create<SketchState>((set, get) => ({
  byJob: new Map(),
  thumbs: new Map(),
  loaded: false,

  load: async (force = false) => {
    if (!LIVE || (get().loaded && !force)) return;
    try {
      const byJob = await (await import("../services/dataverse-live")).fetchJobSketches();
      if (force) {
        requested.clear();
        set({ byJob, thumbs: new Map(), loaded: true });
      } else set({ byJob, loaded: true });
    } catch (e) {
      console.warn("[sketches] not available (table not created yet?)", e);
      set({ loaded: true });
    }
  },

  wantThumb: (jobNo) => {
    if (!LIVE || requested.has(jobNo) || !get().byJob.has(jobNo)) return;
    requested.add(jobNo);
    pending.add(jobNo);
    if (!timer) timer = setTimeout(() => void flush(), 60);
  },
}));
