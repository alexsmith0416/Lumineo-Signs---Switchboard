/**
 * Batch scheduling — stage several configured jobs in a prioritized list, then
 * schedule them all top-to-bottom. Each item remembers HOW it should land
 * (a fixed employee + start, or blank fields to auto-schedule), exactly as it
 * was set up in the unified create panel.
 */
import type { ScheduleContext, ScheduleLine } from "../engine/types";
import { placeDraft } from "./schedule-draft";

export interface BatchItem {
  /** Stable list id (for React keys / drag reorder). */
  id: string;
  /** The configured, unscheduled card. */
  draft: ScheduleLine;
  /** Chosen employee (null = auto-pick least-loaded in the department). */
  employeeId: string | null;
  /** Chosen start day (null = next open day). */
  start: Date | null;
  /** Display name of the chosen employee, if any. */
  employeeName: string | null;
  // --- sort keys (captured when the item was added) ---
  hours: number;
  releaseDate: Date | null;
  productionComplete: Date | null;
  installWindow: Date | null;
}

export type BatchSortKey = "release" | "production" | "install" | "hours";
export type SortDir = "asc" | "desc";

const sortValue = (item: BatchItem, key: BatchSortKey): number | null => {
  switch (key) {
    case "hours":
      return item.hours;
    case "release":
      return item.releaseDate ? item.releaseDate.getTime() : null;
    case "production":
      return item.productionComplete ? item.productionComplete.getTime() : null;
    case "install":
      return item.installWindow ? item.installWindow.getTime() : null;
  }
};

/** Sort a copy of the list by a key/direction. Items missing that value always
 *  sort to the bottom (regardless of direction). */
export function sortBatch(items: BatchItem[], key: BatchSortKey, dir: SortDir): BatchItem[] {
  return [...items].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return dir === "asc" ? av - bv : bv - av;
  });
}

/** Move the item at `from` to `to` (drag reorder), returning a new array. */
export function reorderBatch(items: BatchItem[], from: number, to: number): BatchItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export interface BatchStoreLike {
  getState: () => {
    employees: Map<string, import("../engine/types").Employee>;
    departments: Map<string, import("../engine/types").Department>;
    schedule: ScheduleLine[];
    workHours: import("../engine/types").WorkHoursOverride[];
    overtime: import("../engine/types").OvertimeOverride[];
    addScheduleLine: (line: ScheduleLine) => Promise<void>;
  };
}

export interface BatchResult {
  scheduled: number;
  failed: BatchItem[];
}

/**
 * Schedule every item in list order (top = first). Rebuilds the context from
 * the store BEFORE each placement so auto-scheduled jobs see the ones already
 * placed and pack around them — honoring the priority order.
 */
export async function scheduleBatch(items: BatchItem[], store: BatchStoreLike): Promise<BatchResult> {
  let scheduled = 0;
  const failed: BatchItem[] = [];
  for (const item of items) {
    const s = store.getState();
    const ctx: ScheduleContext = {
      employees: s.employees,
      departments: s.departments,
      schedule: s.schedule,
      workHours: s.workHours,
      overtime: s.overtime,
    };
    const placed = placeDraft({ draft: item.draft, employeeId: item.employeeId, start: item.start, ctx });
    if (!placed) {
      failed.push(item);
      continue;
    }
    await s.addScheduleLine(placed);
    scheduled++;
  }
  return { scheduled, failed };
}
