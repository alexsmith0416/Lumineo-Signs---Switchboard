// Customer due dates (Oct 17, 2026). Pure.

/** A customer due date. Saved before Oct 17, 2026 a BC promised date ("2026-06-12")
 *  went in as exactly UTC midnight — the evening before here. Read that back as
 *  the calendar day it meant; anything else is a real local time. */
export function dueDateOrNull(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return utcMidnight ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : d;
}
