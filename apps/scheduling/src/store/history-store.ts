import { create } from "zustand";

/**
 * Per-board undo/redo history for the live schedules.
 *
 * Each schedule store (Production / WK / NEK / Shipping) records an entry after
 * every move / resize / add / delete. An entry carries two thunks that BOTH
 * restore local board state AND re-persist the reverted/re-applied lines to
 * Dataverse — undo isn't just a local pop, it writes back to the backend.
 *
 * History is session-scoped and capped at MAX_STEPS. It is cleared whenever a
 * board reloads (`loadWeek`) — week/region changes, job-detail edits, and
 * persist-failure resyncs all reload — so undo never replays a stale snapshot
 * against a board that has since changed underneath it.
 */
export const MAX_STEPS = 20;

export interface HistoryEntry {
  /** Short label for the action (e.g. "Move", "Delete job"). */
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

interface BoardHistory {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

interface HistoryState {
  boards: Record<string, BoardHistory>;
  /** Record a new action; clears the redo stack for that board. */
  record: (boardId: string, entry: HistoryEntry) => void;
  undo: (boardId: string) => Promise<void>;
  redo: (boardId: string) => Promise<void>;
  /** Drop a board's history (called on reload — the snapshots are now stale). */
  clear: (boardId: string) => void;
}

const emptyBoard = (): BoardHistory => ({ undo: [], redo: [] });

export const useHistoryStore = create<HistoryState>((set, get) => ({
  boards: {},

  record: (boardId, entry) => {
    const b = get().boards[boardId] ?? emptyBoard();
    const undo = [...b.undo, entry].slice(-MAX_STEPS);
    set({ boards: { ...get().boards, [boardId]: { undo, redo: [] } } });
  },

  undo: async (boardId) => {
    const b = get().boards[boardId];
    if (!b || b.undo.length === 0) return;
    const entry = b.undo[b.undo.length - 1]!;
    // Pop before running so re-entrancy / rapid clicks can't double-apply.
    set({
      boards: {
        ...get().boards,
        [boardId]: { undo: b.undo.slice(0, -1), redo: [...b.redo, entry].slice(-MAX_STEPS) },
      },
    });
    await entry.undo();
  },

  redo: async (boardId) => {
    const b = get().boards[boardId];
    if (!b || b.redo.length === 0) return;
    const entry = b.redo[b.redo.length - 1]!;
    set({
      boards: {
        ...get().boards,
        [boardId]: { undo: [...b.undo, entry].slice(-MAX_STEPS), redo: b.redo.slice(0, -1) },
      },
    });
    await entry.redo();
  },

  clear: (boardId) => {
    if (!get().boards[boardId]) return;
    set({ boards: { ...get().boards, [boardId]: emptyBoard() } });
  },
}));
