import { useEffect, useState } from "react";
import { ARCHIVED, type JobPO } from "../services/job-pos";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** Synthetic rows so the section can be seen in dev (no real vendors in the repo). */
const DEV_POS: JobPO[] = [
  { poNo: "PO-10482", vendorNo: "V0001", vendorName: "Sample Metals Supply", orderDate: "2026-09-22", status: "Released" },
  { poNo: "PO-10391", vendorNo: "V0002", vendorName: "Example Acrylics Co.", orderDate: "2026-09-08", status: ARCHIVED },
];

// Per session: a job's POs change at most nightly (the sync flow).
const cache = new Map<string, JobPO[]>();

export interface UseJobPOs {
  pos: JobPO[];
  loading: boolean;
  error: string;
}

/** A job's purchase orders (crfdf_jobpo), newest first. Loads when first used. */
export function useJobPOs(jobNo: string): UseJobPOs {
  const [state, setState] = useState<UseJobPOs>(() => {
    const hit = cache.get(jobNo);
    return { pos: hit ?? [], loading: !hit, error: "" };
  });

  useEffect(() => {
    const hit = cache.get(jobNo);
    if (hit) {
      setState({ pos: hit, loading: false, error: "" });
      return;
    }
    if (!LIVE) {
      setState({ pos: DEV_POS, loading: false, error: "" });
      return;
    }
    let alive = true;
    setState({ pos: [], loading: true, error: "" });
    void import("../services/dataverse-live")
      .then((m) => m.fetchJobPOs(jobNo))
      .then((pos) => {
        cache.set(jobNo, pos);
        if (alive) setState({ pos, loading: false, error: "" });
      })
      .catch((e: unknown) => {
        console.warn("[job POs] load failed", e);
        if (alive) setState({ pos: [], loading: false, error: "Couldn't load purchase orders" });
      });
    return () => {
      alive = false;
    };
  }, [jobNo]);

  return state;
}
