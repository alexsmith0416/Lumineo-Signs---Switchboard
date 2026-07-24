import { create } from "zustand";
import type { ScheduleLine } from "../engine/types";

/**
 * A one-slot clipboard for copy/paste of job cards. Copy stores a snapshot of a
 * card; paste (right-click a day cell, or Ctrl+V while hovering one) duplicates
 * all of its fields onto the target person + day. Shared across boards so a card
 * copied on one board can be pasted on another.
 */
interface ClipboardState {
  card: ScheduleLine | null;
  copy: (line: ScheduleLine) => void;
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  card: null,
  copy: (line) => set({ card: { ...line } }),
  clear: () => set({ card: null }),
}));
