// M1 scaffold: NOT WIRED. M4 (ALE-82) replaces with real Business Central
// analytics connector calls — `jobs (microsoft/analytics/v1.0)` and
// `jobPlanningLines (microsoft/analytics/v1.0)`. While BC admin access is
// pending we may instead query the Airtable → Dataverse mirror of BC job
// data (see docs/13). The exported shape below is the prototype contract;
// real implementations preserve it so `useJobSearch` and `AddJobPanel` port
// verbatim.

export interface BcPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
}

export interface BcJob {
  jobNo: string;
  customerName: string;
  promisedDate: string;
  planningLines: BcPlanningLine[];
}

const WARN_KEY = "__lumineo_stub_warned_bc__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[stub] bcService is not wired yet (M4 / ALE-82). " +
      "Search returns []. Replace src/services/bc.ts with the BC analytics " +
      "connector (or Airtable mirror) adapter.",
  );
}

function normalizeJobNo(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, "").toUpperCase();
  if (trimmed.startsWith("J")) return trimmed;
  return `J${trimmed}`;
}

export const bcService = {
  async searchJob(query: string): Promise<BcJob[]> {
    warnOnce();
    void normalizeJobNo(query); // preserves the call shape until real impl lands
    return [];
  },
  async getJob(_jobNo: string): Promise<BcJob | null> {
    warnOnce();
    return null;
  },
};

export type BcService = typeof bcService;
