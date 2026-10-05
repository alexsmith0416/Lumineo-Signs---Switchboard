import { useEffect, useState } from "react";
import { NO_DESCRIPTIONS, type JobDescriptions } from "../services/job-descriptions";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** Synthetic text so the sections can be seen in dev (no real job text in the repo). */
const DEV_DESCRIPTIONS: JobDescriptions = {
  field: "Sample field description.\nCall the site contact 30 minutes before arrival.",
  production: "Sample production description.\n  Paint: sample colour\n  (2) mounting brackets",
  extended: "Sample extended description used on proposals.",
};

// Per session: the flow refreshes them hourly; one read per job is plenty.
const cache = new Map<string, JobDescriptions>();
const inflight = new Map<string, Promise<JobDescriptions>>();

export interface UseJobDescriptions {
  desc: JobDescriptions;
  loading: boolean;
  error: string;
}

function load(jobNo: string): Promise<JobDescriptions> {
  let p = inflight.get(jobNo);
  if (!p) {
    p = import("../services/dataverse-live")
      .then((m) => m.fetchJobDescriptions(jobNo))
      .then((d) => {
        cache.set(jobNo, d);
        return d;
      })
      .finally(() => inflight.delete(jobNo));
    inflight.set(jobNo, p);
  }
  return p;
}

/**
 * A job's Field / Production / Extended Description (crfdf_jobdesc). The three
 * sections share one read — whichever is opened first loads it.
 */
export function useJobDescriptions(jobNo: string): UseJobDescriptions {
  const [state, setState] = useState<UseJobDescriptions>(() => {
    const hit = cache.get(jobNo);
    return { desc: hit ?? NO_DESCRIPTIONS, loading: !hit, error: "" };
  });

  useEffect(() => {
    const hit = cache.get(jobNo);
    if (hit) {
      setState({ desc: hit, loading: false, error: "" });
      return;
    }
    if (!LIVE) {
      setState({ desc: DEV_DESCRIPTIONS, loading: false, error: "" });
      return;
    }
    let alive = true;
    setState({ desc: NO_DESCRIPTIONS, loading: true, error: "" });
    load(jobNo)
      .then((desc) => {
        if (alive) setState({ desc, loading: false, error: "" });
      })
      .catch((e: unknown) => {
        console.warn("[job descriptions] load failed", e);
        if (alive) setState({ desc: NO_DESCRIPTIONS, loading: false, error: "Couldn't load the description" });
      });
    return () => {
      alive = false;
    };
  }, [jobNo]);

  return state;
}
