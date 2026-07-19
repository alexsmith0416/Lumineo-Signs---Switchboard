import { addWeeks } from "date-fns";

/**
 * Per-job scheduling data (crfdf_jobschedule) + derived target dates.
 *
 * releasedDate is the anchor for automated scheduling — the day the job first
 * hit BC status "Open" (stamped by the BCSync flow; also editable in-app). From
 * it we COMPUTE the production target + the estimated install window, so those
 * aren't stored. scheduledInstallDate and redDate are app-entered.
 */
export interface JobSchedule {
  jobNo: string;
  releasedDate: Date | null;
  scheduledInstallDate: Date | null;
  redDate: Date | null;
}

export interface JobTargets {
  /** Production should be done by release + 7 wk (or + 4 wk for vinyl/graphics-only). */
  targetProductionComplete: Date | null;
  /** Estimated install window: release + 8 wk … + 10 wk (a 3-week buffer). */
  installWindowStart: Date | null;
  installWindowEnd: Date | null;
}

// Lead times (weeks from release). Constants for now; a Settings-backed table
// can replace these later without touching callers.
export const LEAD_TIMES = {
  productionWeeks: 7,
  vinylProductionWeeks: 4,
  installWindowStartWeeks: 8,
  installWindowEndWeeks: 10,
} as const;

export function computeJobTargets(released: Date | null, vinylOnly: boolean): JobTargets {
  if (!released) {
    return { targetProductionComplete: null, installWindowStart: null, installWindowEnd: null };
  }
  return {
    targetProductionComplete: addWeeks(
      released,
      vinylOnly ? LEAD_TIMES.vinylProductionWeeks : LEAD_TIMES.productionWeeks,
    ),
    installWindowStart: addWeeks(released, LEAD_TIMES.installWindowStartWeeks),
    installWindowEnd: addWeeks(released, LEAD_TIMES.installWindowEndWeeks),
  };
}

export const emptyJobSchedule = (jobNo: string): JobSchedule => ({
  jobNo,
  releasedDate: null,
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
