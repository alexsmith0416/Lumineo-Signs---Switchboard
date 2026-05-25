import { create, type StoreApi, type UseBoundStore } from "zustand";
import { cloneContext } from "../engine/cascade";
import { commitScenario, computeImpact, runScenario } from "../engine/scenarios";
import { productionDataSource } from "../services/dataverse";
import {
  nekInstallDataSource,
  wkInstallDataSource,
} from "../services/installation-data";
import { shippingDataSource } from "../services/shipping-data";
import type { ImpactMetrics } from "../engine/scenarios";
import type { ScheduleDataSource } from "../services/data-source";
import type {
  ScenarioChange,
  ScenarioResult,
  ScheduleContext,
} from "../engine/types";

export interface ScenarioStoreState {
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

export type UseScenarioStore = UseBoundStore<StoreApi<ScenarioStoreState>>;

function recompute(state: ScenarioStoreState): Partial<ScenarioStoreState> {
  if (!state.base) return { result: null, impact: null };
  const result = runScenario(state.base, state.changes);
  return { result, impact: computeImpact(result) };
}

/** Factory — every calendar that wants its own sandbox gets its own store
 *  bound to its own data source so Commit writes to the right place. */
export function createScenarioStore(dataSource: ScheduleDataSource): UseScenarioStore {
  return create<ScenarioStoreState>((set, get) => ({
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
            return dataSource.createScheduleLine(p.changes as any);
          }
          return dataSource.updateScheduleLine(p.lineId, p.changes);
        }),
      );
      set({ active: false, base: null, changes: [], result: null, impact: null });
    },
  }));
}

// One scenario sandbox per calendar surface. The original
// `useScenarioStore` alias remains so existing imports keep working —
// it points at the production sandbox.
export const useProductionScenarioStore = createScenarioStore(productionDataSource);
export const useScenarioStore = useProductionScenarioStore;
export const useInstallationScenarioStoreWK = createScenarioStore(wkInstallDataSource);
export const useInstallationScenarioStoreNEK = createScenarioStore(nekInstallDataSource);
export const useShippingScenarioStore = createScenarioStore(shippingDataSource);
