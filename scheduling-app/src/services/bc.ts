import { MOCK_BC_JOBS, type BcJob } from "../data/mock-bc";

// STUB: replace with real Business Central analytics connector.

function normalizeJobNo(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, "").toUpperCase();
  if (trimmed.startsWith("J")) return trimmed;
  return `J${trimmed}`;
}

export const bcService = {
  async searchJob(query: string): Promise<BcJob[]> {
    const normalized = normalizeJobNo(query);
    const matches = MOCK_BC_JOBS.filter((j) => j.jobNo.includes(normalized.replace("J", "")));
    return new Promise((resolve) => setTimeout(() => resolve(matches.map((m) => ({ ...m, planningLines: m.planningLines.map((p) => ({ ...p })) }))), 100));
  },

  async getJob(jobNo: string): Promise<BcJob | null> {
    const normalized = normalizeJobNo(jobNo);
    const job = MOCK_BC_JOBS.find((j) => j.jobNo === normalized);
    return new Promise((resolve) => setTimeout(() => resolve(job ? { ...job, planningLines: job.planningLines.map((p) => ({ ...p })) } : null), 50));
  },
};

export type BcService = typeof bcService;
export type { BcJob, BcPlanningLine } from "../data/mock-bc";
