import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import PlannerMap, { type MapTrip } from "./PlannerMap";
import TripDays, { TripTotals, tripSheetHtml } from "./TripDays";
import { useTripStore } from "../../store/trip-store";
import { printMarkup } from "../../services/print";
import type { Region } from "../../services/geo";
import type { SavedTrip } from "../../services/saved-trips";

const NO_JOBS: never[] = [];

/**
 * Install Trips (Oct 11, 2026) — the installers' view-only list of the trips
 * Admin / Ops saved in the Install Planner: from last week on, for their
 * region. Each shows its route on the map, the plan day by day with a Google
 * Maps link per day, and a printable sheet.
 */
export default function TripsView({ region }: { region: Region | "both" }) {
  const trips = useTripStore((s) => s.trips);
  const loaded = useTripStore((s) => s.loaded);
  const error = useTripStore((s) => s.error);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    void useTripStore.getState().load(true);
  }, []);

  const since = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7), "yyyy-MM-dd");
  const byWeek = useMemo(() => {
    const list = trips
      .filter((t) => t.weekStart >= since && (region === "both" || t.region === region))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.name.localeCompare(b.name));
    const m = new Map<string, SavedTrip[]>();
    for (const t of list) m.set(t.weekStart, [...(m.get(t.weekStart) ?? []), t]);
    return [...m.entries()];
  }, [trips, region, since]);
  const trip = trips.find((t) => t.id === selected) ?? byWeek[0]?.[1][0] ?? null;

  const mapTrip: MapTrip | null = useMemo(
    () =>
      trip
        ? {
            key: trip.id,
            home: trip.home,
            stops: trip.plan.order.map((i) => trip.stops[i - 1]!).filter(Boolean),
            line: trip.line,
          }
        : null,
    [trip],
  );

  return (
    <div className="pl">
      {error && <div className="pl-error">Couldn't load the trips: {error}</div>}
      <div className="pl-body">
        <aside className="pl-panel">
          <div className="pl-panel__body">
            {!loaded ? (
              <div className="pl-empty">Loading trips…</div>
            ) : !byWeek.length ? (
              <div className="pl-empty">No trips planned yet{region === "both" ? "" : ` for ${region}`}.</div>
            ) : (
              byWeek.map(([week, list]) => (
                <section key={week} className="trv-week">
                  <h3 className="pl-must__head">Week of {format(parseISO(week), "MMM d")}</h3>
                  <ul className="pl-groups">
                    {list.map((t) => (
                      <li key={t.id} className={`pl-group${t.id === trip?.id ? " pl-group--on" : ""}`}>
                        <button type="button" className="pl-group__head" onClick={() => setSelected(t.id)}>
                          <span className="pl-group__title">{t.name}</span>
                          <span className="pl-group__region">{t.region}</span>
                        </button>
                        <TripTotals trip={t} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
            {trip && (
              <div className="trv-detail">
                <div className="tr-head">
                  <h3>{trip.name}</h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => printMarkup(trip.name, tripSheetHtml(trip, format(parseISO(trip.weekStart), "MMM d, yyyy")))}
                  >
                    Print
                  </button>
                </div>
                <div className="pl-hint">
                  Leaves {trip.home.name} · {trip.home.address}
                </div>
                <TripDays trip={trip} />
              </div>
            )}
          </div>
        </aside>
        <div className="pl-mapwrap">
          <PlannerMap
            jobs={NO_JOBS}
            groups={NO_JOBS}
            radiusMi={0}
            selectedJob={null}
            selectedGroup={null}
            onSelectJob={() => {}}
            onSelectGroup={() => {}}
            fitKey=""
            trip={mapTrip}
          />
        </div>
      </div>
    </div>
  );
}
