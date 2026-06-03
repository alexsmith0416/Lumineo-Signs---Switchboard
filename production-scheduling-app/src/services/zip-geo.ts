// M1 scaffold: NOT WIRED. M10 (weather + crew chrome) replaces this with a
// real lookup against the `bc_ZipGeo` Dataverse table (~42k US ZIPs,
// one-time import per docs/09-weather-card-spec.md).

interface ZipEntry {
  city: string;
  state: string;
}

const WARN_KEY = "__lumineo_stub_warned_zip_geo__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[stub] zip-geo is not wired yet (M10). " +
      "Replace src/services/zip-geo.ts with a bc_ZipGeo Dataverse lookup.",
  );
}

export function lookupZip(zip: string | null | undefined): ZipEntry | null {
  if (!zip) return null;
  warnOnce();
  return null;
}

export function formatZipLocation(zip: string | null | undefined): string | null {
  if (!zip) return null;
  const geo = lookupZip(zip);
  if (!geo) return zip;
  return `${geo.city}, ${geo.state} ${zip}`;
}
