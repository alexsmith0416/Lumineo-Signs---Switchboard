// Install readiness (#13, Oct 17, 2026) — is a job ready for the install card
// someone just put on the board? Two checks, warn-only (Alex: "warn, allow
// anyway"): the job's production cards that end AFTER the install starts (for
// departments still open on its stepper), and materials not all received
// (some POs not Received). Shown as a notice on add / move and a ⚠ chip on the
// install card. Pure — no I/O.

import { format, isSameDay } from "date-fns";

/** One production card of the job (from the Production board). */
export interface ProdCard {
  deptName: string;
  end: Date;
  /** The card's department is complete on the job's stepper (card doesn't count). */
  done: boolean;
}

/** The job's PO roll-up (po-receiving), or null when it has no POs. */
export interface MaterialsInfo {
  open: number;
  received: number;
  materialsReady: boolean;
}

/** Reasons the install is early; empty = ready as far as we can tell. */
export function installWarnings(input: {
  installStart: Date;
  prod: readonly ProdCard[];
  materials: MaterialsInfo | null;
}): string[] {
  const out: string[] = [];
  // Latest open production card per department that ends after the install starts.
  const late = new Map<string, Date>();
  for (const c of input.prod) {
    if (c.done || c.end.getTime() <= input.installStart.getTime()) continue;
    const prev = late.get(c.deptName);
    if (!prev || c.end > prev) late.set(c.deptName, c.end);
  }
  for (const [dept, end] of [...late].sort((a, b) => a[1].getTime() - b[1].getTime())) {
    // Same day → the times are what matter ("until 3:00 PM Fri 10/16 … (8:00 AM)").
    const sameDay = isSameDay(end, input.installStart);
    const until = format(end, sameDay ? "h:mm a EEE M/d" : "EEE M/d");
    const starts = format(input.installStart, sameDay ? "h:mm a" : "EEE M/d");
    out.push(`${dept || "Production"} is scheduled until ${until}, after this install starts (${starts})`);
  }
  const m = input.materials;
  if (m && m.open > 0 && !m.materialsReady) {
    out.push(`Materials not ready — ${m.received} of ${m.open} PO${m.open === 1 ? "" : "s"} received`);
  }
  return out;
}

/** The install cards to check after an edit: new ones, and ones whose start moved. */
export function installCardsToCheck<T extends { id: string; jobNo: string; isCustom?: boolean; mirrorOf?: string; startDateTime: Date }>(
  changed: readonly T[],
  before: readonly T[],
): T[] {
  const was = new Map(before.map((l) => [l.id, l.startDateTime.getTime()]));
  const seen = new Set<string>();
  return changed.filter((l) => {
    if (!l.jobNo || l.isCustom || l.mirrorOf || seen.has(l.jobNo)) return false;
    const prev = was.get(l.id);
    if (prev !== undefined && prev === l.startDateTime.getTime()) return false;
    seen.add(l.jobNo);
    return true;
  });
}
