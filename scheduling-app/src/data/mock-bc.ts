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

export const MOCK_BC_JOBS: BcJob[] = [
  {
    jobNo: "J103101",
    customerName: "Sunset Bowling",
    promisedDate: "2026-06-12",
    planningLines: [
      { lineNo: 10, description: "Metal cabinet fabrication", estimatedHours: 12 },
      { lineNo: 20, description: "Paint and powder coat", estimatedHours: 6 },
      { lineNo: 30, description: "LED assembly and wiring", estimatedHours: 8 },
      { lineNo: 40, description: "Vinyl graphics application", estimatedHours: 3 },
    ],
  },
  {
    jobNo: "J103205",
    customerName: "Oak & Vine Restaurant",
    promisedDate: "2026-06-05",
    planningLines: [
      { lineNo: 10, description: "Channel letter fabrication", estimatedHours: 16 },
      { lineNo: 20, description: "Paint channel letters", estimatedHours: 4 },
      { lineNo: 30, description: "Mount and final assembly", estimatedHours: 5 },
    ],
  },
  {
    jobNo: "J103418",
    customerName: "Northgate Hospital",
    promisedDate: "2026-07-01",
    planningLines: [
      { lineNo: 10, description: "Wayfinding metal blanks", estimatedHours: 10 },
      { lineNo: 20, description: "Paint wayfinding signs", estimatedHours: 5 },
      { lineNo: 30, description: "Vinyl + braille application", estimatedHours: 6 },
    ],
  },
];
