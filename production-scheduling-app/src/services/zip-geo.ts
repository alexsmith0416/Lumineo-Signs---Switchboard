// ZIP → city/state lookup against the crfdf_bczipgeo Dataverse table
// (~42k US ZIPs, one-time import per docs/09-weather-card-spec.md).
// Results are memoized per session — ZIP geo never changes.

import { getDataverseReader, str } from "./dataverse-reader";

interface ZipEntry {
  city: string;
  state: string;
  lat?: number;
  lng?: number;
}

const T_ZIP_GEO = "crfdf_bczipgeo";

const cache = new Map<string, ZipEntry | null>();
const inflight = new Map<string, Promise<ZipEntry | null>>();

export async function lookupZipAsync(zip: string | null | undefined): Promise<ZipEntry | null> {
  if (!zip) return null;
  const key = zip.slice(0, 5);
  if (cache.has(key)) return cache.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    const rows = await getDataverseReader().retrieveMultiple(T_ZIP_GEO, {
      filter: `crfdf_zip eq '${key}'`,
      top: 1,
    });
    const row = rows[0];
    const entry: ZipEntry | null = row
      ? {
          city: str(row, "crfdf_city", "city"),
          state: str(row, "crfdf_state", "state"),
        }
      : null;
    cache.set(key, entry);
    inflight.delete(key);
    return entry;
  })();
  inflight.set(key, p);
  return p;
}

/** Sync read from the session cache — returns null until lookupZipAsync
 *  has resolved for this ZIP. Components that need a guaranteed value
 *  should use the async form (or the useZipLocation hook). */
export function lookupZip(zip: string | null | undefined): ZipEntry | null {
  if (!zip) return null;
  const cached = cache.get(zip.slice(0, 5));
  if (cached === undefined) {
    // Kick off the fetch so a re-render picks it up.
    void lookupZipAsync(zip);
    return null;
  }
  return cached;
}

export function formatZipLocation(zip: string | null | undefined): string | null {
  if (!zip) return null;
  const geo = lookupZip(zip);
  if (!geo) return zip;
  return `${geo.city}, ${geo.state} ${zip}`;
}
