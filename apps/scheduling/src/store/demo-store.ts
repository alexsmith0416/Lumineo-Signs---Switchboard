/**
 * Demo sandbox + interactive tutorial state.
 *
 * Entering the demo swaps every board's data source to a fresh in-memory demo
 * source (see demo-data.ts), so all edits are local and never touch the real
 * Dataverse schedules. Leaving restores each board's original (live) source.
 * Demo users (see current-user.ts) enter LOCKED — they can never leave the
 * sandbox — while anyone launching from Help enters unlocked and can exit.
 */
import { create } from "zustand";
import { makeDemoSources } from "../demo/demo-data";
import {
  useScheduleStore,
  useInstallationStoreWK,
  useInstallationStoreNEK,
  useShippingStore,
} from "./schedule-store";

/** Which guided tour is running. */
export type TutorialTrack = "scheduling" | "full";

/** null = no tutorial UI; "welcome" = the choose-a-tour card; "running" = coach-marks. */
export type TutorialPhase = null | "welcome" | "running";

interface DemoState {
  /** True while the app is showing the isolated demo sandbox. */
  demoMode: boolean;
  /** Demo users are locked in — the banner shows no Exit and exitDemo is a no-op. */
  locked: boolean;

  tutorialPhase: TutorialPhase;
  track: TutorialTrack | null;
  stepIndex: number;

  enterDemo: (opts?: { locked?: boolean; welcome?: boolean }) => void;
  exitDemo: () => void;
  openWelcome: () => void;
  startTrack: (track: TutorialTrack) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTutorial: () => void;
}

function swapToDemoSources(): void {
  const s = makeDemoSources();
  void useScheduleStore.getState().setDataSource(s.production);
  void useInstallationStoreWK.getState().setDataSource(s.wk);
  void useInstallationStoreNEK.getState().setDataSource(s.nek);
  void useShippingStore.getState().setDataSource(s.shipping);
}

function restoreLiveSources(): void {
  void useScheduleStore.getState().resetDataSource();
  void useInstallationStoreWK.getState().resetDataSource();
  void useInstallationStoreNEK.getState().resetDataSource();
  void useShippingStore.getState().resetDataSource();
}

export const useDemoStore = create<DemoState>((set, get) => ({
  demoMode: false,
  locked: false,
  tutorialPhase: null,
  track: null,
  stepIndex: 0,

  enterDemo: ({ locked = false, welcome = false } = {}) => {
    if (!get().demoMode) swapToDemoSources();
    set({
      demoMode: true,
      locked,
      tutorialPhase: welcome ? "welcome" : get().tutorialPhase,
    });
  },

  exitDemo: () => {
    if (get().locked) return; // demo users can't leave the sandbox
    restoreLiveSources();
    set({ demoMode: false, tutorialPhase: null, track: null, stepIndex: 0 });
  },

  openWelcome: () => set({ tutorialPhase: "welcome" }),
  startTrack: (track) => set({ tutorialPhase: "running", track, stepIndex: 0 }),
  nextStep: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),
  prevStep: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  endTutorial: () => set({ tutorialPhase: null, track: null, stepIndex: 0 }),
}));
