// Bucket Lists (Oct 17, 2026) — an ongoing, updatable list of jobs for a board
// (production / install-wk / install-nek), kept in the Job Queue's "Bucket
// Lists" tab and shown on the board as a card that fills a person's free time.
//  - Jobs are added by hand, or by a FILTER on the Jobs list data (status,
//    region, priority, customer, salesperson, release dates); the filter is
//    re-run as the data refreshes.
//  - A job DROPS OFF when its stepper step for the bucket's department is
//    completed (Alex, Oct 17).
//  - Order: oldest released first; dragging a job pins a hand order until
//    "Reset to released-date order". Other sorts are view-only.
//  - Default bucket per person: their free time each day shows ONE bucket
//    card per day, after that day's scheduled jobs (job on top, bucket below).
// Pure — no I/O. Tables: crfdf_bucketlist / crfdf_bucketitem.

import { addDays, format, isWeekend, startOfDay } from "date-fns";
import type { Employee, ScheduleLine } from "../engine/types";
import type { QueueKind } from "./job-queue-data";
import type { JobRow } from "./job-tracking";

export interface BucketFilter {
  /** Current Status is one of these (empty = any). */
  statuses: string[];
  /** Jobs list Priority is one of these (empty = any). */
  priorities: string[];
  mfgRegion: string;
  installRegion: string;
  /** Customer / job name contains (case-insensitive). */
  customer: string;
  /** Salesperson code or name contains. */
  salesperson: string;
  /** Released on/after / on/before, "yyyy-MM-dd" ("" = open). */
  releasedFrom: string;
  releasedTo: string;
}

export const EMPTY_FILTER: BucketFilter = {
  statuses: [],
  priorities: [],
  mfgRegion: "",
  installRegion: "",
  customer: "",
  salesperson: "",
  releasedFrom: "",
  releasedTo: "",
};

export interface BucketList {
  id: string;
  kind: QueueKind;
  name: string;
  color: string;
  textColor: string;
  description: string;
  mode: "manual" | "filter";
  filter: BucketFilter | null;
  /** Stepper step key whose completion drops a job off ("" = never by itself). */
  deptKey: string;
  /** People whose free time this bucket fills every day. */
  defaultEmployees: string[];
  sortOrder: number;
  collapsed: boolean;
}

export interface BucketItem {
  id: string;
  bucketId: string;
  jobNo: string;
  customerName: string;
  task: string;
  estimatedHours: number;
  /** "yyyy-MM-dd" ("" = unknown — sorts last). */
  releasedDate: string;
  sortOrder: number;
  /** Placed by hand (drag) — the list keeps its hand order. */
  pinned: boolean;
  source: "manual" | "filter";
}

export const newBucketId = (): string => crypto.randomUUID();

/** The list's own order: by hand once any job was dragged, else oldest released first. */
export function orderItems(items: readonly BucketItem[]): BucketItem[] {
  const byReleased = (a: BucketItem, b: BucketItem) =>
    (a.releasedDate || "9999") < (b.releasedDate || "9999")
      ? -1
      : (a.releasedDate || "9999") > (b.releasedDate || "9999")
        ? 1
        : a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true });
  if (items.some((i) => i.pinned)) return [...items].sort((a, b) => a.sortOrder - b.sortOrder || byReleased(a, b));
  return [...items].sort(byReleased);
}

/** Where a new job goes in a hand-ordered list: before the first job released after it. */
export function insertIndex(ordered: readonly BucketItem[], releasedDate: string): number {
  const key = releasedDate || "9999";
  const i = ordered.findIndex((x) => (x.releasedDate || "9999") > key);
  return i < 0 ? ordered.length : i;
}

/** View sorts for the Job Queue and Bucket Lists (#3) — never saved. */
export type ViewSort = "list" | "released" | "redDate" | "target" | "jobNo" | "customer" | "hours";
export const VIEW_SORTS: ReadonlyArray<{ key: ViewSort; label: string }> = [
  { key: "list", label: "List order" },
  { key: "released", label: "Released (oldest first)" },
  { key: "redDate", label: "Red date (soonest first)" },
  { key: "target", label: "Target date (soonest first)" },
  { key: "jobNo", label: "Job #" },
  { key: "customer", label: "Customer A–Z" },
  { key: "hours", label: "Hours (most first)" },
];

/** Sort anything job-shaped for display; dates come from the Jobs list rows. */
export function viewSort<T extends { jobNo: string; customerName: string; estimatedHours: number }>(
  items: readonly T[],
  sort: ViewSort,
  rowOf: (jobNo: string) => Pick<JobRow, "releaseDate" | "redDate" | "mfgTarget" | "installTarget"> | undefined,
): T[] {
  if (sort === "list") return [...items];
  const dateKey = (t: T): string => {
    const r = rowOf(t.jobNo);
    const v = !r ? "" : sort === "released" ? r.releaseDate : sort === "redDate" ? r.redDate : r.mfgTarget || r.installTarget;
    return v || "9999";
  };
  const out = [...items];
  out.sort((a, b) => {
    switch (sort) {
      case "jobNo":
        return a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true });
      case "customer":
        return a.customerName.localeCompare(b.customerName);
      case "hours":
        return b.estimatedHours - a.estimatedHours;
      default: {
        const x = dateKey(a), y = dateKey(b);
        return x < y ? -1 : x > y ? 1 : a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true });
      }
    }
  });
  return out;
}

const contains = (hay: string, needle: string) => !needle.trim() || hay.toLowerCase().includes(needle.trim().toLowerCase());
const anyOf = (v: string, list: readonly string[]) => !list.length || list.some((x) => x.toLowerCase() === v.trim().toLowerCase());
const eqOrAny = (v: string, want: string) => !want || v.trim().toUpperCase() === want.trim().toUpperCase();

/** Does a Jobs list row match a bucket filter? */
export function matchesFilter(row: JobRow, f: BucketFilter): boolean {
  return (
    anyOf(row.status, f.statuses) &&
    anyOf(row.priority, f.priorities) &&
    eqOrAny(row.mfgRegion, f.mfgRegion) &&
    eqOrAny(row.installRegion, f.installRegion) &&
    (contains(row.name, f.customer) || contains(row.job, f.customer)) &&
    (contains(row.sales, f.salesperson) || contains(row.salespersonCode, f.salesperson)) &&
    (!f.releasedFrom || (!!row.releaseDate && row.releaseDate >= f.releasedFrom)) &&
    (!f.releasedTo || (!!row.releaseDate && row.releaseDate <= f.releasedTo))
  );
}

/** What a filter bucket should add / remove so it matches the Jobs list now.
 *  Hand-added jobs are never removed by the filter; done jobs never come back. */
export function filterSync(
  bucket: BucketList,
  items: readonly BucketItem[],
  rows: readonly JobRow[],
  isDone: (jobNo: string) => boolean,
): { add: JobRow[]; remove: BucketItem[] } {
  if (bucket.mode !== "filter" || !bucket.filter) return { add: [], remove: [] };
  const f = bucket.filter;
  const wanted = new Map<string, JobRow>();
  for (const r of rows) if (r.inBc && r.jobNo && matchesFilter(r, f) && !isDone(r.jobNo)) wanted.set(r.jobNo, r);
  const have = new Set(items.map((i) => i.jobNo));
  return {
    add: [...wanted.values()].filter((r) => !have.has(r.jobNo)),
    remove: items.filter((i) => i.source === "filter" && !wanted.has(i.jobNo)),
  };
}

/** Jobs that should drop off: their step for the bucket's department is complete. */
export function dropOffs(
  bucket: Pick<BucketList, "deptKey">,
  items: readonly BucketItem[],
  completedSteps: (jobNo: string) => ReadonlySet<string>,
): BucketItem[] {
  if (!bucket.deptKey) return [];
  return items.filter((i) => completedSteps(i.jobNo).has(bucket.deptKey));
}

// --- Default bucket: fill each day's free time ---------------------------------

/** Text for a bucket's card: its first few jobs, numbered. */
export function bucketCardText(items: readonly BucketItem[], max = 4): string {
  const top = items.slice(0, max).map((i, n) => `${n + 1}. ${i.jobNo} ${i.customerName}`.trim());
  if (items.length > max) top.push(`+${items.length - max} more`);
  return top.join("\n") || "No jobs yet";
}

/**
 * One read-only bucket card per workday for each person with a default bucket:
 * the free hours left in their day (standard hours minus scheduled work inside
 * the day's 8:00 window), placed AFTER that day's jobs so the job shows on top
 * and the bucket below. Never saved — drawn like a mirrored card.
 */
export function bucketFillLines(input: {
  buckets: readonly BucketList[];
  itemsOf: (bucketId: string) => readonly BucketItem[];
  employees: readonly Employee[];
  schedule: readonly ScheduleLine[];
  days: readonly Date[];
  dayStartHour?: number;
}): Map<string, ScheduleLine[]> {
  const startHour = input.dayStartHour ?? 8;
  const out = new Map<string, ScheduleLine[]>();
  const bucketOf = new Map<string, BucketList>();
  for (const b of [...input.buckets].sort((a, c) => a.sortOrder - c.sortOrder)) {
    for (const id of b.defaultEmployees) if (!bucketOf.has(id)) bucketOf.set(id, b);
  }
  for (const emp of input.employees) {
    const b = bucketOf.get(emp.id);
    if (!b) continue;
    const std = emp.standardHoursPerDay > 0 ? emp.standardHoursPerDay : 8;
    const mine = input.schedule.filter((l) => l.employeeId === emp.id);
    const lines: ScheduleLine[] = [];
    for (const day of input.days) {
      if (!emp.worksWeekends && isWeekend(day)) continue;
      const winStart = new Date(startOfDay(day));
      winStart.setHours(startHour, 0, 0, 0);
      const winEnd = new Date(winStart.getTime() + std * 3_600_000);
      let busy = 0;
      let lastEnd = winStart.getTime();
      for (const l of mine) {
        const s = Math.max(l.startDateTime.getTime(), winStart.getTime());
        const e = Math.min(l.endDateTime.getTime(), winEnd.getTime());
        if (e > s) {
          busy += (e - s) / 3_600_000;
          lastEnd = Math.max(lastEnd, e);
        }
      }
      const free = Math.round((std - busy) * 4) / 4;
      if (free < 0.5) continue;
      // After the day's last job, but never spilling into the next day.
      const dayEnd = addDays(startOfDay(day), 1).getTime() - 60_000;
      const start = new Date(Math.min(lastEnd, dayEnd - 60_000));
      const end = new Date(Math.min(start.getTime() + free * 3_600_000, dayEnd));
      lines.push({
        id: `bucket-${b.id}-${emp.id}-${format(day, "yyyyMMdd")}`,
        jobNo: b.name,
        customerName: b.name,
        planningLineDescription: bucketCardText(orderItems(input.itemsOf(b.id))),
        startDateTime: start,
        endDateTime: end,
        estimatedHours: free,
        overrideHours: null,
        employeeId: emp.id,
        departmentId: emp.departmentId,
        customerDueDate: null,
        isLocked: true,
        jobSequence: 0,
        isCustom: true,
        customColor: b.color,
        customTextColor: b.textColor,
        mirrorOf: "bucket",
        bucketId: b.id,
      });
    }
    if (lines.length) out.set(emp.id, lines);
  }
  return out;
}
