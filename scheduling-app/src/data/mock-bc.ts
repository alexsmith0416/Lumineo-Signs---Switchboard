export interface BcPlanningLine {
  lineNo: number;
  description: string;
  estimatedHours: number;
  /**
   * BC planning line type. Matches the Canvas app's filter
   * (`Type = "Resource"`) — only Resource lines represent labor hours
   * and show up in the schedule picker. Item / Cost lines are skipped.
   */
  type: "Resource" | "Item" | "Cost" | "Text";
}

export interface BcJob {
  jobNo: string;
  customerName: string;
  promisedDate: string;
  /** Canvas mirror of BC `description` on the job header. */
  description?: string;
  planningLines: BcPlanningLine[];
}

export const MOCK_BC_JOBS: BcJob[] = [
  {
    jobNo: "J103101",
    customerName: "Sunset Bowling",
    description: "Exterior pylon refresh + interior wayfinding",
    promisedDate: "2026-06-12",
    planningLines: [
      { lineNo: 10, description: "Metal cabinet fabrication", estimatedHours: 12, type: "Resource" },
      { lineNo: 15, description: "Aluminum stock — 0.080 sheet", estimatedHours: 0, type: "Item" },
      { lineNo: 20, description: "Paint and powder coat", estimatedHours: 6, type: "Resource" },
      { lineNo: 30, description: "LED assembly and wiring", estimatedHours: 8, type: "Resource" },
      { lineNo: 40, description: "Vinyl graphics application", estimatedHours: 3, type: "Resource" },
    ],
  },
  {
    jobNo: "J103205",
    customerName: "Oak & Vine Restaurant",
    description: "Channel letters · front entry",
    promisedDate: "2026-06-05",
    planningLines: [
      { lineNo: 10, description: "Channel letter fabrication", estimatedHours: 16, type: "Resource" },
      { lineNo: 20, description: "Paint channel letters", estimatedHours: 4, type: "Resource" },
      { lineNo: 30, description: "Mount and final assembly", estimatedHours: 5, type: "Resource" },
    ],
  },
  {
    jobNo: "J103418",
    customerName: "Northgate Hospital",
    description: "Wayfinding program · ER + maternity",
    promisedDate: "2026-07-01",
    planningLines: [
      { lineNo: 10, description: "Wayfinding metal blanks", estimatedHours: 10, type: "Resource" },
      { lineNo: 20, description: "Paint wayfinding signs", estimatedHours: 5, type: "Resource" },
      { lineNo: 30, description: "Vinyl + braille application", estimatedHours: 6, type: "Resource" },
    ],
  },
];
