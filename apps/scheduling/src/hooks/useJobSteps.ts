import { useEffect, useMemo, useState } from "react";
import type { DepartmentStep } from "../components/DepartmentStepper";
import { buildDepartmentSteps } from "../services/production-steps";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";
import { useJobDeptOverrideStore } from "../store/job-dept-override-store";
import { useStepOrder } from "../store/job-flow-store";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export type JobStepInfo = { production: string[]; hasInstall: boolean };

// Cache jobStepInfo per job number — a card hover shouldn't refetch the job's
// planning lines every time, and the same job appears on many cards.
const infoCache = new Map<string, JobStepInfo>();

/** A job's step info if it's already loaded (e.g. by the Jobs list), else undefined. */
export function cachedJobStepInfo(jobNo: string): JobStepInfo | undefined {
  return infoCache.get(jobNo);
}

// While the Jobs list's bulk stepper read is running, rows wait for it instead
// of each fetching their own planning lines.
let bulkPending: Promise<unknown> | null = null;
export function setBulkStepInfoPending(p: Promise<unknown> | null): void {
  bulkPending = p;
}

/** Pre-fill the cache for many jobs at once (e.g. the Jobs list's bulk load),
 *  so their steppers draw without a request each. Existing entries are kept. */
export function primeJobStepInfo(all: ReadonlyMap<string, JobStepInfo>): void {
  for (const [jobNo, info] of all) if (!infoCache.has(jobNo)) infoCache.set(jobNo, info);
}

/**
 * The production stepper steps for a job (departments in flow order + Install,
 * with completed / active / included state), sharing the completion + override
 * stores and caching the per-job planning-line lookup. Pass `undefined` for a
 * card with no real BC job (custom / shipment / group) — returns empty steps.
 */
export function useJobSteps(jobNo: string | undefined): {
  info: JobStepInfo | null;
  steps: DepartmentStep[];
} {
  const [info, setInfo] = useState<JobStepInfo | null>(() =>
    jobNo ? infoCache.get(jobNo) ?? null : null,
  );

  useEffect(() => {
    if (!jobNo) {
      setInfo(null);
      return;
    }
    const cached = infoCache.get(jobNo);
    if (cached) {
      setInfo(cached);
      return;
    }
    if (!LIVE) {
      const empty: JobStepInfo = { production: [], hasInstall: false };
      infoCache.set(jobNo, empty);
      setInfo(empty);
      return;
    }
    let alive = true;
    const pending = bulkPending;
    void (pending ? pending.catch(() => undefined) : Promise.resolve())
      .then(() => {
        const primed = infoCache.get(jobNo);
        if (primed) return primed;
        return import("../services/dataverse-live").then((m) => m.jobStepInfo(jobNo));
      })
      .then((d) => {
        infoCache.set(jobNo, d);
        if (alive) setInfo(d);
      })
      .catch(() => {
        if (alive) setInfo({ production: [], hasInstall: false });
      });
    return () => {
      alive = false;
    };
  }, [jobNo]);

  const loadCompletions = useJobDeptCompletionStore((s) => s.load);
  const completions = useJobDeptCompletionStore((s) => (jobNo ? s.byJob[jobNo] : undefined));
  const loadOverrides = useJobDeptOverrideStore((s) => s.load);
  const overrides = useJobDeptOverrideStore((s) => (jobNo ? s.byJob[jobNo] : undefined));
  useEffect(() => {
    void loadCompletions();
    void loadOverrides();
  }, [loadCompletions, loadOverrides]);

  const order = useStepOrder(jobNo);
  const steps = useMemo(() => {
    if (!info) return [];
    const completed = new Set(Object.keys(completions ?? {}));
    return buildDepartmentSteps(info.production, completed, info.hasInstall, overrides ?? {}, order);
  }, [info, completions, overrides, order]);

  return { info, steps };
}
