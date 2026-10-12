/**
 * Settings → Install Planner → Test: does this openrouteservice key work from
 * inside the app? One address lookup (the Hutchinson shop) and one tiny
 * drive-time request, each with a plain answer. Oct 12, 2026.
 */
import { ORS_ROUTING, orsGeocodeUrl, orsHeaders, parseOrsGeocode } from "./geocode";
import { OrsError, orsFetch, orsStatusText } from "./ors-fetch";
import { LUMINEO_LOCATIONS } from "./geo";

export interface OrsCheck {
  label: string;
  ok: boolean;
  detail: string;
}

const why = (e: unknown) => (e instanceof OrsError ? e.message : e instanceof Error ? e.message : "openrouteservice couldn't be reached.");

export async function testOrsKey(key: string): Promise<OrsCheck[]> {
  const out: OrsCheck[] = [];
  const hutch = LUMINEO_LOCATIONS.find((l) => l.name === "Hutchinson")!;
  const wichita = LUMINEO_LOCATIONS.find((l) => l.name === "Wichita")!;

  try {
    const res = await orsFetch(orsGeocodeUrl({ address: "1429 W 4th Ave", city: "Hutchinson", state: "KS", zip: "67501" }), {
      headers: orsHeaders(key),
    });
    const bad = orsStatusText(res.status);
    if (bad) out.push({ label: "Address lookup", ok: false, detail: bad });
    else {
      const p = parseOrsGeocode(await res.json().catch(() => null), hutch);
      out.push(
        p
          ? { label: "Address lookup", ok: true, detail: "Works — the Hutchinson shop was found." }
          : { label: "Address lookup", ok: false, detail: "openrouteservice answered but didn't find the Hutchinson shop." },
      );
    }
  } catch (e) {
    out.push({ label: "Address lookup", ok: false, detail: why(e) });
  }

  try {
    const res = await orsFetch(`${ORS_ROUTING}/matrix/driving-car`, {
      method: "POST",
      headers: orsHeaders(key, true),
      body: JSON.stringify({ locations: [[hutch.lng, hutch.lat], [wichita.lng, wichita.lat]], metrics: ["duration"], units: "mi" }),
    });
    const bad = orsStatusText(res.status);
    if (bad) out.push({ label: "Drive times", ok: false, detail: bad });
    else {
      const b = (await res.json().catch(() => null)) as { durations?: number[][] } | null;
      const s = b?.durations?.[0]?.[1];
      out.push(
        s
          ? { label: "Drive times", ok: true, detail: `Works — Hutchinson → Wichita is ${Math.round(s / 60)} min by road.` }
          : { label: "Drive times", ok: false, detail: "openrouteservice answered without drive times." },
      );
    }
  } catch (e) {
    out.push({ label: "Drive times", ok: false, detail: why(e) });
  }
  return out;
}
