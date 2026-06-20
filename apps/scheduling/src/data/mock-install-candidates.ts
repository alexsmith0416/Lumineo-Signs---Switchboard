// Mock pool of jobs that are "ready for installation or close to being
// completed in production" — the input the AI auto-scheduler picks from.
// In production this would be derived from a Dataverse view joining
// installation lines + production schedule + BC job status.

export interface InstallCandidate {
  jobNo: string;
  customerName: string;
  description: string;
  region: "WK" | "NEK";
  zip: string;
  estimatedHours: number;
  crewPersons: number;
  crewTrucks: number;
  crewLifts?: number;
  invoiceAmount: number;
  promisedDate: string; // ISO date
  productionStatus: "ready" | "near-complete";
}

export const INSTALL_CANDIDATES: InstallCandidate[] = [
  { jobNo: "J37901", customerName: "Riverwalk Hotel", description: "Channel letters + monument", region: "WK", zip: "67501", estimatedHours: 14, crewPersons: 2, crewTrucks: 1, invoiceAmount: 87400, promisedDate: "2026-06-15", productionStatus: "ready" },
  { jobNo: "J37928", customerName: "Maize Bank & Trust", description: "Pylon faces + raceway letters", region: "WK", zip: "67101", estimatedHours: 10, crewPersons: 2, crewTrucks: 1, invoiceAmount: 54200, promisedDate: "2026-06-12", productionStatus: "ready" },
  { jobNo: "J37945", customerName: "Garden City Schools", description: "Wayfinding sign package", region: "WK", zip: "67846", estimatedHours: 18, crewPersons: 3, crewTrucks: 1, invoiceAmount: 132500, promisedDate: "2026-06-22", productionStatus: "near-complete" },
  { jobNo: "J38002", customerName: "Salina Regional Medical", description: "Hospital wayfinding refresh", region: "WK", zip: "67401", estimatedHours: 22, crewPersons: 3, crewTrucks: 2, invoiceAmount: 168900, promisedDate: "2026-06-26", productionStatus: "near-complete" },
  { jobNo: "J38014", customerName: "Bel Aire Auto Plaza", description: "Channel letters + pole sign", region: "WK", zip: "67220", estimatedHours: 12, crewPersons: 2, crewTrucks: 1, invoiceAmount: 71800, promisedDate: "2026-06-18", productionStatus: "ready" },
  { jobNo: "NKC-024", customerName: "Crown Center Office", description: "Lobby + exterior brand refresh", region: "NEK", zip: "64108", estimatedHours: 24, crewPersons: 4, crewTrucks: 2, crewLifts: 1, invoiceAmount: 215600, promisedDate: "2026-06-28", productionStatus: "near-complete" },
  { jobNo: "NKC-026", customerName: "Plaza Vista Towers", description: "Tenant directory + suite signs", region: "NEK", zip: "64111", estimatedHours: 16, crewPersons: 2, crewTrucks: 1, invoiceAmount: 92400, promisedDate: "2026-06-19", productionStatus: "ready" },
  { jobNo: "NKC-028", customerName: "Olathe Health", description: "Wayfinding phase 2", region: "NEK", zip: "66062", estimatedHours: 20, crewPersons: 3, crewTrucks: 1, invoiceAmount: 124300, promisedDate: "2026-06-24", productionStatus: "near-complete" },
  { jobNo: "NKC-030", customerName: "Sporting KC Practice Facility", description: "Field-side dimensional letters", region: "NEK", zip: "66062", estimatedHours: 14, crewPersons: 3, crewTrucks: 1, invoiceAmount: 89700, promisedDate: "2026-06-20", productionStatus: "ready" },
  { jobNo: "NKC-033", customerName: "Country Club Plaza Retail", description: "Two storefronts — channel + pin", region: "NEK", zip: "64112", estimatedHours: 10, crewPersons: 2, crewTrucks: 1, invoiceAmount: 64800, promisedDate: "2026-06-13", productionStatus: "ready" },
];
