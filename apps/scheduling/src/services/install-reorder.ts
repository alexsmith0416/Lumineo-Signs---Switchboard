import type { Employee } from "../engine/types";

export interface RosterMove {
  id: string;
  /** crfdf_location option value. */
  location: number;
  /** crfdf_positiononschedule — zero-padded. */
  position: string;
}

export interface RosterDropTarget {
  /** Insert immediately before this crew, adopting its location. */
  beforeId?: string;
  /** Append to the end of this location group (header drop / empty group). */
  groupLocation?: number;
}

const pad = (n: number): string => String(Math.max(0, Math.trunc(n))).padStart(2, "0");
const locOf = (e: Employee): number => Number(e.departmentId) || 0;
const posOf = (e: Employee): number => e.position ?? 0;

/**
 * Compute the minimal set of (location, position) changes to move `draggedId`
 * to a new spot in the install roster.
 *
 * The board lists crews grouped by location (ascending), and within a group by
 * position. Dropping a crew renumbers the whole region in that display order so
 * the listing is exact and positions stay clean (region size is tiny, so the
 * write batch is small). Only rows that actually change are returned.
 */
export function computeRosterReorder(
  crews: Employee[],
  draggedId: string,
  drop: RosterDropTarget,
): RosterMove[] {
  const dragged = crews.find((c) => c.id === draggedId);
  if (!dragged) return [];

  // Current display order: location asc, then position asc.
  const ordered = [...crews].sort((a, b) => locOf(a) - locOf(b) || posOf(a) - posOf(b));
  const without = ordered.filter((c) => c.id !== draggedId);

  let newLoc: number;
  let insertAt: number;
  if (drop.beforeId && drop.beforeId !== draggedId) {
    const idx = without.findIndex((c) => c.id === drop.beforeId);
    if (idx === -1) return [];
    newLoc = locOf(without[idx]!);
    insertAt = idx;
  } else if (drop.groupLocation !== undefined) {
    newLoc = drop.groupLocation;
    // Append after the last crew already in that location block...
    let lastIdx = -1;
    without.forEach((c, i) => {
      if (locOf(c) === newLoc) lastIdx = i;
    });
    if (lastIdx >= 0) {
      insertAt = lastIdx + 1;
    } else {
      // ...or, for an empty group, at the boundary where it sorts.
      const gi = without.findIndex((c) => locOf(c) > newLoc);
      insertAt = gi === -1 ? without.length : gi;
    }
  } else {
    return [];
  }

  const newOrder = [...without];
  newOrder.splice(insertAt, 0, dragged);

  // Renumber sequentially in the new display order; emit only real changes.
  const moves: RosterMove[] = [];
  newOrder.forEach((c, i) => {
    const newPos = pad(i + 1);
    const finalLoc = c.id === draggedId ? newLoc : locOf(c);
    if (finalLoc !== locOf(c) || newPos !== pad(posOf(c))) {
      moves.push({ id: c.id, location: finalLoc, position: newPos });
    }
  });
  return moves;
}
