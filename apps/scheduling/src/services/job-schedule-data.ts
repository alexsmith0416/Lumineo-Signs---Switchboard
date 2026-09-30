import { addBusinessDays, addWeeks } from "date-fns";
import { DEFAULT_LEAD_TIME, forwardWorkingDay, type LeadTime } from "./lead-times";

/**
 * Per-job scheduling data (crfdf_jobschedule) + derived target dates.
 *
 * releasedDate is the anchor for automated scheduling — the BC order-release
 * date (crfdf_bcjobs.crfdf_releasedate ← sign365 icgSgpOrderReleasedDate; also
 * editable in-app). From it we COMPUTE the production target + install window.
 * productionCompleteDate is a manual override of the computed production target.
 * scheduledInstallDate and redDate are app-entered.
 */
export interface JobSchedule {
  jobNo: string;
  releasedDate: Date | null;
  /** Manual override of the computed production-complete target. */
  productionCompleteDate: Date | null;
  scheduledInstallDate: Date | null;
  redDate: Date | null;
}

export interface JobTargets {
  /** When production should be done. Precedence: the working day before a Red
   *  date → manual override → release + the job's production lead time
   *  (lead-times.ts: 7 wk by default, or the matching lead-time rule). */
  targetProductionComplete: Date | null;
  /** Estimated install window: the working day after production complete, then
   *  the gap between the install and production lead times (3 weeks by default).
   *  Null once install is committed (Red or Scheduled install). */
  installWindowStart: Date | null;
  installWindowEnd: Date | null;
}

export interface JobTargetsInput {
  released: Date | null;
  /** The job's lead time (lead-times.ts `leadTimeFor`); default 7 / 10 weeks. */
  lead?: LeadTime;
  redDate?: Date | null;
  scheduledInstall?: Date | null;
  productionOverride?: Date | null;
}

export function computeJobTargets(input: JobTargetsInput): JobTargets {
  const { released, lead = DEFAULT_LEAD_TIME, redDate = null, scheduledInstall = null, productionOverride = null } = input;

  // A committed install date (Red always wins, else a Scheduled install) pulls
  // the production target to the working day BEFORE it — production must finish
  // before install. Otherwise: manual override, else release + the lead time
  // (rolled forward off a weekend).
  const committed = redDate ?? scheduledInstall;
  let prod: Date | null;
  if (committed) prod = addBusinessDays(committed, -1); // the working day before install
  else if (productionOverride) prod = productionOverride;
  else if (released)
    prod = forwardWorkingDay(addWeeks(released, lead.productionWeeks));
  else prod = null;

  if (!prod) {
    return { targetProductionComplete: null, installWindowStart: null, installWindowEnd: null };
  }

  // Install window only when install isn't already committed to a fixed day.
  if (committed) {
    return { targetProductionComplete: prod, installWindowStart: null, installWindowEnd: null };
  }
  const start = addBusinessDays(prod, 1); // the working day after production
  const end = forwardWorkingDay(addWeeks(start, Math.max(1, lead.installWeeks - lead.productionWeeks)));
  return { targetProductionComplete: prod, installWindowStart: start, installWindowEnd: end };
}

export const emptyJobSchedule = (jobNo: string): JobSchedule => ({
  jobNo,
  releasedDate: null,
  productionCompleteDate: null,
  scheduledInstallDate: null,
  redDate: null,
});

export interface JobScheduleDataSource {
  loadAll(): Promise<JobSchedule[]>;
  /** Create/update the single row for a job (keyed by jobNo). */
  upsert(schedule: JobSchedule): Promise<void>;
}

// --- Live source (Dataverse) -------------------------------------------------
const liveJobScheduleDataSource: JobScheduleDataSource = {
  async loadAll() {
    const m = await import("./dataverse-live");
    return m.fetchJobSchedules();
  },
  async upsert(schedule) {
    const m = await import("./dataverse-live");
    await m.upsertJobSchedule(schedule);
  },
};

// --- Mock source (dev / tests) — in-memory -----------------------------------
function createMockJobScheduleDataSource(): JobScheduleDataSource {
  const byJob = new Map<string, JobSchedule>();
  return {
    async loadAll() {
      return [...byJob.values()].map((s) => ({ ...s }));
    },
    async upsert(schedule) {
      byJob.set(schedule.jobNo, { ...schedule });
    },
  };
}

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
let _mock: JobScheduleDataSource | null = null;

export function getJobScheduleDataSource(): JobScheduleDataSource {
  if (LIVE) return liveJobScheduleDataSource;
  if (!_mock) _mock = createMockJobScheduleDataSource();
  return _mock;
}
