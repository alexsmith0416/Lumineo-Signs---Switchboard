import { create } from "zustand";
import { cloneContext } from "../engine/cascade";
import { commitScenario, computeImpact, runScenario } from "../engine/scenarios";
import { productionDataSource } from "../services/dataverse";
import type { ImpactMetrics } from "../engine/scenarios";
import type {
  ScenarioChange,
  ScenarioResult,
  ScheduleContext,
} from "../engine/types";

interface ScenarioStoreState {
  active: boolean;
  base: ScheduleContext | null;
  changes: ScenarioChange[];
  result: ScenarioResult | null;
  impact: ImpactMetrics | null;

  enter: (base: ScheduleContext) => void;
  discard: () => void;
  addChange: (change: ScenarioChange) => void;
  removeChange: (index: number) => void;
  clearChanges: () => void;
  commit: () => Promise<void>;
}

function recompute(state: ScenarioStoreState): Partial<ScenarioStoreState> {
  if (!state.base) return { result: null, impact: null };
  const result = runScenario(state.base, state.changes);
  return { result, impact: computeImpact(result) };
}

export const useScenarioStore = create<ScenarioStoreState>((set, get) => ({
  active: false,
  base: null,
  changes: [],
  result: null,
  impact: null,

  enter: (base) => {
    const snapshot = cloneContext(base);
    set({ active: true, base: snapshot, changes: [], result: null, impact: null });
  },

  discard: () => {
    set({ active: false, base: null, changes: [], result: null, impact: null });
  },

  addChange: (change) => {
    const next = [...get().changes, change];
    set({ changes: next, ...recompute({ ...get(), changes: next }) });
  },

  removeChange: (index) => {
    const next = get().changes.filter((_, i) => i !== index);
    set({ changes: next, ...recompute({ ...get(), changes: next }) });
  },

  clearChanges: () => {
    set({ changes: [], result: null, impact: null });
  },

  commit: async () => {
    const { base, result } = get();
    if (!base || !result) return;
    const { patches } = commitScenario(base, result);
    await Promise.all(
      patches.map((p) => {
        if (p.isInsert) {
          return productionDataSource.createScheduleLine(p.changes as any);
        }
        return productionDataSource.updateScheduleLine(p.lineId, p.changes);
      }),
    );
    set({ active: false, base: null, changes: [], result: null, impact: null });
  },
}));
