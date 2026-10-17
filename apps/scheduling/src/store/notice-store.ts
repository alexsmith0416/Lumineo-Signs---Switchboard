import { create } from "zustand";

/**
 * One app-wide notice with an OK button — for a rule that stopped an action
 * (e.g. "can't be scheduled past the Red Date"). Shown by <NoticeHost/> in App.
 */
export interface Notice {
  title: string;
  message: string;
}

interface NoticeState {
  notice: Notice | null;
  show: (n: Notice) => void;
  dismiss: () => void;
}

export const useNoticeStore = create<NoticeState>((set) => ({
  notice: null,
  show: (notice) => set({ notice }),
  dismiss: () => set({ notice: null }),
}));

export const showNotice = (n: Notice): void => useNoticeStore.getState().show(n);
