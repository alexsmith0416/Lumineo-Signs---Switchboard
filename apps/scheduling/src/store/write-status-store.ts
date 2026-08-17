import { create } from "zustand";

/**
 * Tracks background saves so a failed one is visible instead of silent.
 *
 * The old behaviour on a write failure was to reload the board, which threw
 * away the optimistic edit — the user's action just vanished and they redid it.
 * Now a failure KEEPS the edit on screen, records it here, and keeps the retry
 * available. The board is never reloaded behind the user's back; discarding
 * their work is only ever something they choose.
 */

export interface FailedWrite {
  id: string;
  /** What the user did, in their words: "Move job card", "Add install help". */
  label: string;
  message: string;
  at: number;
  /** Re-run the exact write that failed. */
  retry: () => Promise<unknown>;
}

interface WriteStatusState {
  pending: number;
  failed: FailedWrite[];
  /** Wrap a persist so "Saving…" reflects real in-flight work. */
  track: <T>(op: Promise<T>) => Promise<T>;
  reportFailure: (input: { label: string; message: string; retry: () => Promise<unknown> }) => void;
  retryOne: (id: string) => Promise<void>;
  retryAll: () => Promise<void>;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useWriteStatusStore = create<WriteStatusState>((set, get) => ({
  pending: 0,
  failed: [],

  track: async (op) => {
    set((s) => ({ pending: s.pending + 1 }));
    try {
      return await op;
    } finally {
      set((s) => ({ pending: Math.max(0, s.pending - 1) }));
    }
  },

  reportFailure: ({ label, message, retry }) => {
    const entry: FailedWrite = { id: crypto.randomUUID(), label, message, at: Date.now(), retry };
    console.error(`[save] ${label} failed after retries — edit kept on screen: ${message}`);
    set((s) => ({ failed: [...s.failed, entry] }));
  },

  retryOne: async (id) => {
    const entry = get().failed.find((f) => f.id === id);
    if (!entry) return;
    // Drop it first so a second failure re-reports cleanly rather than stacking.
    set((s) => ({ failed: s.failed.filter((f) => f.id !== id) }));
    try {
      await get().track(entry.retry());
    } catch (e) {
      get().reportFailure({
        label: entry.label,
        message: e instanceof Error ? e.message : String(e),
        retry: entry.retry,
      });
    }
  },

  retryAll: async () => {
    const ids = get().failed.map((f) => f.id);
    for (const id of ids) await get().retryOne(id);
  },

  dismiss: (id) => set((s) => ({ failed: s.failed.filter((f) => f.id !== id) })),
  clear: () => set({ failed: [] }),
}));

/**
 * Run a background persist for an optimistic edit. On failure the edit STAYS on
 * screen and the failure is recorded with its retry — nothing reloads, so the
 * user's action is never silently undone. Use this for every store write.
 */
export function persistOrReport(label: string, op: () => Promise<unknown>): Promise<unknown> {
  const s = useWriteStatusStore.getState();
  return s.track(op()).catch((e) => reportWriteFailure(label, e, op));
}

/**
 * The single place a store handles a failed persist. Records it, keeps the
 * on-screen edit, and does NOT reload — the reload is what used to erase the
 * user's action.
 */
export function reportWriteFailure(
  label: string,
  error: unknown,
  retry: () => Promise<unknown>,
): void {
  useWriteStatusStore.getState().reportFailure({
    label,
    message: error instanceof Error ? error.message : String(error),
    retry,
  });
}
