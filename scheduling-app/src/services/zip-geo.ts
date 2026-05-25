// Minimal ZIP → City, State lookup. Covers the ZIPs that appear in the WK +
// NEK install mocks. In production this is replaced by the `bc_ZipGeo`
// Dataverse table referenced in docs/09-weather-card-spec.md.

interface ZipEntry {
  city: string;
  state: string;
}

const ZIP_GEO: Record<string, ZipEntry> = {
  // WK service area — Kansas
  "67114": { city: "Newton", state: "KS" },
  "67118": { city: "Norwich", state: "KS" },
  "67202": { city: "Wichita", state: "KS" },
  "67220": { city: "Wichita (Bel Aire)", state: "KS" },
  "67401": { city: "Salina", state: "KS" },
  "67460": { city: "McPherson", state: "KS" },
  "67501": { city: "Hutchinson", state: "KS" },
  "67530": { city: "Great Bend", state: "KS" },
  "67801": { city: "Dodge City", state: "KS" },
  "67846": { city: "Garden City", state: "KS" },
  "67865": { city: "Minneola", state: "KS" },
  "67101": { city: "Maize", state: "KS" },

  // NEK service area — Kansas City metro
  "64106": { city: "Kansas City", state: "MO" },
  "64108": { city: "Kansas City", state: "MO" },
  "64111": { city: "Kansas City", state: "MO" },
  "64112": { city: "Kansas City", state: "MO" },
  "64151": { city: "Kansas City (North)", state: "MO" },
  "66044": { city: "Lawrence", state: "KS" },
  "66062": { city: "Olathe", state: "KS" },
  "66102": { city: "Kansas City", state: "KS" },
};

export function lookupZip(zip: string | null | undefined): ZipEntry | null {
  if (!zip) return null;
  return ZIP_GEO[zip] ?? null;
}

export function formatZipLocation(zip: string | null | undefined): string | null {
  const geo = lookupZip(zip);
  if (!geo) return zip ?? null;
  return `${geo.city}, ${geo.state} ${zip}`;
}
