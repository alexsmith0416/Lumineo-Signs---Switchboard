import type { Department, ScheduleLine } from "../engine/types";

/**
 * "Grouped job card" — a container card on the board that holds a list of BC
 * jobs as mini-cards (replaces the old Fill-in Jobs holding list). It has an
 * editable title + optional description, auto-colors to the department/location
 * it sits on, and can be placed on one employee's day or a whole department.
 *
 * Persistence trick (no new Dataverse schema): a group card is just a CUSTOM
 * ScheduleLine (`isCustom: true`) whose `planningLineDescription` holds a JSON
 * payload behind a sentinel. That column already round-trips through both the
 * mock source (stores the object) and the live source (packed into crfdf_notes
 * via encodeDesc), and `isCustom` keeps the card out of every BC-overlay path.
 * The member jobs are held only inside the group — they are not individually
 * scheduled on the board.
 */

/** A BC job held inside a group card (not individually scheduled). */
export interface GroupMember {
  id: string;
  jobNo: string;
  customerName: string;
  /** Task / planning-line text for the job (may be multi-line). */
  task: string;
  estimatedHours: number;
}

export interface GroupData {
  title: string;
  description: string;
  members: GroupMember[];
}

// Plain-ASCII sentinel marking a group-card payload in `planningLineDescription`.
// Kept ASCII (no control chars) so it round-trips cleanly through Dataverse text
// columns; real task text never starts with this.
const GROUP_TAG = "grp:v1:";

// The description columns a group payload persists to (crfdf_notes on install
// cards, crfdf_planninglinedescription on production lines) are 2000-char
// Dataverse text fields. A payload longer than this is silently truncated on
// save, which corrupts the JSON and makes the member jobs vanish on reload — so
// the editor refuses to add a member that would push the payload over this cap.
export const GROUP_PAYLOAD_LIMIT = 2000;

/** Encode a group payload into the `planningLineDescription` field. */
export function encodeGroup(data: GroupData): string {
  return GROUP_TAG + JSON.stringify(data);
}

/** True when a group's encoded payload fits the Dataverse column (no truncation). */
export function groupPayloadFits(data: GroupData): boolean {
  return encodeGroup(data).length <= GROUP_PAYLOAD_LIMIT;
}

/** Parse a line's group payload, or null if it isn't a group card. */
export function parseGroup(line: Pick<ScheduleLine, "isCustom" | "planningLineDescription">): GroupData | null {
  if (!line.isCustom) return null;
  const raw = line.planningLineDescription;
  if (!raw || !raw.startsWith(GROUP_TAG)) return null;
  try {
    const d = JSON.parse(raw.slice(GROUP_TAG.length)) as GroupData;
    return {
      title: d.title ?? "",
      description: d.description ?? "",
      members: Array.isArray(d.members) ? d.members : [],
    };
  } catch {
    return null;
  }
}

/** True when a line is a grouped job card. */
export function isGroupCard(line: Pick<ScheduleLine, "isCustom" | "planningLineDescription">): boolean {
  return parseGroup(line) !== null;
}

/** Stable id for a new member row. `seed` varies the value per call site. */
export function newMemberId(seed: string | number): string {
  return `gm-${seed}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Pick black/white text for a background hex so a swatch stays legible. */
export function readableText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#1a1d23";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1d23" : "#ffffff";
}

/** The card's auto color for the department/location it sits on. */
export function groupColorFor(dept: Department | undefined): { bg: string; text: string } {
  const bg = dept?.color ?? "#CCCCCC";
  return { bg, text: readableText(bg) };
}
