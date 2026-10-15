// Retry policy for Dataverse writes.
//
// THE BUG THIS EXISTS TO KILL: a user edit (move a card, resize it, add install
// help, change an end date) would "not take" the first time and work on the
// second try. The write failed, the store caught it and reloaded the board, and
// the reload erased the optimistic edit — so the action silently vanished.
//
// Two things made that happen far more often than a flaky network should:
//
//  1. The old retry only inspected a *returned* `{success:false}` result. The
//     Power Apps host bridge (`client.executeAsync`) REJECTS on infrastructure
//     trouble — bridge/connector not warm yet, host busy, call timed out. A
//     rejection blew straight past the retry. That is exactly the first-action-
//     after-load case: nothing is warm yet, the first write throws, every later
//     one succeeds.
//  2. Retry was gated on a whitelist of "transient-looking" message text. Any
//     message the list didn't anticipate — including an empty one — counted as
//     permanent and cost the user their edit.
//
// So the policy here is INVERTED: a failure is retryable unless we positively
// recognise it as permanent. Being wrong in the retryable direction costs a few
// hundred milliseconds; being wrong the other way costs the user their work.

/** Failures where trying again cannot help — the request itself is the problem. */
const PERMANENT_PATTERNS: RegExp[] = [
  /\b(400|403|404|409|413)\b/, // bad request, forbidden, not found, conflict, too large
  /bad request/i,
  /forbidden/i,
  /principal.{0,80}(privilege|permission)/i, // "Principal user … is missing prvWriteX privilege"
  /does not (exist|hold)/i,
  /not found/i,
  /duplicate/i,
  /could not find a property named/i, // unknown column (dropMissingCols handles the retry)
  /invalid (property|column|value|argument)/i,
  /read-?only/i,
  /malformed/i,
  /too large/i,
];

/**
 * Should this failure be retried? Unknown / empty messages say YES on purpose:
 * an unrecognised failure is far more likely to be infrastructure than a
 * genuinely invalid request, and a needless retry is cheap.
 */
export function isRetryableWriteError(message: string): boolean {
  return !PERMANENT_PATTERNS.some((re) => re.test(message));
}

/** Pull a message out of whatever a failed write handed us (thrown or returned). */
export function writeErrorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; error?: { message?: unknown } };
    if (typeof o.message === "string") return o.message;
    if (o.error && typeof o.error.message === "string") return o.error.message;
    try {
      return JSON.stringify(e);
    } catch {
      /* fall through */
    }
  }
  return String(e ?? "");
}

/** Backoff before attempt N (1-based): 200ms, 400ms, 800ms, 1600ms… capped.
 *  Five attempts spans ~3s — long enough to ride out a cold host bridge, short
 *  enough that a background save still feels instant. */
export const WRITE_ATTEMPTS = 5;

export function writeRetryDelay(attempt: number): number {
  return Math.min(200 * 2 ** (attempt - 1), 2000);
}
