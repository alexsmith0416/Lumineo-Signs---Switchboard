import type { ScheduleLine } from "../engine/types";

/**
 * Job Queue — a per-board holding area of named groups, each containing jobs
 * parked ("to be scheduled") that can be dragged onto the calendar and back.
 *
 * Groups are scoped by `kind` so Production, WK Install, and NEK Install each
 * keep their own queue. A queue item mirrors the schedulable fields of a
 * ScheduleLine minus its placement (employee/date), so dropping onto the board
 * creates a line and dropping a card back into a group stores it — a clean
 * round-trip.
 *
 * The Shipping board's staging kanban reuses this same model (kind "shipping"),
 * so it needs no table of its own. A staged card is a project waiting for a
 * truck: job no + customer + description only. Its stop location,
 * delivery/pickup kind, and loading notes are load-time decisions made in the
 * load editor once it's dropped onto a load — so nothing is smuggled into the
 * scheduling-shaped fields (hours/department/crew stay 0/empty).
 */
export type QueueKind = "production" | "install-wk" | "install-nek" | "shipping";

export interface QueueItem {
  id: string;
  groupId: string;
  jobNo: string;
  customerName: string;
  jobDescription: string;
  planningLineDescription: string;
  estimatedHours: number;
  /** Department (production) or location (install) id this job belongs to. */
  departmentId: string;
  crewPersons: number | null;
  crewTrucks: number | null;
  crewTrips: number | null;
  installZip: string | null;
  invoiceAmount: number | null;
  isCustom: boolean;
  customColor: string | null;
  customTextColor: string | null;
  sortOrder: number;
}

export interface QueueGroup {
  id: string;
  kind: QueueKind;
  name: string;
  /** Header background color. */
  color: string;
  /** Header text color. */
  textColor: string;
  collapsed: boolean;
  sortOrder: number;
  items: QueueItem[];
}

export interface QueueDataSource {
  loadGroups(kind: QueueKind): Promise<QueueGroup[]>;
  createGroup(group: QueueGroup): Promise<void>;
  updateGroup(id: string, changes: Partial<QueueGroup>): Promise<void>;
  deleteGroup(id: string, itemIds: string[]): Promise<void>;
  createItem(item: QueueItem): Promise<void>;
  updateItem(id: string, changes: Partial<QueueItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
}

export const newId = (): string => crypto.randomUUID();

/** Build a queue item from a scheduled line (dragging a card off the board). */
export function queueItemFromLine(
  line: ScheduleLine,
  groupId: string,
  sortOrder: number,
): QueueItem {
  return {
    id: newId(),
    groupId,
    jobNo: line.jobNo,
    customerName: line.customerName,
    jobDescription: line.jobDescription ?? "",
    planningLineDescription: line.planningLineDescription ?? "",
    estimatedHours: line.overrideHours ?? line.estimatedHours,
    departmentId: line.departmentId,
    crewPersons: line.crewPersons ?? null,
    crewTrucks: line.crewTrucks ?? null,
    crewTrips: line.crewTrips ?? null,
    installZip: line.installZip ?? null,
    invoiceAmount: line.invoiceAmount ?? null,
    isCustom: !!line.isCustom,
    customColor: line.customColor ?? null,
    customTextColor: line.customTextColor ?? null,
    sortOrder,
  };
}

/**
 * Base schedule line from a queue item (dropping a queue card onto a cell). The
 * caller sets `employeeId`, `startDateTime`, and recomputes `endDateTime` via
 * the engine before adding it to the store.
 */
export function lineFromQueueItem(
  item: QueueItem,
  employeeId: string,
  departmentId: string,
  start: Date,
): ScheduleLine {
  return {
    id: `line-${item.jobNo || "job"}-${newId().slice(0, 8)}`,
    jobNo: item.jobNo,
    customerName: item.customerName,
    jobDescription: item.jobDescription || undefined,
    planningLineDescription: item.planningLineDescription,
    startDateTime: start,
    endDateTime: start,
    estimatedHours: item.estimatedHours,
    overrideHours: null,
    employeeId,
    departmentId,
    customerDueDate: null,
    isLocked: false,
    jobSequence: 0,
    preferredStart: start,
    crewPersons: item.crewPersons,
    crewTrucks: item.crewTrucks,
    crewTrips: item.crewTrips,
    installZip: item.installZip,
    invoiceAmount: item.invoiceAmount,
    isCustom: item.isCustom || undefined,
    customColor: item.customColor,
    customTextColor: item.customTextColor,
  };
}

// --- Default groups seeded into a brand-new (empty) board queue --------------
// Colors mirror the mockup: an amber "Needs Scheduled" band and a blue "Ready
// to Schedule" band, plus a neutral catch-all.
export const DEFAULT_GROUP_TEMPLATES: Array<Pick<QueueGroup, "name" | "color" | "textColor">> = [
  { name: "Needs Scheduled", color: "#F6A623", textColor: "#5B3A00" },
  { name: "Ready to Schedule", color: "#4A90D9", textColor: "#08243F" },
];

/** Shipping staging starts with destination-shaped lists instead. */
export const SHIPPING_GROUP_TEMPLATES: Array<Pick<QueueGroup, "name" | "color" | "textColor">> = [
  { name: "Ready to Ship", color: "#2E9B6B", textColor: "#06301F" },
  { name: "Waiting on Parts", color: "#F6A623", textColor: "#5B3A00" },
  { name: "Will Call / Pickup", color: "#4A90D9", textColor: "#08243F" },
];

// --- Live source (Dataverse) -------------------------------------------------
const liveQueueDataSource: QueueDataSource = {
  async loadGroups(kind) {
    const m = await import("./dataverse-live");
    return m.fetchQueueGroups(kind);
  },
  async createGroup(group) {
    const m = await import("./dataverse-live");
    await m.createQueueGroup(group);
  },
  async updateGroup(id, changes) {
    const m = await import("./dataverse-live");
    await m.updateQueueGroup(id, changes);
  },
  async deleteGroup(id, itemIds) {
    const m = await import("./dataverse-live");
    await m.deleteQueueGroup(id, itemIds);
  },
  async createItem(item) {
    const m = await import("./dataverse-live");
    await m.createQueueItem(item);
  },
  async updateItem(id, changes) {
    const m = await import("./dataverse-live");
    await m.updateQueueItem(id, changes);
  },
  async deleteItem(id) {
    const m = await import("./dataverse-live");
    await m.deleteQueueItem(id);
  },
};

// --- Mock source (dev / tests) — in-memory, persists for the session ---------
function seedMockGroups(kind: QueueKind): QueueGroup[] {
  const templates = kind === "shipping" ? SHIPPING_GROUP_TEMPLATES : DEFAULT_GROUP_TEMPLATES;
  const groups = templates.map((t, i) => ({
    ...t,
    id: newId(),
    kind,
    collapsed: false,
    sortOrder: i,
    items: [] as QueueItem[],
  }));
  if (kind === "shipping") {
    groups[0]!.items = [
      {
        id: newId(), groupId: groups[0]!.id, jobNo: "J36388", customerName: "Kwik Shop - Wichita",
        jobDescription: "", planningLineDescription: "(2) Pylon faces", estimatedHours: 0,
        departmentId: "", crewPersons: null, crewTrucks: null, crewTrips: null, installZip: null,
        invoiceAmount: null, isCustom: false, customColor: null, customTextColor: null, sortOrder: 0,
      },
      {
        id: newId(), groupId: groups[0]!.id, jobNo: "J34773", customerName: "Western Motor",
        jobDescription: "", planningLineDescription: "(1) J-Bolt Form & (1) Rebar Cage",
        estimatedHours: 0, departmentId: "", crewPersons: null, crewTrucks: null, crewTrips: null,
        installZip: null, invoiceAmount: null, isCustom: false, customColor: null,
        customTextColor: null, sortOrder: 1,
      },
    ];
    groups[1]!.items = [
      {
        id: newId(), groupId: groups[1]!.id, jobNo: "J35454", customerName: "Lumineo Signs",
        jobDescription: "", planningLineDescription: "(1) 4x8 ACM Sign", estimatedHours: 0,
        departmentId: "", crewPersons: null, crewTrucks: null, crewTrips: null, installZip: null,
        invoiceAmount: null, isCustom: false, customColor: null, customTextColor: null, sortOrder: 0,
      },
    ];
    return groups;
  }
  if (kind === "production") {
    groups[0]!.items = [
      {
        id: newId(), groupId: groups[0]!.id, jobNo: "J36110", customerName: "First Bank - Hays",
        jobDescription: "", planningLineDescription: "Monument cabinet & (2) post covers",
        estimatedHours: 16, departmentId: "", crewPersons: null, crewTrucks: null, crewTrips: null,
        installZip: null, invoiceAmount: 12500, isCustom: false, customColor: null, customTextColor: null, sortOrder: 0,
      },
      {
        id: newId(), groupId: groups[0]!.id, jobNo: "J36241", customerName: "Salina Regional Health",
        jobDescription: "", planningLineDescription: "Set of channel letters", estimatedHours: 24,
        departmentId: "", crewPersons: null, crewTrucks: null, crewTrips: null, installZip: null,
        invoiceAmount: 18900, isCustom: false, customColor: null, customTextColor: null, sortOrder: 1,
      },
    ];
    groups[1]!.items = [
      {
        id: newId(), groupId: groups[1]!.id, jobNo: "J35887", customerName: "RTS Accounting",
        jobDescription: "", planningLineDescription: "3x8 Wall Pan", estimatedHours: 8,
        departmentId: "", crewPersons: null, crewTrucks: null, crewTrips: null, installZip: null,
        invoiceAmount: 6400, isCustom: false, customColor: null, customTextColor: null, sortOrder: 0,
      },
    ];
  }
  return groups;
}

function createMockQueueDataSource(): QueueDataSource {
  const byKind = new Map<QueueKind, QueueGroup[]>();
  const get = (kind: QueueKind): QueueGroup[] => {
    if (!byKind.has(kind)) byKind.set(kind, seedMockGroups(kind));
    return byKind.get(kind)!;
  };
  const findKindOfGroup = (id: string): QueueKind | undefined => {
    for (const [k, gs] of byKind) if (gs.some((g) => g.id === id)) return k;
    return undefined;
  };
  return {
    async loadGroups(kind) {
      return get(kind).map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) }));
    },
    async createGroup(group) {
      get(group.kind).push({ ...group, items: [] });
    },
    async updateGroup(id, changes) {
      const k = findKindOfGroup(id);
      if (!k) return;
      const gs = get(k);
      const idx = gs.findIndex((g) => g.id === id);
      if (idx >= 0) gs[idx] = { ...gs[idx]!, ...changes };
    },
    async deleteGroup(id) {
      const k = findKindOfGroup(id);
      if (!k) return;
      byKind.set(k, get(k).filter((g) => g.id !== id));
    },
    async createItem(item) {
      const k = findKindOfGroup(item.groupId);
      if (!k) return;
      get(k).find((g) => g.id === item.groupId)?.items.push({ ...item });
    },
    async updateItem(id, changes) {
      for (const gs of byKind.values())
        for (const g of gs) {
          const it = g.items.find((i) => i.id === id);
          if (it) Object.assign(it, changes);
        }
    },
    async deleteItem(id) {
      for (const gs of byKind.values())
        for (const g of gs) g.items = g.items.filter((i) => i.id !== id);
    },
  };
}

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
let _mock: QueueDataSource | null = null;

export function getQueueDataSource(): QueueDataSource {
  if (LIVE) return liveQueueDataSource;
  if (!_mock) _mock = createMockQueueDataSource();
  return _mock;
}
