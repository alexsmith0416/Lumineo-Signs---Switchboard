// M1 scaffold: NOT WIRED. M11 (Monthly Install Plan wiring) replaces this
// with a Dataverse view joining install lines with no scheduled date +
// production lines marked near-complete (docs/15-scheduling-app-spec.md
// §5.5). Type is the prototype contract — MonthlyPlanView's AI auto-fill
// algorithm depends on it verbatim.

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
  promisedDate: string;
  productionStatus: "ready" | "near-complete";
}

const WARN_KEY = "__lumineo_stub_warned_install_candidates__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[stub] install-candidates is not wired yet (M11). " +
      "Replace src/services/install-candidates.ts with the Dataverse view " +
      "of production lines marked near-complete + install lines with no " +
      "scheduled date.",
  );
}

// Synchronous accessor matches the prototype import shape. M11 swaps this
// for an async service + a loader hook in MonthlyPlanView.
export const INSTALL_CANDIDATES: InstallCandidate[] = (() => {
  warnOnce();
  return [];
})();
