/**
 * Hours accounting for a job task scheduled in SECTIONS.
 *
 * A person often works a job, switches to other work, then comes back to it.
 * Rather than scheduling the job twice (which would book its full estimate
 * twice over), a card can be SPLIT into parts that share one pot of hours:
 * the task's BC estimate. Each part carries its own `overrideHours` (its slice)
 * and the parts are linked by `splitGroupId`.
 *
 * Invariants:
 *  - `estimatedHours` (the BC estimate) is the pot and never changes — it stays
 *    identical on every part, exactly as it is everywhere else in the app.
 *  - A part's slice is always an explicit `overrideHours`. A part must never
 *    fall back to the estimate, or one part would claim the whole pot.
 *  - Going over the pot is allowed (jobs run long) but surfaced — see `overBy`.
 */
import type { ScheduleLine } from "../engine/types";

/** A card's actual hours: its override when set, else the BC estimate. */
export function lineHours(
  line: Pick<ScheduleLine, "overrideHours" | "estimatedHours">,
): number {
  const h = line.overrideHours;
  return h == null || Number.isNaN(h) ? line.estimatedHours : h;
}

const normTask = (t: string | undefined): string => (t ?? "").trim().toLowerCase();

/** Same job AND same task text — "the same piece of work", ignoring who's on it. */
export function sameJobTask(
  a: Pick<ScheduleLine, "jobNo" | "planningLineDescription">,
  b: Pick<ScheduleLine, "jobNo" | "planningLineDescription">,
): boolean {
  return (
    !!a.jobNo &&
    a.jobNo === b.jobNo &&
    normTask(a.planningLineDescription) === normTask(b.planningLineDescription)
  );
}

/**
 * The parts that share `line`'s pot, in schedule order.
 *
 * Normally this is an explicit `splitGroupId` group. When the group column
 * isn't available (it post-dates the schedule-line tables — see `splitCol` in
 * dataverse-live), fall back to same job + same task **on the same employee**:
 * that still recognises sections of one person's work, while NOT swallowing the
 * deliberate case of one task duplicated across a crew, where each person really
 * does work the full hours in parallel.
 */
export function splitSiblings(line: ScheduleLine, schedule: ScheduleLine[]): ScheduleLine[] {
  const group = line.splitGroupId;
  const parts = group
    ? schedule.filter((l) => l.splitGroupId === group)
    : schedule.filter(
        (l) => !l.splitGroupId && l.employeeId === line.employeeId && sameJobTask(l, line),
      );
  // The line itself may not be in `schedule` yet (mid-edit drafts).
  const withSelf = parts.some((l) => l.id === line.id) ? parts : [...parts, line];
  return [...withSelf].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
}

export interface HoursPot {
  /** The task's BC estimate — the total the parts share. */
  pot: number;
  /** Hours already committed across every part. */
  allocated: number;
  /** pot − allocated. Negative when the parts overrun the estimate. */
  remaining: number;
  /** Hours over the estimate (0 when within it). */
  overBy: number;
  /** Every part, in schedule order. */
  parts: ScheduleLine[];
  /** This card's 1-based position among the parts. */
  index: number;
  /** Total number of parts. 1 = not split. */
  count: number;
  /** Hours committed on the OTHER parts (allocated − this card's hours). */
  otherParts: number;
}

/** The pot breakdown for a card — drives the editor readout and the card badge. */
export function potFor(line: ScheduleLine, schedule: ScheduleLine[]): HoursPot {
  const parts = splitSiblings(line, schedule);
  const allocated = parts.reduce((sum, l) => sum + lineHours(l), 0);
  const mine = lineHours(line);
  const pot = line.estimatedHours;
  const remaining = pot - allocated;
  return {
    pot,
    allocated,
    remaining,
    overBy: Math.max(0, -remaining),
    parts,
    index: Math.max(1, parts.findIndex((l) => l.id === line.id) + 1),
    count: parts.length,
    otherParts: allocated - mine,
  };
}

/** Only a real job card has an hours pot to cut. Block-out cards (PTO), group
 *  containers (both `isCustom`) and placed shipment loads have none, and a card
 *  down to the minimum slice can't be halved any further. */
export const isSplittable = (line: ScheduleLine): boolean =>
  !line.isCustom && !line.shipmentLoadId && lineHours(line) > 0.5;

/** True when this card is one section of a larger task. */
export const isSplitPart = (line: ScheduleLine, schedule: ScheduleLine[]): boolean =>
  potFor(line, schedule).count > 1;

/** The grouping key `splitSiblings` uses, as a string — explicit group when set,
 *  else same job + task on the same person. */
const partKey = (l: ScheduleLine): string =>
  l.splitGroupId
    ? `g:${l.splitGroupId}`
    : `t:${l.employeeId}|${l.jobNo}|${normTask(l.planningLineDescription)}`;

/**
 * `lineId → "n/N"` for every card that is one of several parts, in one pass over
 * the schedule — so the board can badge split cards without each card
 * re-scanning the whole board.
 */
export function splitPartLabels(schedule: ScheduleLine[]): Map<string, string> {
  const groups = new Map<string, ScheduleLine[]>();
  for (const l of schedule) {
    if (!l.jobNo || l.isCustom) continue;
    const k = partKey(l);
    const g = groups.get(k);
    if (g) g.push(l);
    else groups.set(k, [l]);
  }
  const out = new Map<string, string>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const ordered = [...g].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    ordered.forEach((l, i) => out.set(l.id, `${i + 1}/${ordered.length}`));
  }
  return out;
}

export interface TaskCommitment {
  /** Hours already on the board for this job + task (any employee). */
  hours: number;
  /** The cards making up those hours, in schedule order. */
  lines: ScheduleLine[];
}

/**
 * What's already scheduled for a job + task anywhere on the board.
 *
 * Used to pre-fill a NEW card with the leftover hours instead of the full
 * estimate. Unlike `splitSiblings` this deliberately spans employees — the
 * point is to warn "this task is already partly scheduled", and the caller
 * shows who/when so a genuine parallel crew booking can be typed straight over.
 */
export function taskCommitment(
  task: Pick<ScheduleLine, "jobNo" | "planningLineDescription">,
  schedule: ScheduleLine[],
  ignoreLineId?: string,
): TaskCommitment {
  const lines = schedule
    .filter((l) => l.id !== ignoreLineId && !l.isCustom && sameJobTask(l, task))
    .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  return { hours: lines.reduce((sum, l) => sum + lineHours(l), 0), lines };
}

/** Round to quarter-hours — the granularity the hours inputs use (step 0.25). */
const quarter = (h: number): number => Math.round(h * 4) / 4;

/**
 * Split `total` into `count` parts, largest first, on quarter-hour boundaries,
 * summing back to exactly `total` (the remainder rides on the first part).
 */
export function evenSplit(total: number, count: number): number[] {
  if (count <= 1) return [total];
  const each = quarter(total / count);
  const parts = Array.from({ length: count }, () => each);
  const drift = quarter(total - each * count);
  parts[0] = quarter(parts[0]! + drift);
  return parts;
}

/** A fresh split-group id. Stable across the parts of one split. */
export function newSplitGroupId(jobNo: string): string {
  return `sg-${jobNo || "job"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
