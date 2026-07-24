import { useEffect, useMemo, useState } from "react";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { computeJobTargets, type JobTargets } from "../services/job-schedule-data";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export interface UseJobTargets {
  targets: JobTargets;
  /** The anchor date driving the targets (manual override on the schedule row,
   *  else the BC order-release date). */
  released: Date | null;
  vinylOnly: boolean;
  /** Committed install dates (for the red bar + scheduled-install display). */
  redDate: Date | null;
  scheduledInstall: Date | null;
}

/**
 * Computes a job's target dates (production complete + install window) the same
 * way everywhere — the Edit Job panel and every card's hover tooltip. Anchored
 * on the BC order-release date (with an optional in-app override), and folding
 * in the Red date, a committed scheduled install, and a manual production
 * override. See computeJobTargets for the precedence + working-day rules.
 */
export function useJobTargets(jobNo: string | undefined): UseJobTargets {
  const sched = useJobScheduleStore((s) => (jobNo ? s.byJob[jobNo] : undefined));
  const load = useJobScheduleStore((s) => s.load);
  const [vinylOnly, setVinylOnly] = useState(false);
  const [bcReleased, setBcReleased] = useState<Date | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!LIVE || !jobNo) return;
    let alive = true;
    void import("../services/dataverse-live").then(async (m) => {
      try {
        const [depts, rel] = await Promise.all([
          m.jobProductionDepartments(jobNo),
          m.jobReleaseDate(jobNo),
        ]);
        if (!alive) return;
        setVinylOnly(depts.length > 0 && depts.every((d) => /vinyl|graphic/i.test(d)));
        setBcReleased(rel);
      } catch {
        /* leave defaults */
      }
    });
    return () => {
      alive = false;
    };
  }, [jobNo]);

  const released = sched?.releasedDate ?? bcReleased;
  const targets = useMemo(
    () =>
      computeJobTargets({
        released,
        vinylOnly,
        redDate: sched?.redDate ?? null,
        scheduledInstall: sched?.scheduledInstallDate ?? null,
        productionOverride: sched?.productionCompleteDate ?? null,
      }),
    [released, vinylOnly, sched?.redDate, sched?.scheduledInstallDate, sched?.productionCompleteDate],
  );

  return {
    targets,
    released,
    vinylOnly,
    redDate: sched?.redDate ?? null,
    scheduledInstall: sched?.scheduledInstallDate ?? null,
  };
}
