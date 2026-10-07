// The Jobs grid's FREEZE LINE (pure) — like Airtable's: the first N columns of
// a view stay put when the grid scrolls sideways; a shadowed line sits after
// them, and editors drag it to another column edge to freeze more or fewer.
// N is saved on the view (ViewDef.frozen), so everyone sees the same.
//
// Coordinates are in the grid's VISIBLE area (0 = its left edge): the frozen
// columns never move, the rest are shifted left by the horizontal scroll.

/** At least the Job # / Name column is always frozen. */
export const MIN_FROZEN = 1;
/** The frozen columns never take more than this share of the visible width. */
const MAX_SHARE = 0.75;

/** Each frozen column's sticky left offset (sum of the widths before it). */
export function frozenOffsets(widths: readonly number[], frozen: number): number[] {
  const out: number[] = [];
  let x = 0;
  for (let i = 0; i < Math.min(frozen, widths.length); i++) {
    out.push(x);
    x += widths[i]!;
  }
  return out;
}

const sum = (xs: readonly number[], n: number) => xs.slice(0, n).reduce((a, b) => a + b, 0);

/**
 * How many columns actually freeze on this screen: the view's number, cut back
 * (to at least MIN_FROZEN) until the frozen columns fit in MAX_SHARE of the
 * visible width — so a narrow window can still scroll.
 */
export function effectiveFrozen(widths: readonly number[], frozen: number, visibleWidth: number): number {
  if (!widths.length) return 0;
  if (widths.length === 1) return 1;
  // Leave at least one column to scroll.
  let n = Math.max(MIN_FROZEN, Math.min(Math.round(frozen) || MIN_FROZEN, widths.length - 1));
  if (visibleWidth > 0) while (n > MIN_FROZEN && sum(widths, n) > visibleWidth * MAX_SHARE) n--;
  return n;
}

/** Where the line sits after N frozen columns (visible coordinates). */
export function lineX(widths: readonly number[], frozen: number): number {
  return sum(widths, frozen);
}

/**
 * The column edge nearest to `x` (visible coordinates) while dragging the
 * line, as a frozen count: an edge inside the frozen area doesn't move; one
 * past it is shifted by the scroll. Edges that would leave the frozen area
 * wider than MAX_SHARE of the view, or off screen, aren't offered.
 */
export function nearestFrozen(
  widths: readonly number[],
  frozen: number,
  scrollLeft: number,
  x: number,
  visibleWidth: number,
): number {
  let best = Math.max(MIN_FROZEN, Math.min(frozen, widths.length - 1));
  let bestDist = Infinity;
  for (let n = MIN_FROZEN; n < widths.length; n++) {
    const content = sum(widths, n);
    if (visibleWidth > 0 && content > visibleWidth * MAX_SHARE) break;
    const at = n <= frozen ? content : content - scrollLeft;
    if (at < 0 || (visibleWidth > 0 && at > visibleWidth)) continue;
    const d = Math.abs(at - x);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}
