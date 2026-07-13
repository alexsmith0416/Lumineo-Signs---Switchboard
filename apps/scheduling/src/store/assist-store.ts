import { create } from "zustand";
import { fetchAssistRows, type AssistAssignment } from "../services/dataverse-live";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

interface AssistState {
  rows: AssistAssignment[];
  refresh: () => Promise<void>;
}

/** Temporary "assist installation" assignments (production employees lent to an
 *  install board). The production calendar greys the source employee's days;
 *  the assign dialog refreshes this after create/remove. */
export const useAssistStore = create<AssistState>((set) => ({
  rows: [],
  refresh: async () => {
    if (!LIVE) return;
    try {
      set({ rows: await fetchAssistRows() });
    } catch {
      /* leave prior rows on failure */
    }
  },
}));
