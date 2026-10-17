// Multi-select on the boards (Oct 17, 2026) — Ctrl+click cards to select them,
// then move / copy / cut / paste / delete / lock them together or make them one
// group card. Pure rules (no I/O); the board does the writes.

import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import type { ScheduleLine } from "../engine/types";
import { encodeGroup, groupPayloadFits, newMemberId, type GroupData, type GroupMember } from "./group-card";

/** Where each selected card goes when one of them (`anchorId`) is dragged:
 *  every card shifts by the same amount; the cards on the dragged card's person
 *  follow it to a new person, the others stay on theirs. */
export function groupMoveTargets(
  selected: readonly ScheduleLine[],
  anchorId: string,
  newStart: Date,
  newEmployeeId?: string,
): Array<{ id: string; start: Date; employeeId: string | undefined }> {
  const anchor = selected.find((l) => l.id === anchorId);
  if (!anchor) return [];
  const delta = newStart.getTime() - anchor.startDateTime.getTime();
  const moveEmp = newEmployeeId && newEmployeeId !== anchor.employeeId ? newEmployeeId : undefined;
  return selected
    .filter((l) => !l.isLocked || l.id === anchorId)
    .map((l) => ({
      id: l.id,
      start: new Date(l.startDateTime.getTime() + delta),
      employeeId: moveEmp && l.employeeId === anchor.employeeId ? moveEmp : undefined,
    }));
}

/** Pasting several copied cards on a day: the earliest lands on that day at
 *  8:00, the others keep their day gap from it and their time of day; all go
 *  to the person pasted on. */
export function pasteStarts(cards: readonly ScheduleLine[], day: Date): Array<{ card: ScheduleLine; start: Date }> {
  if (!cards.length) return [];
  const sorted = [...cards].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  const first = sorted[0]!;
  return sorted.map((card, i) => {
    if (i === 0) {
      const s = startOfDay(day);
      s.setHours(8, 0, 0, 0);
      return { card, start: s };
    }
    const gap = differenceInCalendarDays(card.startDateTime, first.startDateTime);
    const s = addDays(startOfDay(day), gap);
    s.setHours(card.startDateTime.getHours(), card.startDateTime.getMinutes(), 0, 0);
    return { card, start: s };
  });
}

/** The group card made from selected job cards (null when there's nothing to
 *  group or it won't fit the group card's text column). Members keep their job,
 *  task and hours; the card starts where the earliest one did. */
export function groupFromSelection(selected: readonly ScheduleLine[], title: string): {
  data: GroupData;
  first: ScheduleLine;
} | null {
  const jobs = selected
    .filter((l) => !l.isCustom && !l.shipmentLoadId && l.jobNo)
    .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  if (!jobs.length) return null;
  const members: GroupMember[] = jobs.map((l, i) => ({
    id: newMemberId(`${l.id}-${i}`),
    jobNo: l.jobNo,
    customerName: l.customerName,
    task: l.planningLineDescription ?? "",
    estimatedHours: l.overrideHours ?? l.estimatedHours,
  }));
  const data: GroupData = { title: title.trim() || "Group", description: "", members };
  if (!groupPayloadFits(data)) return null;
  return { data, first: jobs[0]! };
}

export { encodeGroup };
