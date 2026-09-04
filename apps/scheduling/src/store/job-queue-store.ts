import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  getQueueDataSource,
  newId,
  type QueueGroup,
  type QueueItem,
  type QueueKind,
} from "../services/job-queue-data";
import { persistOrReport } from "./write-status-store";

export interface JobQueueState {
  kind: QueueKind;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  groups: QueueGroup[];

  load: (force?: boolean) => Promise<void>;
  addGroup: (input: { name: string; color: string; textColor: string }) => void;
  updateGroup: (id: string, changes: Partial<Pick<QueueGroup, "name" | "color" | "textColor" | "collapsed">>) => void;
  deleteGroup: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  reorderGroups: (orderedIds: string[]) => void;

  /** Add a fully-built item (id/groupId/sortOrder already set). */
  addItem: (item: QueueItem) => void;
  updateItem: (id: string, changes: Partial<QueueItem>) => void;
  removeItem: (id: string) => void;
  /** Move an item to a group at a target index (reorder within or across groups). */
  moveItem: (itemId: string, toGroupId: string, toIndex: number) => void;
}

const ds = getQueueDataSource();

/** Renumber every item's sortOrder within each group to match array order. */
function renumber(groups: QueueGroup[]): QueueGroup[] {
  return groups.map((g) => ({
    ...g,
    items: g.items.map((it, i) => (it.sortOrder === i ? it : { ...it, sortOrder: i })),
  }));
}

export type UseJobQueueStore = UseBoundStore<StoreApi<JobQueueState>>;

export function createJobQueueStore(kind: QueueKind): UseJobQueueStore {
  return create<JobQueueState>((set, get) => ({
    kind,
    loading: false,
    loaded: false,
    error: null,
    groups: [],

    load: async (force = false) => {
      if (get().loading) return;
      if (get().loaded && !force) return;
      set({ loading: true, error: null });
      try {
        const groups = await ds.loadGroups(kind);
        set({ groups, loading: false, loaded: true });
      } catch (err) {
        set({ loading: false, error: err instanceof Error ? err.message : String(err) });
      }
    },

    addGroup: ({ name, color, textColor }) => {
      const group: QueueGroup = {
        id: newId(),
        kind,
        name: name.trim() || "New group",
        color,
        textColor,
        collapsed: false,
        sortOrder: get().groups.length,
        items: [],
      };
      set({ groups: [...get().groups, group] });
      void persistOrReport("Add queue group", () => ds.createGroup(group));
    },

    updateGroup: (id, changes) => {
      set({ groups: get().groups.map((g) => (g.id === id ? { ...g, ...changes } : g)) });
      void persistOrReport("Edit queue group", () => ds.updateGroup(id, changes));
    },

    deleteGroup: (id) => {
      const group = get().groups.find((g) => g.id === id);
      const itemIds = group?.items.map((i) => i.id) ?? [];
      set({ groups: get().groups.filter((g) => g.id !== id) });
      void persistOrReport("Delete queue group", () => ds.deleteGroup(id, itemIds));
    },

    toggleCollapsed: (id) => {
      const group = get().groups.find((g) => g.id === id);
      if (!group) return;
      get().updateGroup(id, { collapsed: !group.collapsed });
    },

    reorderGroups: (orderedIds) => {
      const byId = new Map(get().groups.map((g) => [g.id, g]));
      const next = orderedIds
        .map((id, i) => {
          const g = byId.get(id);
          return g ? { ...g, sortOrder: i } : null;
        })
        .filter((g): g is QueueGroup => g != null);
      set({ groups: next });
      // Persist only groups whose order actually changed.
      next.forEach((g, i) => {
        if (byId.get(g.id)?.sortOrder !== i) {
          void ds.updateGroup(g.id, { sortOrder: i }).catch((e) =>
            console.error("[queue] reorderGroups persist failed", e),
          );
        }
      });
    },

    addItem: (item) => {
      set({
        groups: get().groups.map((g) =>
          g.id === item.groupId ? { ...g, items: [...g.items, item] } : g,
        ),
      });
      void persistOrReport("Add job to queue", () => ds.createItem(item));
    },

    updateItem: (id, changes) => {
      set({
        groups: get().groups.map((g) => ({
          ...g,
          items: g.items.map((it) => (it.id === id ? { ...it, ...changes } : it)),
        })),
      });
      void persistOrReport("Edit queued job", () => ds.updateItem(id, changes));
    },

    removeItem: (id) => {
      set({
        groups: get().groups.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== id) })),
      });
      void persistOrReport("Remove job from queue", () => ds.deleteItem(id));
    },

    moveItem: (itemId, toGroupId, toIndex) => {
      const groups = get().groups.map((g) => ({ ...g, items: [...g.items] }));
      let moving: QueueItem | undefined;
      for (const g of groups) {
        const idx = g.items.findIndex((it) => it.id === itemId);
        if (idx >= 0) {
          moving = g.items.splice(idx, 1)[0];
          break;
        }
      }
      if (!moving) return;
      const target = groups.find((g) => g.id === toGroupId);
      if (!target) return;
      const clamped = Math.max(0, Math.min(toIndex, target.items.length));
      moving = { ...moving, groupId: toGroupId };
      target.items.splice(clamped, 0, moving);

      const before = new Map<string, QueueItem>();
      for (const g of get().groups) for (const it of g.items) before.set(it.id, it);
      const next = renumber(groups);
      set({ groups: next });
      // Persist every item whose groupId or sortOrder changed.
      for (const g of next) {
        for (const it of g.items) {
          const prev = before.get(it.id);
          if (!prev || prev.groupId !== it.groupId || prev.sortOrder !== it.sortOrder) {
            void ds
              .updateItem(it.id, { groupId: it.groupId, sortOrder: it.sortOrder })
              .catch((e) => console.error("[queue] moveItem persist failed", e));
          }
        }
      }
    },
  }));
}

export const useProductionQueueStore = createJobQueueStore("production");
export const useInstallQueueStoreWK = createJobQueueStore("install-wk");
export const useInstallQueueStoreNEK = createJobQueueStore("install-nek");
/** Shipping's always-on staging kanban (below the week's load columns). Unlike
 *  the calendar queues it isn't week-scoped — it's one master board. */
export const useShippingQueueStore = createJobQueueStore("shipping");
