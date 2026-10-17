import { create } from "zustand";
import type { ScheduleLine } from "../engine/types";

/**
 * The job-card clipboard. Copy stores a snapshot of one card — or several
 * (Ctrl+click selection); paste (right-click a day cell, or Ctrl+V while
 * hovering one) duplicates all their fields onto the target person + day.
 * Shared across boards so a card copied on one board can be pasted on another.
 */
interface ClipboardState {
  /** The first copied card (single-card callers). */
  card: ScheduleLine | null;
  /** Every copied card. */
  cards: ScheduleLine[];
  copy: (line: ScheduleLine) => void;
  copyMany: (lines: readonly ScheduleLine[]) => void;
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  card: null,
  cards: [],
  copy: (line) => set({ card: { ...line }, cards: [{ ...line }] }),
  copyMany: (lines) => set({ card: lines[0] ? { ...lines[0] } : null, cards: lines.map((l) => ({ ...l })) }),
  clear: () => set({ card: null, cards: [] }),
}));
