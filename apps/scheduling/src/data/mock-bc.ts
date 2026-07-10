export interface BcPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
  /** BC resource code (crfdf_no) — the exact department labor category. */
  resourceNo?: string;
  /** BC job task no (crfdf_jobtaskno) — 3000s Production, 4000s Installation.
   *  Drives which calendar the line shows on in Add Job. */
  jobTaskNo?: string;
}

export interface BcJob {
  jobNo: string;
  customerName: string;
  /** BC job header description (crfdf_description) — the overall job summary. */
  description?: string;
  promisedDate: string;
  planningLines: BcPlanningLine[];
}

export const MOCK_BC_JOBS: BcJob[] = [
  {
    jobNo: "J103101",
    customerName: "Sunset Bowling",
    description: "Illuminated monument sign + channel letters",
    promisedDate: "2026-06-12",
    planningLines: [
      { lineNo: 10, description: "Metal cabinet fabrication", estimatedHours: 12, resourceNo: "2011", jobTaskNo: "3020" },
      { lineNo: 20, description: "Paint and powder coat", estimatedHours: 6, resourceNo: "2112", jobTaskNo: "3020" },
      { lineNo: 30, description: "LED assembly and wiring", estimatedHours: 8, resourceNo: "2212", jobTaskNo: "3020" },
      { lineNo: 40, description: "Vinyl graphics application", estimatedHours: 3, resourceNo: "2416", jobTaskNo: "3020" },
    ],
  },
  {
    jobNo: "J103205",
    customerName: "Oak & Vine Restaurant",
    description: "Storefront channel letters — reface",
    promisedDate: "2026-06-05",
    planningLines: [
      { lineNo: 10, description: "Channel letter fabrication", estimatedHours: 16, resourceNo: "2014", jobTaskNo: "3020" },
      { lineNo: 20, description: "Paint channel letters", estimatedHours: 4, resourceNo: "2112", jobTaskNo: "3020" },
      // On-site mount → installation task band (4000s).
      { lineNo: 30, description: "Mount and final assembly", estimatedHours: 5, jobTaskNo: "4010" },
    ],
  },
  {
    jobNo: "J103418",
    customerName: "Northgate Hospital",
    description: "Interior wayfinding + ADA signage package",
    promisedDate: "2026-07-01",
    planningLines: [
      { lineNo: 10, description: "Wayfinding metal blanks", estimatedHours: 10, resourceNo: "2011", jobTaskNo: "3020" },
      { lineNo: 20, description: "Paint wayfinding signs", estimatedHours: 5, resourceNo: "2112", jobTaskNo: "3020" },
      { lineNo: 30, description: "Vinyl + braille application", estimatedHours: 6, resourceNo: "2416", jobTaskNo: "3020" },
      // On-site install of the wayfinding package → installation task band (4000s).
      { lineNo: 40, description: "On-site install & anchoring", estimatedHours: 4, jobTaskNo: "4010" },
    ],
  },
];
