import { addBusinessDays, addWeeks, isWeekend, nextMonday } from "date-fns";

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
   *  date → manual override → release + 7 wk (4 wk vinyl/graphics-only). */
  targetProductionComplete: Date | null;
  /** Estimated install window: the working day after production complete, then a
   *  3-week span. Null once install is committed (Red or Scheduled install). */
  installWindowStart: Date | null;
  installWindowEnd: Date | null;
}

// Lead times (weeks). Constants for now; a Settings-backed table can replace
// these later without touching callers.
export const LEAD_TIMES = {
  productionWeeks: 7,
  vinylProductionWeeks: 4,
  installWindowWeeks: 3,
} as const;

/** Roll a weekend target FORWARD to Monday (never back to Friday). */
const forwardWorkingDay = (d: Date): Date => (isWeekend(d) ? nextMonday(d) : d);

export interface JobTargetsInput {
  released: Date | null;
  vinylOnly: boolean;
  redDate?: Date | null;
  scheduledInstall?: Date | null;
  productionOverride?: Date | null;
}

export function computeJobTargets(input: JobTargetsInput): JobTargets {
  const { released, vinylOnly, redDate = null, scheduledInstall = null, productionOverride = null } = input;

  // Production complete target — a Red date always wins (production must finish
  // before the drop-dead install), then a manual override, else release + the
  // lead time (rolled forward off a weekend).
  let prod: Date | null;
  if (redDate) prod = addBusinessDays(redDate, -1); // the working day before the Red date
  else if (productionOverride) prod = productionOverride;
  else if (released)
    prod = forwardWorkingDay(
      addWeeks(released, vinylOnly ? LEAD_TIMES.vinylProductionWeeks : LEAD_TIMES.productionWeeks),
    );
  else prod = null;

  if (!prod) {
    return { targetProductionComplete: null, installWindowStart: null, installWindowEnd: null };
  }

  // Install window only when install isn't already committed to a fixed day.
  const committed = redDate ?? scheduledInstall;
  if (committed) {
    return { targetProductionComplete: prod, installWindowStart: null, installWindowEnd: null };
  }
  const start = addBusinessDays(prod, 1); // the working day after production
  const end = forwardWorkingDay(addWeeks(start, LEAD_TIMES.installWindowWeeks));
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
