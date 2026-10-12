import { create } from "zustand";

/**
 * A hand-off into the Install Planner from another Installation tool
 * (Monthly Gameplanning, Oct 11, 2026): open on a given week, open Auto-plan
 * for it, or show just a set of jobs on the map ("Show on map" from a pool).
 * The planner reads it once when it opens, then clears it.
 */
interface PlannerNavState {
  weekStart: Date | null;
  openAutoPlan: boolean;
  focus: { label: string; jobNos: string[] } | null;
  go: (to: { weekStart?: Date; openAutoPlan?: boolean; focus?: { label: string; jobNos: string[] } }) => void;
  take: () => { weekStart: Date | null; openAutoPlan: boolean; focus: { label: string; jobNos: string[] } | null };
}

export const usePlannerNav = create<PlannerNavState>((set, get) => ({
  weekStart: null,
  openAutoPlan: false,
  focus: null,
  go: (to) => set({ weekStart: to.weekStart ?? null, openAutoPlan: !!to.openAutoPlan, focus: to.focus ?? null }),
  take: () => {
    const { weekStart, openAutoPlan, focus } = get();
    set({ weekStart: null, openAutoPlan: false, focus: null });
    return { weekStart, openAutoPlan, focus };
  },
}));
