/**
 * Installation roster option metadata (crfdf_InstallationEmployees) — shared by
 * the live data source (read/write mapping) and the admin edit panel
 * (dropdowns). Single source of truth so option values never drift.
 *
 *   region (Two Option): false = WK, true = NEK
 *   location (Picklist):
 *     0 Hutchinson · 1 Wichita · 2 Dodge City   (WK)
 *     3 Olathe · 4 Topeka · 5 Lawrence          (NEK)
 *     6 Additional Jobs                         (both)
 */

export const INSTALL_LOCATIONS: Record<number, string> = {
  0: "Hutchinson",
  1: "Wichita",
  2: "Dodge City",
  3: "Olathe",
  4: "Topeka",
  5: "Lawrence",
  6: "Additional Jobs",
};

// Light band colors per location, drawn from the dept palette so the install
// board reads consistently with production. "Additional Jobs" stays neutral.
export const INSTALL_LOCATION_COLORS: Record<number, string> = {
  0: "#FFE0A8",
  1: "#BED7FF",
  2: "#C8E6D4",
  3: "#CECBF6",
  4: "#FAC775",
  5: "#F4C7C3",
  6: "#E4E7EE",
};

// Fixed location set per region — shown even when empty so the board layout is
// stable and matches the printed schedule (placeholder groups included).
export const REGION_LOCATIONS: Record<"wk" | "nek", number[]> = {
  wk: [0, 1, 2, 6],
  nek: [3, 4, 5, 6],
};

/** crfdf_region boolean → region label. */
export function regionLabel(isNek: boolean): "WK" | "NEK" {
  return isNek ? "NEK" : "WK";
}

/** Standard delivery locations, in option order, EXCLUDING the "Additional
 *  Jobs" placeholder (that's only a catch-all bucket on the install board, not
 *  a real shipping destination). Used by the Shipping location picker. */
export const STANDARD_LOCATIONS: string[] = Object.keys(INSTALL_LOCATIONS)
  .map(Number)
  .sort((a, b) => a - b)
  .map((v) => INSTALL_LOCATIONS[v]!)
  .filter((name) => name !== "Additional Jobs");
