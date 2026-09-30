import { useEffect, useMemo, useState } from "react";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { computeJobTargets, type JobTargets } from "../services/job-schedule-data";
import { leadTimeFor, type LeadTime, type LeadTimeRule } from "../services/lead-times";
import { includedStepDefs } from "../services/production-steps";
import { useLeadTimeStore } from "../store/lead-time-store";
import { useJobDeptOverrideStore } from "../store/job-dept-override-store";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

export interface UseJobTargets {
  targets: JobTargets;
  /** The anchor date driving the targets (manual override on the schedule row,
   *  else the BC order-release date). */
  released: Date | null;
  /** The job's lead time and the rule that set it (null = the default). */
  lead: LeadTime & { rule: LeadTimeRule | null };
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
  const [stepInfo, setStepInfo] = useState<{ production: string[]; hasInstall: boolean } | null>(null);
  const [bcReleased, setBcReleased] = useState<Date | null>(null);
  const rules = useLeadTimeStore((s) => s.rules);
  const loadRules = useLeadTimeStore((s) => s.load);
  const overrides = useJobDeptOverrideStore((s) => (jobNo ? s.byJob[jobNo] : undefined));
  const loadOverrides = useJobDeptOverrideStore((s) => s.load);

  useEffect(() => {
    void load();
    void loadRules();
    void loadOverrides();
  }, [load, loadRules, loadOverrides]);

  useEffect(() => {
    if (!LIVE || !jobNo) return;
    let alive = true;
    void import("../services/dataverse-live").then(async (m) => {
      try {
        const [info, rel] = await Promise.all([m.jobStepInfo(jobNo), m.jobReleaseDate(jobNo)]);
        if (!alive) return;
        setStepInfo(info);
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
  // The lead time follows the job's stepper steps (editor overrides included).
  const lead = useMemo(() => {
    const keys = stepInfo
      ? includedStepDefs(stepInfo.production, stepInfo.hasInstall, overrides ?? {}).map((d) => d.key)
      : [];
    return leadTimeFor(keys, rules);
  }, [stepInfo, overrides, rules]);
  const targets = useMemo(
    () =>
      computeJobTargets({
        released,
        lead,
        redDate: sched?.redDate ?? null,
        scheduledInstall: sched?.scheduledInstallDate ?? null,
        productionOverride: sched?.productionCompleteDate ?? null,
      }),
    [released, lead, sched?.redDate, sched?.scheduledInstallDate, sched?.productionCompleteDate],
  );

  return {
    targets,
    released,
    lead,
    redDate: sched?.redDate ?? null,
    scheduledInstall: sched?.scheduledInstallDate ?? null,
  };
}
