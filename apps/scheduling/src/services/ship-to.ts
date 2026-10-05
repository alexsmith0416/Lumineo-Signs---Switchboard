// A job's BC ship-to address (crfdf_bcjobs.crfdf_shipto*), formatted for the
// job panel's address link: one line to show / copy, and a Google Maps search.

export interface ShipTo {
  address: string;
  city: string;
  state: string;
  zip: string;
}

/** "123 Main St, Salina, KS 67401" — skips blank parts ("" when all are blank). */
export function formatShipTo(a: Partial<ShipTo> | null | undefined): string {
  if (!a) return "";
  const street = (a.address ?? "").trim();
  const city = (a.city ?? "").trim();
  const stateZip = [(a.state ?? "").trim(), (a.zip ?? "").trim()].filter(Boolean).join(" ");
  return [street, city, stateZip].filter(Boolean).join(", ");
}

/** Google Maps search for an address (opens the app on phones, the site elsewhere). */
export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
