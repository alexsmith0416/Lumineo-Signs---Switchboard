import { create } from "zustand";
import { loadZipCentroids, zipCenter, type LatLng } from "../services/geo";
import { addressKey, orsGeocodeUrl, orsHeaders, parseOrsGeocode, type JobGeo } from "../services/geocode";
import type { ShipTo } from "../services/ship-to";
import { OrsError, orsFetch, orsStatusText } from "../services/ors-fetch";

/**
 * Install Planner — where each job is on the map (Oct 11, 2026).
 *
 * Saved positions (crfdf_jobgeo) are loaded once; jobs with no saved position,
 * or whose ship-to address changed, are looked up in the BACKGROUND with
 * openrouteservice — one every 0.7 s (the free plan allows 100 a minute,
 * 1,000 a day), at most MAX_PER_SESSION per session — and saved. Until then,
 * or when a lookup fails, the pin sits at the ZIP's center (approximate).
 *
 * Lookups stop for the session on a bad key / used-up quota / blocked request
 * (content security policy) and say why (`lookupError`). Dev: ZIP centers only.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const dv = () => import("../services/dataverse-live");
export const ORS_KEY_SETTING = "orsApiKey";
const SPACING_MS = 700;
const MAX_PER_SESSION = 500;

type Saved = JobGeo & { rowId?: string };

export interface GeoJob {
  jobNo: string;
  shipTo: Partial<ShipTo>;
}

interface JobGeoState {
  geos: Map<string, Saved>;
  zips: Map<string, LatLng> | null;
  /** openrouteservice key ("" = none set → ZIP centers only). */
  orsKey: string;
  loaded: boolean;
  /** Lookups still queued. */
  pending: number;
  /** Why lookups stopped ("" = fine). */
  lookupError: string;
  load: () => Promise<void>;
  /** Admin: save the openrouteservice key (app settings). */
  setOrsKey: (key: string) => Promise<void>;
  /** Look up, in the background, every job whose position is missing or stale. */
  ensure: (jobs: readonly GeoJob[]) => void;
  /** Clear a stopped lookup (after fixing the key / policy) and carry on. */
  retry: () => void;
}

let queue: GeoJob[] = [];
/** The last jobs asked for, so retry() can pick up where it stopped. */
let lastAsked: readonly GeoJob[] = [];
let running = false;
let lookedUp = 0;
const queued = new Set<string>();

export const useJobGeoStore = create<JobGeoState>((set, get) => ({
  geos: new Map(),
  zips: null,
  orsKey: "",
  loaded: false,
  pending: 0,
  lookupError: "",

  load: async () => {
    if (get().loaded) return;
    const zips = await loadZipCentroids();
    if (!LIVE) {
      set({ zips, loaded: true });
      return;
    }
    const m = await dv();
    const [geos, config] = await Promise.all([
      m.fetchJobGeos().catch((e) => {
        console.warn("[job-geo] crfdf_jobgeo not available yet (table not created?) — ZIP centers only", e);
        return [] as Saved[];
      }),
      m.fetchJobsViewConfig().catch(() => new Map<string, unknown>()),
    ]);
    const key = config.get(ORS_KEY_SETTING);
    set({
      zips,
      geos: new Map(geos.map((g) => [g.jobNo, g])),
      orsKey: typeof key === "string" ? key.trim() : "",
      loaded: true,
    });
  },

  setOrsKey: async (key) => {
    const clean = key.trim();
    set({ orsKey: clean, lookupError: "" });
    if (LIVE) await (await dv()).saveJobsViewConfig(ORS_KEY_SETTING, clean);
    get().retry();
  },

  retry: () => {
    queued.clear();
    queue = [];
    set({ lookupError: "" });
    get().ensure(lastAsked);
  },

  ensure: (jobs) => {
    lastAsked = jobs;
    const { loaded, orsKey, geos, lookupError } = get();
    if (!LIVE || !loaded || !orsKey || lookupError) return;
    for (const j of jobs) {
      const key = addressKey(j.shipTo);
      if (!key.replace(/\|/g, "") || queued.has(j.jobNo)) continue;
      if (geos.get(j.jobNo)?.address === key) continue; // looked up already (found or not)
      queued.add(j.jobNo);
      queue.push(j);
    }
    set({ pending: queue.length });
    void run();
  },
}));

async function run(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const st = useJobGeoStore.getState();
      if (st.lookupError || !st.orsKey) break;
      if (lookedUp >= MAX_PER_SESSION) {
        useJobGeoStore.setState({ lookupError: `Looked up ${MAX_PER_SESSION} addresses this session — the rest continue next time.` });
        break;
      }
      const job = queue.shift()!;
      useJobGeoStore.setState({ pending: queue.length });
      await lookUp(job, st.orsKey, st.zips);
      lookedUp++;
      await new Promise((r) => setTimeout(r, SPACING_MS));
    }
  } finally {
    running = false;
    useJobGeoStore.setState({ pending: queue.length });
  }
}

async function lookUp(job: GeoJob, key: string, zips: Map<string, LatLng> | null): Promise<void> {
  const address = addressKey(job.shipTo);
  const center = zips ? zipCenter(zips, job.shipTo.zip ?? "") : null;
  let res: Response;
  try {
    res = await orsFetch(orsGeocodeUrl(job.shipTo), { headers: orsHeaders(key) });
  } catch (e) {
    // Blocked by the policy, or a refusal the browser can't read (the key) — stop until retried.
    useJobGeoStore.setState({ lookupError: e instanceof OrsError ? e.message : "openrouteservice couldn't be reached." });
    console.warn("[job-geo] lookup failed", e);
    queued.delete(job.jobNo);
    queue.unshift(job);
    return;
  }
  const refused = orsStatusText(res.status);
  if (refused && res.status !== 404) {
    useJobGeoStore.setState({ lookupError: refused });
    queued.delete(job.jobNo);
    queue.unshift(job);
    return;
  }
  const pos = res.ok ? parseOrsGeocode(await res.json().catch(() => null), center) : null;
  const geo: JobGeo = pos
    ? { jobNo: job.jobNo, address, quality: "address", ...pos }
    : center
      ? { jobNo: job.jobNo, address, quality: "zip", ...center }
      : { jobNo: job.jobNo, address, quality: "none" };
  const prev = useJobGeoStore.getState().geos.get(job.jobNo);
  try {
    const rowId = await (await dv()).saveJobGeo(geo, prev?.rowId);
    useJobGeoStore.setState((s) => ({ geos: new Map(s.geos).set(job.jobNo, { ...geo, rowId }) }));
  } catch (e) {
    // Keep it for this session even if the save failed; it's looked up again next time.
    useJobGeoStore.setState((s) => ({ geos: new Map(s.geos).set(job.jobNo, { ...geo, rowId: prev?.rowId }) }));
    console.warn("[job-geo] save failed", e);
  }
}

/**
 * Where to put a job's pin: its looked-up address when that's current, else
 * its ZIP's center (approximate), else nowhere.
 */
export function positionOf(
  s: Pick<JobGeoState, "geos" | "zips">,
  job: GeoJob,
): { pos: LatLng | null; approx: boolean } {
  const g = s.geos.get(job.jobNo);
  if (g && g.quality === "address" && g.lat != null && g.lng != null && g.address === addressKey(job.shipTo)) {
    return { pos: { lat: g.lat, lng: g.lng }, approx: false };
  }
  const center = s.zips ? zipCenter(s.zips, job.shipTo.zip ?? "") : null;
  return { pos: center, approx: !!center };
}
