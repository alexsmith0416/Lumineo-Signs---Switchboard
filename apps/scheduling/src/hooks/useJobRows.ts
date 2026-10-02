import { useEffect, useMemo } from "react";
import { useJobTrackingStore } from "../store/job-tracking-store";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { useLeadTimeStore } from "../store/lead-time-store";
import { useJobDeptOverrideStore } from "../store/job-dept-override-store";
import { buildJobRows, type JobRow, type JobScheduleDates } from "../services/job-tracking";
import { leadTimeFor } from "../services/lead-times";
import { includedStepDefs } from "../services/production-steps";

const ymd = (d: Date | null | undefined): string =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";

/**
 * The Jobs list's rows (BC jobs + tracking + the shared install dates + lead
 * times), loading what they need. Used by the Jobs view and Monthly Gameplanning
 * so both see the same dates and targets.
 */
export function useJobRows(): JobRow[] {
  const bcJobs = useJobTrackingStore((s) => s.bcJobs);
  const tracks = useJobTrackingStore((s) => s.tracks);
  const invoiceByJob = useJobTrackingStore((s) => s.invoiceByJob);
  const stepInfo = useJobTrackingStore((s) => s.stepInfo);
  const load = useJobTrackingStore((s) => s.load);
  const leadRules = useLeadTimeStore((s) => s.rules);
  const loadLeadRules = useLeadTimeStore((s) => s.load);
  const deptOverrides = useJobDeptOverrideStore((s) => s.byJob);
  const loadDeptOverrides = useJobDeptOverrideStore((s) => s.load);
  // Dates come from the SAME job-schedule store the boards' Install Dates use,
  // so an edit anywhere shows everywhere at once.
  const scheduleByJob = useJobScheduleStore((s) => s.byJob);
  const loadSchedules = useJobScheduleStore((s) => s.load);
  useEffect(() => {
    void load();
    void loadSchedules();
    void loadLeadRules();
    void loadDeptOverrides();
  }, [load, loadSchedules, loadLeadRules, loadDeptOverrides]);

  return useMemo(() => {
    const dates = new Map<string, JobScheduleDates>();
    for (const [jobNo, sch] of Object.entries(scheduleByJob)) {
      dates.set(jobNo, {
        redDate: ymd(sch.redDate),
        productionCompleteDate: ymd(sch.productionCompleteDate),
        releasedDate: ymd(sch.releasedDate),
        scheduledInstallDate: ymd(sch.scheduledInstallDate),
      });
    }
    // Each job's lead time follows its stepper steps (lead-time rules, Settings).
    const leadFor = (jobNo: string) => {
      const info = stepInfo.get(jobNo);
      const keys = info ? includedStepDefs(info.production, info.hasInstall, deptOverrides[jobNo] ?? {}).map((d) => d.key) : [];
      return leadTimeFor(keys, leadRules);
    };
    return buildJobRows(bcJobs, tracks, dates, new Date(), invoiceByJob, leadFor);
  }, [bcJobs, tracks, scheduleByJob, invoiceByJob, stepInfo, deptOverrides, leadRules]);
}
