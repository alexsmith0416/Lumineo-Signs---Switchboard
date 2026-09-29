import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import type { BillingPeriodRow } from "../services/billing-periods";

/**
 * Billing periods (crfdf_billingperiod) — each month's billing cut-off date and
 * goal, shared by everyone. Edited in Settings → Billing periods by Admin /
 * Developer / Ops; read by the Installation board's "Billing · month" stat and
 * the Monthly Plan. Writes are optimistic: a failed save keeps the edit on
 * screen and reports it (write-path invariant, START-HERE.md).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export interface BillingPeriodDeps {
  load: () => Promise<BillingPeriodRow[]>;
  save: (row: BillingPeriodRow) => Promise<unknown>;
}

interface BillingPeriodState {
  rows: BillingPeriodRow[];
  loaded: boolean;
  loading: boolean;
  load: (force?: boolean) => Promise<void>;
  /** Set a month's cut-off and/or goal (null clears it back to the default). */
  setPeriod: (month: string, patch: Partial<Omit<BillingPeriodRow, "month">>) => Promise<void>;
}

export function createBillingPeriodStore(deps: BillingPeriodDeps | null) {
  return create<BillingPeriodState>((set, get) => ({
    rows: [],
    loaded: false,
    loading: false,

    load: async (force = false) => {
      if (get().loading || (get().loaded && !force)) return;
      set({ loading: true });
      if (!deps) {
        set({ loaded: true, loading: false });
        return;
      }
      try {
        set({ rows: await deps.load(), loaded: true, loading: false });
      } catch (e) {
        console.error("[billing-periods] load failed", e);
        set({ loaded: true, loading: false });
      }
    },

    setPeriod: async (month, patch) => {
      const existing = get().rows.find((r) => r.month === month);
      const row: BillingPeriodRow = { month, cutoff: null, goal: null, ...existing, ...patch };
      set((s) => ({ rows: [...s.rows.filter((r) => r.month !== month), row] }));
      if (!deps) return;
      await persistOrReport("Save billing period", () => deps.save(row));
    },
  }));
}

export const useBillingPeriodStore = createBillingPeriodStore(
  LIVE
    ? {
        load: async () => (await import("../services/dataverse-live")).fetchBillingPeriods(),
        save: async (row) => (await import("../services/dataverse-live")).saveBillingPeriod(row),
      }
    : null,
);
