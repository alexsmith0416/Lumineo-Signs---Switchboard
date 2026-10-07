import { useEffect } from "react";
import { create } from "zustand";
import { isServiceOrderType } from "../services/service-steps";

/**
 * Each open job's BC Order Type (crfdf_jobdesc.crfdf_ordertype — see
 * services/service-steps.ts). SERVICE / SIGNCONT / MNTCCONT jobs get the
 * Service stepper. Read-only, loaded once (one read for every job).
 * Until the column exists (scripts/add-jobdesc-ordertype-column.ps1) or the
 * flow has filled it, no job is a service job — everything works as before.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

interface ServiceJobsState {
  orderTypes: ReadonlyMap<string, string>;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useServiceJobsStore = create<ServiceJobsState>((set, get) => ({
  orderTypes: new Map(),
  loaded: false,
  load: (force = false) => {
    if (get().loaded && !force) return Promise.resolve();
    if (inflight) return inflight;
    if (!LIVE) {
      // Dev: the synthetic jobs carried over as Airtable "Service" are SERVICE orders.
      return import("../data/mock-job-tracking").then(({ MOCK_JOB_TRACKS }) => {
        set({
          orderTypes: new Map(MOCK_JOB_TRACKS.filter((t) => t.legacyProcess === "Service").map((t) => [t.jobNo, "SERVICE"])),
          loaded: true,
        });
      });
    }
    inflight = (async () => {
      try {
        set({ orderTypes: await (await import("../services/dataverse-live")).fetchJobOrderTypes(), loaded: true });
      } catch (e) {
        console.warn("[service-jobs] order types not available yet (column not created?)", e);
        set({ loaded: true });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
}));

/** Is this a service / contract job? (Synchronous — false until loaded.) */
export function isServiceJob(jobNo: string | undefined): boolean {
  return !!jobNo && isServiceOrderType(useServiceJobsStore.getState().orderTypes.get(jobNo));
}

/** The job's BC Order Type ("" when unknown). */
export function orderTypeOf(jobNo: string | undefined): string {
  return (jobNo && useServiceJobsStore.getState().orderTypes.get(jobNo)) || "";
}

/** React: is this a service job, re-rendering when the order types load. */
export function useIsServiceJob(jobNo: string | undefined): boolean {
  const type = useServiceJobsStore((s) => (jobNo ? s.orderTypes.get(jobNo) : undefined));
  const load = useServiceJobsStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return isServiceOrderType(type);
}
