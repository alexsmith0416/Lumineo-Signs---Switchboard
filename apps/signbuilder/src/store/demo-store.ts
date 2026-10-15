/**
 * Demo sandbox + interactive tutorial state (same model as Switchboard).
 *
 * Entering the demo swaps the storage to an in-memory copy of the current setup
 * plus sample specs (demo/demo-data.ts), so nothing touches the real data.
 * Leaving restores the real storage and reloads. Demo-type logins enter LOCKED
 * (no Exit); anyone launching from Help can exit.
 */
import { create } from "zustand";
import { makeDemoSeed } from "../demo/demo-data";
import { createMockRepo, repo, setRepoOverride } from "../services/repo";
import { useSetupStore } from "./setup-store";
import { useSpecStore } from "./spec-store";
import { DEMO_SETUP } from "../data/demo-setup";

export type TutorialTrack = "builder" | "full";
export type TutorialPhase = null | "welcome" | "running";

interface DemoState {
  demoMode: boolean;
  locked: boolean;
  tutorialPhase: TutorialPhase;
  track: TutorialTrack | null;
  stepIndex: number;
  enterDemo: (opts?: { locked?: boolean; welcome?: boolean }) => Promise<void>;
  exitDemo: () => Promise<void>;
  openWelcome: () => void;
  startTrack: (track: TutorialTrack) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTutorial: () => void;
}

async function reloadAll(): Promise<void> {
  await useSetupStore.getState().load();
  await useSpecStore.getState().load();
}

export const useDemoStore = create<DemoState>((set, get) => ({
  demoMode: false,
  locked: false,
  tutorialPhase: null,
  track: null,
  stepIndex: 0,

  enterDemo: async ({ locked = false, welcome = false } = {}) => {
    if (!get().demoMode) {
      const setup = useSetupStore.getState().setup ?? DEMO_SETUP;
      // Reference images aren't copied — the sandbox reads them from the real repo.
      setRepoOverride(createMockRepo(null, makeDemoSeed(setup), repo()));
      await reloadAll();
    }
    set({ demoMode: true, locked, tutorialPhase: welcome ? "welcome" : get().tutorialPhase });
  },

  exitDemo: async () => {
    if (get().locked) return;
    setRepoOverride(null);
    set({ demoMode: false, tutorialPhase: null, track: null, stepIndex: 0 });
    await reloadAll();
  },

  openWelcome: () => set({ tutorialPhase: "welcome" }),
  startTrack: (track) => set({ tutorialPhase: "running", track, stepIndex: 0 }),
  nextStep: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),
  prevStep: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  endTutorial: () => set({ tutorialPhase: null, track: null, stepIndex: 0 }),
}));
