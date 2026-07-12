import { MOCK_BC_JOBS, type BcJob } from "../data/mock-bc";
import { getBcJobLive, searchBcJobsLive, type BcJobLive } from "./dataverse-live";

// Live (deployed / forced) reads the BC staging tables in Dataverse, which a
// Power Automate flow syncs from Business Central. Plain dev/tests use the mock.
// The mock is also an automatic FALLBACK: if the live read throws (Dataverse /
// BC unreachable), we serve mock data so the app keeps working.
const live = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

function normalizeJobNo(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, "").toUpperCase();
  if (trimmed.startsWith("J")) return trimmed;
  return `J${trimmed}`;
}

const toBcJob = (j: BcJobLive): BcJob => ({
  jobNo: j.jobNo,
  customerName: j.customerName,
  description: j.description,
  promisedDate: j.promisedDate,
  shipToZip: j.shipToZip,
  planningLines: j.planningLines,
});

function mockSearch(query: string): BcJob[] {
  const normalized = normalizeJobNo(query);
  return MOCK_BC_JOBS.filter((j) => j.jobNo.includes(normalized.replace("J", ""))).map((m) => ({
    ...m,
    planningLines: m.planningLines.map((p) => ({ ...p })),
  }));
}

export const bcService = {
  async searchJob(query: string): Promise<BcJob[]> {
    if (live) {
      try {
        return (await searchBcJobsLive(query)).map(toBcJob);
      } catch (e) {
        console.error("[bc] live search failed — using mock", e);
      }
    }
    return new Promise((resolve) => setTimeout(() => resolve(mockSearch(query)), 100));
  },

  async getJob(jobNo: string): Promise<BcJob | null> {
    if (live) {
      try {
        const j = await getBcJobLive(jobNo);
        if (j) return toBcJob(j);
      } catch (e) {
        console.error("[bc] live getJob failed — using mock", e);
      }
    }
    const normalized = normalizeJobNo(jobNo);
    const job = MOCK_BC_JOBS.find((j) => j.jobNo === normalized);
    return new Promise((resolve) =>
      setTimeout(() => resolve(job ? { ...job, planningLines: job.planningLines.map((p) => ({ ...p })) } : null), 50),
    );
  },
};

export type BcService = typeof bcService;
export type { BcJob, BcPlanningLine } from "../data/mock-bc";
