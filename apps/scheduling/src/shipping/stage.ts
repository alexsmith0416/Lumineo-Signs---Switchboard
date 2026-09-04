// Shipping staging board — the always-on kanban under the week's day columns.
//
// A "staged" project is a job that's built and waiting for a truck. It lives in
// a named, color-coded list (a queue group of kind "shipping") until someone
// drags it onto a day or an existing load, at which point it becomes a
// ShipmentItem on that load and leaves the board.
//
// This module is pure — no React, no store, no I/O — so the mapping and the
// drag bookkeeping are testable on their own.

import { newId, type QueueGroup, type QueueItem } from "../services/job-queue-data";
import type { BcJob } from "./bc-jobs";
import type { ShipmentItem } from "./types";

/**
 * Drag payload key for a staged card.
 *
 * MUST stay lowercase: the HTML5 drag store lowercases every type key, so
 * `dataTransfer.types` reports the lowercase form and a drop target comparing
 * against a mixed-case constant would never match. (`getData` is
 * case-insensitive, so reads would still work — which makes this fail in the
 * confusing "drop does nothing" way rather than loudly.)
 *
 * Deliberately distinct from the calendar queue's `text/queueitemid` so the two
 * drag systems can never accept each other's cards.
 */
export const DND_SHIP_STAGE = "text/shipstageid";

/**
 * Drag payload key for an item being pulled back OFF a load (from the load
 * editor) and returned to staging. Lowercase for the same reason as
 * DND_SHIP_STAGE, and separate from it so a staging list can tell "this card is
 * moving between lists" from "this project is coming back off a truck".
 */
export const DND_LOAD_ITEM = "text/loaditemid";

/**
 * A load item is only addressable as (load, item), and `dataTransfer` values
 * are strings — so the two ids travel joined. Both are UUIDs, which never
 * contain the separator.
 */
const REF_SEP = "|";

export function encodeLoadItemRef(loadId: string, itemId: string): string {
  return `${loadId}${REF_SEP}${itemId}`;
}

/** Parse a ref back, or null if it isn't one (empty payload, wrong key, junk). */
export function decodeLoadItemRef(ref: string): { loadId: string; itemId: string } | null {
  const at = ref.indexOf(REF_SEP);
  if (at <= 0) return null;
  const loadId = ref.slice(0, at);
  const itemId = ref.slice(at + REF_SEP.length);
  if (!loadId || !itemId) return null;
  return { loadId, itemId };
}

/**
 * A staged card carries only what a shipment needs to identify the project.
 * The scheduling-shaped fields of QueueItem (hours, department, crew, ZIP)
 * are not meaningful for a truck load and are left at their empty values.
 */
function baseStageItem(groupId: string, sortOrder: number): QueueItem {
  return {
    id: newId(),
    groupId,
    jobNo: "",
    customerName: "",
    jobDescription: "",
    planningLineDescription: "",
    estimatedHours: 0,
    departmentId: "",
    crewPersons: null,
    crewTrucks: null,
    crewTrips: null,
    installZip: null,
    invoiceAmount: null,
    isCustom: false,
    customColor: null,
    customTextColor: null,
    sortOrder,
  };
}

/** Stage a BC job: job no + customer + its project description. */
export function stageItemFromJob(job: BcJob, groupId: string, sortOrder: number): QueueItem {
  return {
    ...baseStageItem(groupId, sortOrder),
    jobNo: job.jobNo,
    customerName: job.customerName,
    planningLineDescription: job.description,
  };
}

/** Stage something BC can't name yet (a transformer run, a will-call pickup). */
export function stageItemFromManual(
  customerName: string,
  description: string,
  groupId: string,
  sortOrder: number,
): QueueItem {
  return {
    ...baseStageItem(groupId, sortOrder),
    customerName: customerName.trim(),
    planningLineDescription: description.trim(),
  };
}

/**
 * The load item a staged card becomes when dropped onto a load.
 *
 * `location`, `kind`, and `notes` are deliberately left at their defaults —
 * they're decisions about *this run* (which stop, dropping or collecting, how
 * to load it), so they're set in the load editor that opens on drop rather than
 * guessed here.
 */
export function shipmentItemFromStage(item: QueueItem): Partial<ShipmentItem> {
  return {
    jobNo: item.jobNo.trim() || null,
    customerName: item.customerName,
    description: item.planningLineDescription,
  };
}

/**
 * The staged card a load item becomes when it's dragged back off a load — the
 * inverse of `shipmentItemFromStage`.
 *
 * The item's location / kind / loaded tick / loading notes are dropped on
 * purpose: they described the run it just left. If it goes out again on a
 * different load it gets a fresh set, which is the whole reason staging doesn't
 * carry them.
 */
export function stageItemFromShipmentItem(
  item: ShipmentItem,
  groupId: string,
  sortOrder: number,
): QueueItem {
  return {
    ...baseStageItem(groupId, sortOrder),
    jobNo: item.jobNo ?? "",
    customerName: item.customerName,
    planningLineDescription: item.description,
  };
}

/**
 * Reorder group ids by moving `fromId` to sit where `toId` currently is.
 * Returns the input array by identity when the move is a no-op or either id is
 * unknown, so callers can skip a write.
 */
export function reorderGroupIds(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return ids;
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
}

/**
 * Find a staged card by id across every list. A drop target only receives the
 * dragged card's id, so it has to look the card itself back up.
 */
export function findStagedItem(groups: QueueGroup[], id: string): QueueItem | undefined {
  for (const g of groups) {
    const found = g.items.find((it) => it.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Total staged cards across every list — the board's header count. */
export function stagedCount(groups: QueueGroup[]): number {
  return groups.reduce((sum, g) => sum + g.items.length, 0);
}
