import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import TripDays, { TripTotals, tripSheetHtml } from "./TripDays";
import type { MapTrip } from "./PlannerMap";
import { useJobGeoStore } from "../../store/job-geo-store";
import { useTripStore } from "../../store/trip-store";
import { LUMINEO_LOCATIONS, type LatLng, type LumineoLocation, type Region } from "../../services/geo";
import { roadMatrix, roadRoute } from "../../services/ors-routing";
import { estimateMatrix, loopHours, needsOvernight, planDays, shortestLoop, type Matrix } from "../../services/trip-plan";
import { defaultTripName, duration, type SavedTrip, type TripStop } from "../../services/saved-trips";
import { printMarkup } from "../../services/print";

/** What a trip is planned from: a radius group's jobs, or a saved trip being reopened. */
export type TripSource =
  | { kind: "group"; label: string; region: Region; home: string; stops: TripStop[] }
  | { kind: "saved"; trip: SavedTrip };

/** BC has no install hours for a job → plan it at this until someone sets it. */
const UNKNOWN_HOURS = 4;
const LEAVE_HOURS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const NO_LINE: LatLng[] = [];

interface Row {
  stop: TripStop;
  include: boolean;
  /** Hours as typed ("" while editing). */
  hours: string;
  /** BC had hours for it. */
  known: boolean;
}

/** The sub-matrix for one home (index into `all`) + the stops (indexes into `all`). */
function subMatrix(all: Matrix, home: number, stops: readonly number[]): Matrix {
  const idx = [home, ...stops];
  return {
    hours: idx.map((i) => idx.map((j) => all.hours[i]![j]!)),
    miles: idx.map((i) => idx.map((j) => all.miles[i]![j]!)),
    source: all.source,
  };
}

/**
 * Plan one trip: pick where the crew leaves from (each crew location's
 * shortest loop is compared), whether it's an overnight (auto over 4 h
 * one-way), the max nights, when they leave, which jobs and how many hours
 * each; see it day by day and on the map; save it for the installers; print.
 */
export default function TripPanel({
  source,
  weekStart,
  crossing,
  canEdit,
  userName,
  onMapTrip,
  onClose,
}: {
  source: TripSource;
  weekStart: Date;
  /** WK and NEK may share (any crew location can be the start). */
  crossing: boolean;
  canEdit: boolean;
  userName: string;
  onMapTrip: (t: MapTrip | null) => void;
  onClose: () => void;
}) {
  const saved = source.kind === "saved" ? source.trip : null;
  const region: Region = saved ? saved.region : source.kind === "group" ? source.region : "WK";
  const [rows, setRows] = useState<Row[]>(() =>
    (saved ? saved.stops : source.kind === "group" ? source.stops : []).map((s) => ({
      stop: s,
      include: true,
      hours: String(s.hours || UNKNOWN_HOURS),
      known: s.hours > 0,
    })),
  );
  const bases = useMemo(
    () => LUMINEO_LOCATIONS.filter((l) => l.crewBase && (crossing || l.region === region)),
    [crossing, region],
  );
  const [homeName, setHomeName] = useState<string | null>(saved ? saved.home.name : null);
  const [overnightMode, setOvernightMode] = useState<"auto" | "on" | "off">(saved ? (saved.plan.overnight ? "on" : "off") : "auto");
  const [maxNights, setMaxNights] = useState(saved?.maxNights ?? 2);
  const [startHour, setStartHour] = useState(saved?.startHour ?? 7);
  const [name, setName] = useState(saved?.name ?? "");
  const [savedState, setSavedState] = useState<"" | "saving" | "saved">("");
  const orsKey = useJobGeoStore((s) => s.orsKey);

  const included = rows.filter((r) => r.include);
  const points: LatLng[] = useMemo(() => [...bases, ...included.map((r) => r.stop)], [bases, included]);
  const pointsKey = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");

  // Drive times: estimates at once, road times when openrouteservice answers.
  const [road, setRoad] = useState<{ key: string; matrix: Matrix; note: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!points.length) return;
    void roadMatrix(orsKey, points).then((r) => alive && setRoad({ key: pointsKey, ...r }));
    return () => {
      alive = false;
    };
    // pointsKey stands for points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, orsKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const estimate = useMemo(() => estimateMatrix(points), [pointsKey]);
  const matrix = road?.key === pointsKey ? road.matrix : estimate;
  const pending = road?.key !== pointsKey && !!orsKey;

  // Each crew location's shortest loop; the shortest is the default start.
  const stopIdx = included.map((_, i) => bases.length + i);
  const options = useMemo(
    () =>
      bases
        .map((b, bi) => {
          const sub = subMatrix(matrix, bi, stopIdx);
          const order = shortestLoop(sub.hours);
          return { base: b, sub, order, loop: loopHours(sub.hours, order) };
        })
        .sort((a, b) => a.loop - b.loop),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matrix, bases, included.length],
  );
  const chosen = options.find((o) => o.base.name === homeName) ?? options[0];
  const work = [0, ...included.map((r) => Math.max(0, Number(r.hours) || 0))];
  const autoOvernight = chosen ? needsOvernight(chosen.sub.hours, chosen.order) : false;
  const overnight = overnightMode === "auto" ? autoOvernight : overnightMode === "on";
  const plan = chosen && included.length ? planDays({ matrix: chosen.sub, order: chosen.order, work, overnight, maxNights }) : null;

  // The road line for the chosen loop.
  const routeKey = chosen ? `${chosen.base.name}|${chosen.order.map((i) => included[i - 1]!.stop.jobNo).join(",")}|${pointsKey}` : "";
  const [line, setLine] = useState<{ key: string; pts: LatLng[] }>({ key: "", pts: [] });
  useEffect(() => {
    if (!chosen || !routeKey) return;
    let alive = true;
    const seq = [chosen.base, ...chosen.order.map((i) => included[i - 1]!.stop), chosen.base];
    void roadRoute(orsKey, seq).then((r) => alive && setLine({ key: routeKey, pts: r?.line ?? [] }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, orsKey]);
  const linePts = line.key === routeKey ? line.pts : NO_LINE;

  const mapTripRef = useRef(onMapTrip);
  mapTripRef.current = onMapTrip;
  useEffect(() => {
    const onMapTrip = mapTripRef.current;
    if (!chosen || !included.length) return onMapTrip(null);
    onMapTrip({
      key: routeKey,
      home: chosen.base,
      stops: chosen.order.map((i) => ({ ...included[i - 1]!.stop })),
      line: linePts,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, linePts]);
  useEffect(() => () => mapTripRef.current(null), []);

  const tripNow = (): SavedTrip | null => {
    if (!chosen || !plan) return null;
    const stops = included.map((r) => ({ ...r.stop, hours: Math.max(0, Number(r.hours) || 0) }));
    const home: LumineoLocation = chosen.base;
    return {
      id: saved?.id ?? crypto.randomUUID(),
      name: name.trim() || defaultTripName(home.region, home.name, stops),
      region,
      weekStart: saved?.weekStart ?? ymd(weekStart),
      home: { name: home.name, address: home.address, lat: home.lat, lng: home.lng },
      stops,
      plan,
      startHour,
      maxNights,
      source: matrix.source,
      line: linePts,
      savedBy: userName,
      savedAt: new Date().toISOString(),
    };
  };
  const save = async () => {
    const t = tripNow();
    if (!t) return;
    setSavedState("saving");
    await useTripStore.getState().save(t);
    setName(t.name);
    setSavedState("saved");
  };
  const print = () => {
    const t = tripNow();
    if (t) printMarkup(t.name, tripSheetHtml(t, format(new Date(`${t.weekStart}T00:00:00`), "MMM d, yyyy")));
  };
  const setRow = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setSavedState("");
  };

  return (
    <div className="tr">
      <div className="tr-head">
        <h3>{saved ? saved.name : `Trip · ${source.kind === "group" ? source.label : ""}`}</h3>
        <button type="button" className="pl-remove" aria-label="Close the trip" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="tr-field">
        <span className="tr-label">Leaves from</span>
        <div className="tr-starts">
          {options.map((o, i) => (
            <button
              key={o.base.name}
              type="button"
              className={`tr-start${o === chosen ? " tr-start--on" : ""}`}
              onClick={() => {
                setHomeName(o.base.name);
                setSavedState("");
              }}
              title={`${o.base.address} — shortest loop ${duration(o.loop)} of driving`}
            >
              {o.base.name}
              <small>
                {duration(o.loop)}
                {i === 0 ? " · shortest" : ""}
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className="tr-options">
        <label className="tr-field">
          <span className="tr-label">Overnight</span>
          <select value={overnightMode} onChange={(e) => setOvernightMode(e.target.value as "auto" | "on" | "off")}>
            <option value="auto">Auto ({autoOvernight ? "yes" : "no"} — over 4 h one-way)</option>
            <option value="on">Yes</option>
            <option value="off">No — day trips</option>
          </select>
        </label>
        <label className="tr-field">
          <span className="tr-label">Max nights</span>
          <select value={maxNights} onChange={(e) => setMaxNights(Number(e.target.value))} disabled={!overnight}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label className="tr-field">
          <span className="tr-label">Leave at</span>
          <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
            {LEAVE_HOURS.map((h) => (
              <option key={h} value={h}>
                {`${Math.floor(h)}:${h % 1 ? "30" : "00"} AM`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tr-field">
        <span className="tr-label">Jobs · on-site crew hours</span>
        <ul className="tr-stops">
          {rows.map((r, i) => (
            <li key={r.stop.jobNo} className={r.include ? "" : "tr-stop--off"}>
              <input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} aria-label={`Include ${r.stop.jobNo}`} />
              <span className="tr-stops__job">
                <b>{r.stop.jobNo}</b> {r.stop.name}
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={r.hours}
                onChange={(e) => setRow(i, { hours: e.target.value })}
                aria-label={`Hours for ${r.stop.jobNo}`}
                title={r.known ? "BC install hours — change for this trip" : `No BC install hours — planned at ${UNKNOWN_HOURS} h; set it`}
                className={r.known ? "" : "tr-hours--guess"}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="tr-note">
        {pending ? "Getting road drive times…" : road?.key === pointsKey && road.note ? road.note : matrix.source === "road" ? "" : "Estimated drive times."}
      </div>

      {plan ? (
        <>
          <TripTotals trip={{ home: chosen!.base, stops: included.map((r) => r.stop), plan, startHour, source: matrix.source }} />
          <TripDays
            trip={{
              home: chosen!.base,
              stops: included.map((r) => ({ ...r.stop, hours: Number(r.hours) || 0 })),
              plan,
              startHour,
              source: matrix.source,
            }}
          />
          <div className="tr-actions">
            {canEdit && (
              <>
                <input
                  className="form-field__input tr-name"
                  value={name}
                  placeholder={defaultTripName(chosen!.base.region, chosen!.base.name, included.map((r) => r.stop))}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSavedState("");
                  }}
                  aria-label="Trip name"
                />
                <button type="button" className="btn-primary" disabled={savedState === "saving"} onClick={() => void save()}>
                  {savedState === "saved" ? "Saved ✓" : saved ? "Save changes" : "Save trip"}
                </button>
              </>
            )}
            <button type="button" className="btn-secondary" onClick={print}>
              Print
            </button>
          </div>
          {canEdit && <p className="pl-hint">Saved trips show on the installers' Install Trips screen for the week of {format(weekStart, "MMM d")}.</p>}
        </>
      ) : (
        <div className="pl-empty">Tick at least one job.</div>
      )}
    </div>
  );
}
