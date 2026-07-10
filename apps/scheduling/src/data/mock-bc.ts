export interface BcPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
  /** BC resource code (crfdf_no) — drives the production/installation split. */
  resourceNo?: string;
}

export interface BcJob {
  jobNo: string;
  customerName: string;
  promisedDate: string;
  planningLines: BcPlanningLine[];
}

export const MOCK_BC_JOBS: BcJob[] = [
  {
    jobNo: "J103101",
    customerName: "Sunset Bowling",
    promisedDate: "2026-06-12",
    planningLines: [
      { lineNo: 10, description: "Metal cabinet fabrication", estimatedHours: 12, resourceNo: "2010" },
      { lineNo: 20, description: "Paint and powder coat", estimatedHours: 6, resourceNo: "2020" },
      { lineNo: 30, description: "LED assembly and wiring", estimatedHours: 8, resourceNo: "2030" },
      { lineNo: 40, description: "Vinyl graphics application", estimatedHours: 3, resourceNo: "2040" },
    ],
  },
  {
    jobNo: "J103205",
    customerName: "Oak & Vine Restaurant",
    promisedDate: "2026-06-05",
    planningLines: [
      { lineNo: 10, description: "Channel letter fabrication", estimatedHours: 16, resourceNo: "2010" },
      { lineNo: 20, description: "Paint channel letters", estimatedHours: 4, resourceNo: "2020" },
      // On-site mount → installation band (outside 2000–2999).
      { lineNo: 30, description: "Mount and final assembly", estimatedHours: 5, resourceNo: "4010" },
    ],
  },
  {
    jobNo: "J103418",
    customerName: "Northgate Hospital",
    promisedDate: "2026-07-01",
    planningLines: [
      { lineNo: 10, description: "Wayfinding metal blanks", estimatedHours: 10, resourceNo: "2010" },
      { lineNo: 20, description: "Paint wayfinding signs", estimatedHours: 5, resourceNo: "2020" },
      { lineNo: 30, description: "Vinyl + braille application", estimatedHours: 6, resourceNo: "2040" },
      // On-site install of the wayfinding package → installation band.
      { lineNo: 40, description: "On-site install & anchoring", estimatedHours: 4, resourceNo: "4010" },
    ],
  },
];
