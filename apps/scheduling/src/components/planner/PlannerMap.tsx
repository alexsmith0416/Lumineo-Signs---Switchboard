import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LUMINEO_LOCATIONS, type LatLng } from "../../services/geo";
import type { JobGroup, MapState, PlannerJob } from "../../services/install-planner";

/** Pin colors by state (legend in InstallPlannerView). */
export const STATE_COLORS: Record<MapState, string> = {
  must: "#E8151B",
  locked: "#7C3AED",
  ready: "#2563EB",
  scheduled: "#8A94A6",
  production: "#C9D1DE",
};
export const STATE_LABELS: Record<MapState, string> = {
  must: "Must this week",
  locked: "Locked on the board",
  ready: "Ready to schedule",
  scheduled: "Scheduled",
  production: "In production",
};

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const KANSAS: L.LatLngExpression = [38.5, -97.5];
const MILE_METERS = 1609.344;

/** A trip drawn on the map: the road line and the stops numbered in driving order. */
export interface MapTrip {
  /** Changes when a different trip / route is shown (zooms to it). */
  key: string;
  home: LatLng;
  /** In driving order. */
  stops: Array<LatLng & { jobNo: string }>;
  /** The road route; [] = straight lines between the stops. */
  line: LatLng[];
}

/**
 * Spread pins that sit on exactly the same point (several jobs placed at one
 * ZIP's center) in a small ring so each can be seen and clicked.
 */
function spread(jobs: readonly PlannerJob[]): Map<string, LatLng> {
  const byPoint = new Map<string, PlannerJob[]>();
  for (const j of jobs) {
    if (!j.pos) continue;
    const k = `${j.pos.lat.toFixed(4)},${j.pos.lng.toFixed(4)}`;
    byPoint.set(k, [...(byPoint.get(k) ?? []), j]);
  }
  const out = new Map<string, LatLng>();
  for (const list of byPoint.values()) {
    list.forEach((j, i) => {
      if (list.length === 1) return out.set(j.jobNo, j.pos!);
      const ring = 0.006 * (1 + Math.floor(i / 8));
      const a = (2 * Math.PI * (i % 8)) / Math.min(8, list.length);
      out.set(j.jobNo, { lat: j.pos!.lat + ring * Math.sin(a), lng: j.pos!.lng + ring * 1.3 * Math.cos(a) });
    });
  }
  return out;
}

function pinIcon(j: PlannerJob, selected: boolean): L.DivIcon {
  const cls = [
    "pl-pin",
    j.kind === "service" ? "pl-pin--service" : "",
    j.approx ? "pl-pin--approx" : "",
    selected ? "pl-pin--selected" : "",
    j.state === "production" ? "pl-pin--faded" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const size = selected ? 18 : 14;
  return L.divIcon({
    className: "pl-pin-wrap",
    html: `<span class="${cls}" style="background:${STATE_COLORS[j.state]}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const tip = (j: PlannerJob) =>
  `<b>${escapeHtml(j.jobNo)}</b> ${escapeHtml(j.name)}<br>${STATE_LABELS[j.state]} · ${j.kind === "service" ? "Service" : "Install"}` +
  (j.crewHours ? ` · ${j.crewHours} crew h` : "") +
  (j.scheduledDate ? `<br>On the board ${escapeHtml(j.scheduledDate)}` : "") +
  (j.approx ? "<br><i>Approximate (ZIP center)</i>" : "");

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * The Install Planner's map (Leaflet + OpenStreetMap tiles): job pins, the
 * Lumineo locations, and each group's radius circle. Pins: round = install,
 * diamond = service; dashed outline = placed at the ZIP's center only.
 */
export default function PlannerMap({
  jobs,
  groups,
  radiusMi,
  selectedJob,
  selectedGroup,
  onSelectJob,
  onSelectGroup,
  fitKey,
  trip = null,
}: {
  jobs: readonly PlannerJob[];
  groups: readonly JobGroup[];
  radiusMi: number;
  selectedJob: string | null;
  selectedGroup: string | null;
  onSelectJob: (jobNo: string) => void;
  onSelectGroup: (id: string) => void;
  /** Changes when the map should zoom to fit what's shown (region / filters changed). */
  fitKey: string;
  /** A trip to draw (route + numbered stops); null = none. */
  trip?: MapTrip | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pinLayer = useRef<L.LayerGroup | null>(null);
  const groupLayer = useRef<L.LayerGroup | null>(null);
  const tripLayer = useRef<L.LayerGroup | null>(null);
  const handlers = useRef({ onSelectJob, onSelectGroup });
  handlers.current = { onSelectJob, onSelectGroup };

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: KANSAS, zoom: 7, zoomControl: true, preferCanvas: false });
    L.tileLayer(TILES, { maxZoom: 18, attribution: ATTRIBUTION }).addTo(m);
    groupLayer.current = L.layerGroup().addTo(m);
    tripLayer.current = L.layerGroup().addTo(m);
    pinLayer.current = L.layerGroup().addTo(m);
    for (const loc of LUMINEO_LOCATIONS) {
      L.marker([loc.lat, loc.lng], {
        icon: L.divIcon({
          className: "pl-loc-wrap",
          html: `<span class="pl-loc${loc.crewBase ? "" : " pl-loc--office"}">${escapeHtml(loc.name)}</span>`,
          iconSize: [0, 0],
        }),
        keyboard: false,
        // Under the job pins, so a job in the shop's own town can still be clicked.
        zIndexOffset: -1000,
      })
        .bindTooltip(
          `<b>Lumineo · ${escapeHtml(loc.name)}</b> (${loc.region})<br>${escapeHtml(loc.address)}<br>${escapeHtml(loc.phone)}` +
            (loc.crewBase ? "" : "<br><i>Not a crew start for trips</i>"),
          { direction: "top", offset: [0, -10] },
        )
        .addTo(m);
    }
    map.current = m;
    // The panel can change size after layout; keep tiles filling it.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Pins.
  useEffect(() => {
    const layer = pinLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const at = spread(jobs);
    // Selected last so it draws on top.
    const ordered = [...jobs].sort((a, b) => Number(a.jobNo === selectedJob) - Number(b.jobNo === selectedJob));
    for (const j of ordered) {
      const p = at.get(j.jobNo);
      if (!p) continue;
      L.marker([p.lat, p.lng], { icon: pinIcon(j, j.jobNo === selectedJob), riseOnHover: true })
        .bindTooltip(tip(j), { direction: "top", offset: [0, -8] })
        .on("click", () => handlers.current.onSelectJob(j.jobNo))
        .addTo(layer);
    }
  }, [jobs, selectedJob]);

  // Group circles.
  useEffect(() => {
    const layer = groupLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const g of groups) {
      const on = g.id === selectedGroup;
      L.circle([g.center.lat, g.center.lng], {
        radius: radiusMi * MILE_METERS,
        color: on ? "#141464" : "#2563EB",
        weight: on ? 2.5 : 1,
        opacity: on ? 0.9 : 0.45,
        fillColor: on ? "#141464" : "#2563EB",
        fillOpacity: on ? 0.1 : 0.04,
        dashArray: on ? undefined : "4 4",
      })
        .bindTooltip(`Group ${g.id.slice(1)} · ${g.jobs.length} job${g.jobs.length === 1 ? "" : "s"}`, { sticky: true })
        .on("click", () => handlers.current.onSelectGroup(g.id))
        .addTo(layer);
    }
  }, [groups, selectedGroup, radiusMi]);

  // The trip: road line (or straight legs) + numbered stops.
  useEffect(() => {
    const layer = tripLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (!trip) return;
    const path = trip.line.length > 1 ? trip.line : [trip.home, ...trip.stops, trip.home];
    L.polyline(
      path.map((p) => [p.lat, p.lng] as [number, number]),
      { color: "#141464", weight: 4, opacity: 0.8, dashArray: trip.line.length > 1 ? undefined : "8 6" },
    ).addTo(layer);
    trip.stops.forEach((st, i) => {
      L.marker([st.lat, st.lng], {
        icon: L.divIcon({ className: "pl-pin-wrap", html: `<span class="tr-num">${i + 1}</span>`, iconSize: [22, 22], iconAnchor: [11, 26] }),
        zIndexOffset: 2000,
        keyboard: false,
      })
        .bindTooltip(`Stop ${i + 1} · ${escapeHtml(st.jobNo)}`, { direction: "top", offset: [0, -24] })
        .addTo(layer);
    });
  }, [trip]);

  // Zoom to a trip when a different one is shown.
  useEffect(() => {
    if (!trip || !map.current) return;
    const pts = [trip.home, ...trip.stops].map((p) => [p.lat, p.lng] as [number, number]);
    map.current.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.key]);

  // Zoom to a selected group.
  useEffect(() => {
    const g = groups.find((x) => x.id === selectedGroup);
    if (!g || !map.current) return;
    const pts = g.jobs.filter((j) => j.pos).map((j) => [j.pos!.lat, j.pos!.lng] as [number, number]);
    pts.push([g.home.lat, g.home.lng]);
    map.current.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 11 });
    // Only when the selection changes, not on every regroup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup]);

  // Fit everything shown when the region / filters change.
  useEffect(() => {
    const pts = jobs.filter((j) => j.pos).map((j) => [j.pos!.lat, j.pos!.lng] as [number, number]);
    if (!map.current || !pts.length) return;
    map.current.fitBounds(L.latLngBounds(pts).pad(0.1), { maxZoom: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Pan to a selected job when it's off screen.
  useEffect(() => {
    const j = jobs.find((x) => x.jobNo === selectedJob);
    if (!j?.pos || !map.current) return;
    if (!map.current.getBounds().contains([j.pos.lat, j.pos.lng])) map.current.panTo([j.pos.lat, j.pos.lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob]);

  return <div ref={el} className="pl-map" role="application" aria-label="Install jobs map" />;
}
