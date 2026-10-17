import { create } from "zustand";

/**
 * Small chips a board hangs on its cards by card id (e.g. Production's
 * "→ HUT": this NEK card's job also goes through Hutchinson production). Set
 * by the board, read by JobCard — no prop threading through the calendar.
 */
export interface CardBadge {
  text: string;
  title: string;
}

interface CardBadgesState {
  byLine: ReadonlyMap<string, CardBadge>;
  setAll: (byLine: ReadonlyMap<string, CardBadge>) => void;
}

export const useCardBadgesStore = create<CardBadgesState>((set) => ({
  byLine: new Map(),
  setAll: (byLine) => set({ byLine }),
}));

export const useCardBadge = (lineId: string): CardBadge | undefined =>
  useCardBadgesStore((s) => s.byLine.get(lineId));
