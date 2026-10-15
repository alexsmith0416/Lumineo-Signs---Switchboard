import { useWriteStatusStore } from "../store/write-status-store";

/**
 * Background-save indicator.
 *
 * A failed write now KEEPS your change on screen instead of reloading the board
 * out from under you — which means the app owes you the truth about whether it
 * actually saved. Quiet "Saving…" while writes are in flight; a banner you have
 * to deal with if one gave up after its retries.
 */
export default function SaveStatus() {
  const pending = useWriteStatusStore((s) => s.pending);
  const failed = useWriteStatusStore((s) => s.failed);
  const retryAll = useWriteStatusStore((s) => s.retryAll);
  const clear = useWriteStatusStore((s) => s.clear);

  if (failed.length === 0 && pending === 0) return null;

  if (failed.length === 0) {
    return (
      <div className="save-status save-status--pending" role="status" aria-live="polite">
        <span className="save-status__dot" aria-hidden />
        Saving…
      </div>
    );
  }

  // Group repeats of the same action ("Move job card ×3").
  const counts = new Map<string, number>();
  for (const f of failed) counts.set(f.label, (counts.get(f.label) ?? 0) + 1);

  return (
    <div className="save-status save-status--failed" role="alert">
      <div className="save-status__title">
        {failed.length === 1 ? "1 change hasn't saved" : `${failed.length} changes haven't saved`}
      </div>
      <div className="save-status__body">
        {[...counts].map(([label, n]) => (
          <div key={label} className="save-status__item">
            {label}
            {n > 1 && ` ×${n}`}
          </div>
        ))}
        <div className="save-status__why">
          It's still on your screen but not in Dataverse yet. {failed[0]?.message}
        </div>
      </div>
      <div className="save-status__actions">
        <button type="button" className="btn-primary" onClick={() => void retryAll()}>
          Try again
        </button>
        <button
          type="button"
          className="btn-secondary"
          title="Hide this. Your change stays on screen but won't be saved unless you redo it."
          onClick={clear}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
