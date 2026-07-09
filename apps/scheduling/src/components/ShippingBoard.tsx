import { useMemo, useState } from "react";
import { addDays, format, isSameDay, isWeekend, startOfWeek } from "date-fns";
import { useLoadsStore } from "../shipping/loads-store";
import { useLoadScheduled } from "../services/install-cards";
import { loadLocations, STATUS_LABEL, type ShipmentLoad } from "../shipping/types";
import { PrintIcon } from "./PrintIcon";
import LoadEditorPanel from "./LoadEditorPanel";
import LoadPrintSheet from "./LoadPrintSheet";

/**
 * Shipping Schedule — a weekly board whose cards are LOADS (truck runs), not
 * resource rows. Build loads as needed on any day; a load can carry multiple
 * delivery locations. No truck/employee assignment.
 */
export default function ShippingBoard() {
  const weekStart = useLoadsStore((s) => s.weekStart);
  const setWeekStart = useLoadsStore((s) => s.setWeekStart);
  const loads = useLoadsStore((s) => s.loads);
  const addLoad = useLoadsStore((s) => s.addLoad);

  const [editId, setEditId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ShipmentLoad[]>();
    for (const d of days) map.set(d.toDateString(), []);
    for (const l of loads) {
      const key = l.shipDate.toDateString();
      if (map.has(key)) map.get(key)!.push(l);
    }
    return map;
  }, [loads, days]);

  const addOn = (day: Date) => {
    const d = new Date(day);
    d.setHours(8, 0, 0, 0);
    setEditId(addLoad(d));
  };

  const isThisWeek =
    startOfWeek(weekStart, { weekStartsOn: 1 }).getTime() ===
    startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();

  const printLoad = printId ? loads.find((l) => l.id === printId) : null;

  return (
    <div>
      <div className="calendar-toolbar">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">‹ Prev</button>
        <button
          className="calendar-toolbar__today"
          onClick={() => setWeekStart(new Date())}
          disabled={isThisWeek}
          title="Jump back to this week"
        >
          Today
        </button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">Next ›</button>
        <div className="calendar-toolbar__label">Week of {format(weekStart, "MMM d, yyyy")}</div>
        <div className="calendar-toolbar__spacer" />
        <button className="btn-add-job" onClick={() => addOn(new Date(isThisWeek ? new Date() : weekStart))}>
          + Add Load
        </button>
      </div>

      <div className="ship-board">
        {days.map((day) => {
          const dayLoads = byDay.get(day.toDateString()) ?? [];
          return (
            <div key={day.toISOString()} className={`ship-col${isWeekend(day) ? " ship-col--weekend" : ""}`}>
              <div className="ship-col__head">
                <span className="ship-col__dow">{format(day, "EEE")}</span>
                <span className="ship-col__date">{format(day, "MMM d")}</span>
              </div>
              <div className="ship-col__body">
                {dayLoads.map((load) => (
                  <LoadCard
                    key={load.id}
                    load={load}
                    onOpen={() => setEditId(load.id)}
                    onPrint={() => setPrintId(load.id)}
                  />
                ))}
                <button className="ship-col__add" onClick={() => addOn(day)}>+ Add load</button>
              </div>
            </div>
          );
        })}
      </div>

      {editId && (
        <LoadEditorPanel
          loadId={editId}
          onClose={() => setEditId(null)}
          onPrint={() => setPrintId(editId)}
        />
      )}
      {printLoad && <LoadPrintSheet load={printLoad} onClose={() => setPrintId(null)} />}
    </div>
  );
}

function LoadCard({
  load,
  onOpen,
  onPrint,
}: {
  load: ShipmentLoad;
  onOpen: () => void;
  onPrint: () => void;
}) {
  const locations = loadLocations(load);
  const pickups = load.items.filter((i) => i.kind === "pickup").length;
  const scheduled = useLoadScheduled(load.id);
  return (
    <div className="load-card" onClick={onOpen} role="button" tabIndex={0}>
      <div className="load-card__head">
        <span className="load-card__name">{load.name}</span>
        {scheduled && (
          <span className="load-card__scheduled" title="Placed on the install schedule">
            🚚 Scheduled
          </span>
        )}
        <span className={`status-chip status-chip--${load.status}`}>{STATUS_LABEL[load.status]}</span>
      </div>
      <div className="load-card__locs">
        {locations.length ? locations.join(" · ") : "No stops yet"}
      </div>
      <div className="load-card__meta">
        <span>{load.items.length} item{load.items.length === 1 ? "" : "s"}</span>
        {pickups > 0 && <span className="load-card__pickup">{pickups} pickup</span>}
        <span style={{ flex: 1 }} />
        <button
          className="load-card__print"
          title="Print loading list"
          onClick={(e) => {
            e.stopPropagation();
            onPrint();
          }}
        >
          <PrintIcon size="1em" />
        </button>
      </div>
    </div>
  );
}
