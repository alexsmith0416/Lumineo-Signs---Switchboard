import { create } from "zustand";
import { addDays, startOfWeek } from "date-fns";
import { defaultLoadName, reorderItems, type ItemKind, type ShipmentItem, type ShipmentLoad } from "./types";
import {
  createItemRecord,
  createLoadRecord,
  deleteItemRecord,
  deleteLoadRecord,
  fetchShipmentLoads,
  updateItemRecord,
  updateItemSortRecords,
  updateLoadRecord,
} from "../services/dataverse-live";

// Deployed / forced-live → persist to Dataverse; plain dev/tests → in-memory.
const live = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const err = (where: string) => (e: unknown) => console.error(`[ship] ${where}`, e);

const uid = (_p: string) => crypto.randomUUID();

/** Persist a load's header (called after any local change that may rename it). */
function persistHeader(load: ShipmentLoad) {
  if (!live) return;
  updateLoadRecord(load.id, {
    name: load.name,
    autoName: load.autoName,
    shipDate: load.shipDate,
    status: load.status,
    generalNotes: load.generalNotes,
  }).catch(err("updateLoad"));
}

/** Refresh an auto-named load's name from its current date + items. */
function withAutoName(load: ShipmentLoad): ShipmentLoad {
  return load.autoName
    ? { ...load, name: defaultLoadName(load.shipDate, load.items) }
    : load;
}

/** Build an auto-named load (name derived from date + items). */
function autoLoad(load: Omit<ShipmentLoad, "name">): ShipmentLoad {
  return { ...load, name: defaultLoadName(load.shipDate, load.items), autoName: true };
}

function newItem(partial: Partial<ShipmentItem> = {}): ShipmentItem {
  return {
    id: uid("I"),
    jobNo: null,
    customerName: "",
    description: "",
    notes: "",
    location: "",
    kind: "delivery",
    loaded: false,
    ...partial,
  };
}

// Sample loads seeded onto the current week so the board isn't empty in dev.
function seed(weekStart: Date): ShipmentLoad[] {
  return [
    autoLoad({
      id: uid("L"),
      shipDate: addDays(weekStart, 1),
      status: "loaded",
      autoName: true,
      generalNotes: "",
      items: [
        newItem({ jobNo: "J35236", customerName: "Dream First - Lakin", description: "(1) 4x4 Plex Face & (3) 6\" x 30\" Aluminum signs", location: "Dodge City", notes: "Drop trailer and swap w/ other trailer with Dream First Bank sign to bring back to shop for refurbishing" }),
        newItem({ jobNo: "J35332", customerName: "Dream First - Garden City", description: "(1) 2'-9\" x 12'-0\" Poly Face", location: "Garden City" }),
        newItem({ jobNo: "J35620", customerName: "Murphy Tractor", description: "(1) Green Plex Backer", location: "Dodge City" }),
        newItem({ jobNo: null, customerName: "Transformers", description: "(2) Transformers", location: "Dodge City", kind: "delivery" }),
      ],
    }),
    autoLoad({
      id: uid("L"),
      shipDate: addDays(weekStart, 3),
      status: "planned",
      autoName: true,
      generalNotes: "",
      items: [
        newItem({ jobNo: "J36532", customerName: "Ballard Center", description: "(1) Wall Pan w/ FCOs", location: "Lawrence" }),
        newItem({ jobNo: "J25219", customerName: "Central National Bank", description: "(1) Wall Sign", location: "Olathe", kind: "pickup" }),
        newItem({ jobNo: null, customerName: "NKC Health", description: "Pick up extrusion kits", location: "Olathe", kind: "pickup" }),
      ],
    }),
  ];
}

interface LoadsState {
  weekStart: Date;
  loads: ShipmentLoad[];
  hydrate: () => Promise<void>;
  setWeekStart: (d: Date) => void;
  addLoad: (shipDate: Date) => string;
  updateLoad: (id: string, patch: Partial<Omit<ShipmentLoad, "id" | "items">>) => void;
  deleteLoad: (id: string) => void;
  addItem: (loadId: string, partial?: Partial<ShipmentItem>) => string;
  updateItem: (loadId: string, itemId: string, patch: Partial<ShipmentItem>) => void;
  /** Move an item to another position in the load (drag or keyboard). */
  moveItem: (loadId: string, from: number, to: number) => void;
  removeItem: (loadId: string, itemId: string) => void;
}

const initialWeek = startOfWeek(new Date(), { weekStartsOn: 1 });

export const useLoadsStore = create<LoadsState>((set, get) => ({
  weekStart: initialWeek,
  // Live starts empty and fills from Dataverse via hydrate(); dev seeds samples.
  loads: live ? [] : seed(initialWeek),

  hydrate: async () => {
    if (!live) return;
    try {
      set({ loads: await fetchShipmentLoads() });
    } catch (e) {
      err("hydrate")(e);
    }
  },

  setWeekStart: (d) => set({ weekStart: startOfWeek(d, { weekStartsOn: 1 }) }),

  addLoad: (shipDate) => {
    const load = autoLoad({ id: uid("L"), shipDate, status: "planned", autoName: true, generalNotes: "", items: [] });
    set((s) => ({ loads: [...s.loads, load] }));
    if (live) createLoadRecord(load).catch(err("createLoad"));
    return load.id;
  },

  updateLoad: (id, patch) => {
    let updated: ShipmentLoad | undefined;
    set((s) => ({
      loads: s.loads.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        // A name edit turns off auto-naming (re-enabled if cleared); a date
        // change re-derives the name while still in auto mode.
        if ("name" in patch) next.autoName = (patch.name ?? "").trim() === "";
        updated = withAutoName(next);
        return updated;
      }),
    }));
    if (updated) persistHeader(updated);
  },

  deleteLoad: (id) => {
    const load = get().loads.find((l) => l.id === id);
    set((s) => ({ loads: s.loads.filter((l) => l.id !== id) }));
    if (live && load) {
      // Delete items first (the lookup doesn't cascade-delete), then the load.
      Promise.all(load.items.map((it) => deleteItemRecord(it.id)))
        .then(() => deleteLoadRecord(id))
        .catch(err("deleteLoad"));
    }
  },

  addItem: (loadId, partial) => {
    const item = newItem(partial);
    let load: ShipmentLoad | undefined;
    set((s) => ({
      loads: s.loads.map((l) =>
        l.id === loadId ? (load = withAutoName({ ...l, items: [...l.items, item] })) : l,
      ),
    }));
    if (live && load) {
      createItemRecord(loadId, item, load.items.length - 1).catch(err("createItem"));
      persistHeader(load);
    }
    return item.id;
  },

  updateItem: (loadId, itemId, patch) => {
    let load: ShipmentLoad | undefined;
    set((s) => ({
      loads: s.loads.map((l) =>
        l.id === loadId
          ? (load = withAutoName({
              ...l,
              items: l.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
            }))
          : l,
      ),
    }));
    if (live && load) {
      updateItemRecord(itemId, patch).catch(err("updateItem"));
      persistHeader(load);
    }
  },

  moveItem: (loadId, from, to) => {
    const before = get().loads.find((l) => l.id === loadId)?.items ?? [];
    const after = reorderItems(before, from, to);
    if (after === before) return; // out-of-range / no-op move

    let load: ShipmentLoad | undefined;
    set((s) => ({
      loads: s.loads.map((l) => (l.id === loadId ? (load = withAutoName({ ...l, items: after })) : l)),
    }));

    if (live && load) {
      // Only the rows that actually shifted need a new sort order.
      const moved = after
        .map((it, i) => ({ id: it.id, sort: i }))
        .filter((e, i) => before[i]?.id !== e.id);
      if (moved.length) updateItemSortRecords(moved).catch(err("moveItem"));
      // An auto-named load names itself from its stops in order, so a reorder
      // can rename it ("Dodge City & Garden City" → "Garden City & Dodge City").
      persistHeader(load);
    }
  },

  removeItem: (loadId, itemId) => {
    let load: ShipmentLoad | undefined;
    set((s) => ({
      loads: s.loads.map((l) =>
        l.id === loadId
          ? (load = withAutoName({ ...l, items: l.items.filter((it) => it.id !== itemId) }))
          : l,
      ),
    }));
    if (live && load) {
      deleteItemRecord(itemId).catch(err("removeItem"));
      persistHeader(load);
    }
  },
}));

export type ItemKindOption = ItemKind;
