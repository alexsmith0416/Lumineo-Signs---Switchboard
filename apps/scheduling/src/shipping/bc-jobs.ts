// Mock BC job lookup for the Add-Item job search. In production this is replaced
// by a Business Central query; the shape (jobNo + customer + description) stays
// the same so the UI is unchanged when it goes live.

export interface BcJob {
  jobNo: string;
  customerName: string;
  /** BC project description — pulled in as the editable default. */
  description: string;
}

// Seed pool drawn from the real Shipping List + a few extras to search against.
const JOBS: BcJob[] = [
  { jobNo: "J35236", customerName: "Dream First - Lakin", description: "(1) 4x4 Plex Face & (3) 6\" x 30\" Aluminum signs" },
  { jobNo: "J35332", customerName: "Dream First - Garden City", description: "(1) 2'-9\" x 12'-0\" Poly Face" },
  { jobNo: "J35620", customerName: "Murphy Tractor", description: "(1) Green Plex Backer" },
  { jobNo: "J35887", customerName: "RTS Accounting", description: "(1) 3x8 Wall Pan" },
  { jobNo: "J35454", customerName: "Lumineo Signs", description: "(1) 4x8 ACM Sign" },
  { jobNo: "J34773", customerName: "Western Motor", description: "(1) J-Bolt Form & (1) Rebar Cage" },
  { jobNo: "J36532", customerName: "Ballard Center", description: "(1) Wall Pan w/ FCOs" },
  { jobNo: "J25219", customerName: "Central National Bank", description: "(1) Wall Sign" },
  { jobNo: "J32865", customerName: "NKC Health", description: "Extrusion kits" },
  { jobNo: "J36110", customerName: "First Bank - Hays", description: "(1) Monument cabinet & (2) post covers" },
  { jobNo: "J36241", customerName: "Salina Regional Health", description: "(1) Set of channel letters" },
  { jobNo: "J36388", customerName: "Kwik Shop - Wichita", description: "(2) Pylon faces" },
];

/** Synchronous mock search (also the fallback when BC is unreachable). */
export function searchJobsMock(query: string, limit = 8): BcJob[] {
  const q = query.trim().toLowerCase();
  if (!q) return JOBS.slice(0, limit);
  return JOBS.filter(
    (j) =>
      j.jobNo.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q),
  ).slice(0, limit);
}

const live = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** Live BC search (Dataverse staging) with mock fallback on error. */
export async function searchJobs(query: string, limit = 8): Promise<BcJob[]> {
  if (live) {
    try {
      const { searchBcJobsLive } = await import("../services/dataverse-live");
      const rows = await searchBcJobsLive(query, limit);
      return rows.map((j) => ({ jobNo: j.jobNo, customerName: j.customerName, description: j.description }));
    } catch (e) {
      console.error("[bc] shipping live search failed — using mock", e);
    }
  }
  return searchJobsMock(query, limit);
}
