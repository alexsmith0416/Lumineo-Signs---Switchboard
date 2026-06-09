// Seed a handful of sample specs + projects the first time the app runs in
// dev so the Dashboard, Builder sidebar, and Projects screen show realistic
// content instead of empty states. No-op once the user has saved anything.

import type { SignSpec } from "../domain/SignSpec";
import type { Project } from "../domain/Project";
import { emptySignSpec } from "../domain/SignSpec";
import { localSignSpecRepo } from "./dataverseService";
import { localProjectRepo } from "./projectRepo";

const SEED_PROJECTS: Project[] = [
  {
    id: "proj-westview",
    name: "Westview Medical — Main Entry",
    customerName: "Westview Medical",
    notes: "Install scheduled for Q3. Cabinet + wayfinding bundle.",
    createdAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "proj-lakeside",
    name: "Lakeside Office Park — Phase 1",
    customerName: "Lakeside Office Park",
    notes: "Monument + tenant directory + parking.",
    createdAt: "2026-05-10T00:00:00.000Z",
  },
];

const SEED_SIGNS: SignSpec[] = [
  {
    ...emptySignSpec(),
    id: "seed-wc-1",
    name: "Main Entry Cabinet",
    projectId: "proj-westview",
    productCode: "WC-DF-IL-RFPB-P-CV-WB-WH",
    customerName: "Westview Medical",
    projectName: "Westview Medical — Main Entry",
    quantity: 2,
    signTypeCode: "WC",
    faces: "DF",
    illumination: "IL",
    ledColor: "WH",
    faceType: "RFPB",
    finish: "P",
    paintColor: "PMS 286 C Navy",
    vinyl: "CV",
    vinylColor: "3M 3630 — 010 White",
    vinylHex: "#F5F5F5",
    mounting: "WB",
    heightIn: "36",
    widthIn: "120",
    depthIn: "6",
    status: "Approved",
    departments: "Metal Fabrication, Paint, Vinyl, Assembly",
  },
  {
    ...emptySignSpec(),
    id: "seed-mn-1",
    name: "North Entrance Monument",
    projectId: "proj-lakeside",
    productCode: "MN-SF-EL-AT-P-CV-FM-WH",
    customerName: "Lakeside Office Park",
    projectName: "Lakeside Office Park — Phase 1",
    quantity: 1,
    signTypeCode: "MN",
    faces: "SF",
    illumination: "EL",
    ledColor: "WH",
    faceType: "AT",
    finish: "P",
    paintColor: "PMS 7546 C",
    vinyl: "CV",
    vinylColor: "3M 3630 — 022 Black",
    vinylHex: "#1A1A1A",
    mounting: "FM",
    heightIn: "72",
    widthIn: "96",
    depthIn: "12",
    status: "Submitted",
    departments: "Grounding, Metal Fabrication, Paint, Vinyl, Assembly",
  },
  {
    ...emptySignSpec(),
    id: "seed-fl-1",
    name: "Storefront Channel Letters",
    productCode: "FL-NI-PT-OEM-NV-DM",
    customerName: "Pioneer Bank",
    projectName: "Pioneer Bank — Branch Refresh",
    quantity: 8,
    signTypeCode: "FL",
    faces: "NA",
    illumination: "IL",
    ledColor: "WH",
    faceType: "PT",
    outsourced: true,
    finish: "OEM",
    vinyl: "NV",
    mounting: "DM",
    status: "Draft",
    departments: "Assembly",
  },
];

export async function seedIfEmpty(): Promise<void> {
  const [specs, projects] = await Promise.all([
    localSignSpecRepo.list(),
    localProjectRepo.list(),
  ]);
  if (projects.length === 0) {
    for (const p of SEED_PROJECTS) await localProjectRepo.save(p);
  }
  if (specs.length === 0) {
    for (const s of SEED_SIGNS) await localSignSpecRepo.save(s);
  }
}
