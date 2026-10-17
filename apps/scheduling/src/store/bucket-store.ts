import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { QueueKind } from "../services/job-queue-data";
import type { JobRow } from "../services/job-tracking";
import {
  dropOffs,
  filterSync,
  insertIndex,
  newBucketId,
  orderItems,
  type BucketItem,
  type BucketList,
} from "../services/buckets";
import { persistOrReport } from "./write-status-store";

/**
 * One board's Bucket Lists (services/buckets.ts) — the Job Queue's "Bucket
 * Lists" tab and the default-bucket cards on the board. Optimistic writes, like
 * the Job Queue store; failures show in the save status.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
type Dv = typeof import("../services/dataverse-live");
let dvModule: Promise<Dv> | null = null;
const dv = (): Promise<Dv> => (dvModule ??= import("../services/dataverse-live"));

export type NewJob = Pick<BucketItem, "jobNo" | "customerName" | "task" | "estimatedHours" | "releasedDate">;

export interface BucketState {
  kind: QueueKind;
  loaded: boolean;
  lists: BucketList[];
  items: BucketItem[];
  load: (force?: boolean) => Promise<void>;
  /** A list's jobs in its own order. */
  itemsOf: (bucketId: string) => BucketItem[];
  addList: (vals: Omit<BucketList, "id" | "kind" | "sortOrder" | "collapsed">) => string;
  updateList: (id: string, changes: Partial<Omit<BucketList, "id" | "kind">>) => void;
  deleteList: (id: string) => void;
  addJob: (bucketId: string, job: NewJob, source?: BucketItem["source"]) => void;
  removeItem: (id: string) => void;
  /** Drag within a list: the list keeps this hand order from now on. */
  moveItem: (itemId: string, toIndex: number) => void;
  /** Back to oldest-released-first. */
  resetOrder: (bucketId: string) => void;
  /** Re-run filter lists against the Jobs list rows. */
  syncFilters: (rows: readonly JobRow[], completedSteps: (jobNo: string) => ReadonlySet<string>) => void;
  /** Drop jobs whose step for their bucket's department is complete. */
  applyDropOffs: (completedSteps: (jobNo: string) => ReadonlySet<string>) => void;
}

export type UseBucketStore = UseBoundStore<StoreApi<BucketState>>;

function createBucketStore(kind: QueueKind): UseBucketStore {
  return create<BucketState>((set, get) => {
    const write = (what: string, fn: (m: Dv) => Promise<unknown>) => {
      if (!LIVE) return;
      void persistOrReport(what, async () => fn(await dv()));
    };
    const removeItems = (gone: readonly BucketItem[], what: string) => {
      if (!gone.length) return;
      const ids = new Set(gone.map((g) => g.id));
      set((s) => ({ items: s.items.filter((i) => !ids.has(i.id)) }));
      for (const g of gone) write(what, (m) => m.deleteBucketItem(g.id));
    };
    return {
      kind,
      loaded: false,
      lists: [],
      items: [],

      load: async (force = false) => {
        if (get().loaded && !force) return;
        if (!LIVE) {
          set({ loaded: true });
          return;
        }
        try {
          const { lists, items } = await (await dv()).fetchBuckets(kind);
          set({ lists, items, loaded: true });
        } catch (e) {
          console.warn("[buckets] couldn't load (tables not created yet?)", e);
          set({ loaded: true });
        }
      },

      itemsOf: (bucketId) => orderItems(get().items.filter((i) => i.bucketId === bucketId)),

      addList: (vals) => {
        const list: BucketList = { ...vals, id: newBucketId(), kind, sortOrder: get().lists.length, collapsed: false };
        set((s) => ({ lists: [...s.lists, list] }));
        write("Add a bucket list", (m) => m.createBucketList(list));
        return list.id;
      },

      updateList: (id, changes) => {
        set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, ...changes } : l)) }));
        write("Change a bucket list", (m) => m.updateBucketList(id, changes));
      },

      deleteList: (id) => {
        const itemIds = get().items.filter((i) => i.bucketId === id).map((i) => i.id);
        set((s) => ({ lists: s.lists.filter((l) => l.id !== id), items: s.items.filter((i) => i.bucketId !== id) }));
        write("Delete a bucket list", (m) => m.deleteBucketList(id, itemIds));
      },

      addJob: (bucketId, job, source = "manual") => {
        const current = get().itemsOf(bucketId);
        if (current.some((i) => i.jobNo === job.jobNo)) return; // already on it
        const handOrdered = current.some((i) => i.pinned);
        const at = handOrdered ? insertIndex(current, job.releasedDate) : current.length;
        const item: BucketItem = { ...job, id: newBucketId(), bucketId, sortOrder: at, pinned: false, source };
        // In a hand-ordered list the jobs after it move down one.
        const shifted = handOrdered ? current.slice(at).map((i) => ({ ...i, sortOrder: i.sortOrder + 1 })) : [];
        const byId = new Map(shifted.map((i) => [i.id, i]));
        set((s) => ({ items: [...s.items.map((i) => byId.get(i.id) ?? i), item] }));
        write("Add a job to a bucket", (m) => m.createBucketItem(item));
        for (const i of shifted) write("Reorder a bucket", (m) => m.updateBucketItem(i.id, { sortOrder: i.sortOrder }));
      },

      removeItem: (id) => {
        const it = get().items.find((i) => i.id === id);
        if (it) removeItems([it], "Remove a job from a bucket");
      },

      moveItem: (itemId, toIndex) => {
        const it = get().items.find((i) => i.id === itemId);
        if (!it) return;
        const ordered = get().itemsOf(it.bucketId).filter((i) => i.id !== itemId);
        ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, it);
        const next = ordered.map((i, n) => ({ ...i, sortOrder: n, pinned: true }));
        const before = new Map(get().items.map((i) => [i.id, i]));
        const byId = new Map(next.map((i) => [i.id, i]));
        set((s) => ({ items: s.items.map((i) => byId.get(i.id) ?? i) }));
        for (const i of next) {
          const b = before.get(i.id);
          if (b && b.sortOrder === i.sortOrder && b.pinned) continue;
          write("Reorder a bucket", (m) => m.updateBucketItem(i.id, { sortOrder: i.sortOrder, pinned: true }));
        }
      },

      resetOrder: (bucketId) => {
        const pinned = get().items.filter((i) => i.bucketId === bucketId && i.pinned);
        set((s) => ({ items: s.items.map((i) => (i.bucketId === bucketId ? { ...i, pinned: false } : i)) }));
        for (const i of pinned) write("Reorder a bucket", (m) => m.updateBucketItem(i.id, { pinned: false }));
      },

      syncFilters: (rows, completedSteps) => {
        for (const list of get().lists) {
          if (list.mode !== "filter") continue;
          const items = get().items.filter((i) => i.bucketId === list.id);
          const done = (jobNo: string) => !!list.deptKey && completedSteps(jobNo).has(list.deptKey);
          const { add, remove } = filterSync(list, items, rows, done);
          removeItems(remove, "Update a filtered bucket");
          for (const r of add) {
            get().addJob(
              list.id,
              { jobNo: r.jobNo, customerName: r.name || r.job, task: r.description || "", estimatedHours: 0, releasedDate: r.releaseDate || "" },
              "filter",
            );
          }
        }
      },

      applyDropOffs: (completedSteps) => {
        const gone: BucketItem[] = [];
        for (const list of get().lists) {
          gone.push(...dropOffs(list, get().items.filter((i) => i.bucketId === list.id), completedSteps));
        }
        removeItems(gone, "Drop a finished job from a bucket");
      },
    };
  });
}

const stores = new Map<QueueKind, UseBucketStore>();
/** The bucket store for a board (one per board kind). */
export function bucketStoreFor(kind: QueueKind): UseBucketStore {
  let s = stores.get(kind);
  if (!s) stores.set(kind, (s = createBucketStore(kind)));
  return s;
}
