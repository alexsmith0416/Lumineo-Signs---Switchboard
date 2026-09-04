import { useMemo, useState } from "react";
import { addDays, format, isSameDay, isWeekend, startOfWeek } from "date-fns";
import { useLoadsStore } from "../shipping/loads-store";
import { useLoadScheduled } from "../services/install-cards";
import { loadLocations, STATUS_LABEL, type ShipmentLoad } from "../shipping/types";
import { PrintIcon } from "./PrintIcon";
import LoadEditorPanel from "./LoadEditorPanel";
import LoadPrintSheet from "./LoadPrintSheet";
import ShippingStageBoard from "./ShippingStageBoard";
import { useShippingQueueStore } from "../store/job-queue-store";
import { DND_SHIP_STAGE, findStagedItem, shipmentItemFromStage } from "../shipping/stage";

/**
 * Shipping Schedule — a weekly board whose cards are LOADS (truck runs), not
 * resource rows. Build loads as needed on any day; a load can carry multiple
 * delivery locations. No truck/employee assignment.
 *
 * Below the week sits the always-on staging kanban (`ShippingStageBoard`).
 * This component owns the drop targets that take a card OFF that board — a day
 * column (start a new load) and a load card (add to that load) — because it
 * owns the loads store and the editor panel.
 */
interface ShippingBoardProps {
  /** View-only (non-Admin/Ops): hide add buttons; loads open read-only. */
  readOnly?: boolean;
}

export default function ShippingBoard({ readOnly = false }: ShippingBoardProps = {}) {
  const weekStart = useLoadsStore((s) => s.weekStart);
  const setWeekStart = useLoadsStore((s) => s.setWeekStart);
  const loads = useLoadsStore((s) => s.loads);
  const addLoad = useLoadsStore((s) => s.addLoad);
  const addItem = useLoadsStore((s) => s.addItem);

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

  /**
   * A staged project was dropped onto a load (or onto a day, which builds a new
   * one first). It becomes an item on that load, leaves the staging board, and
   * the editor opens so the stop location / delivery-vs-pickup / notes — the
   * per-run details staging deliberately doesn't carry — can be filled in.
   *
   * Read via getState() rather than a subscription: this only runs on drop, and
   * subscribing here would re-render the whole week on every staging edit.
   */
  const dropStagedOnLoad = (loadId: string, stageId: string) => {
    const queue = useShippingQueueStore.getState();
    const staged = findStagedItem(queue.groups, stageId);
    if (!staged) return;
    addItem(loadId, shipmentItemFromStage(staged));
    queue.removeItem(stageId);
    setEditId(loadId);
  };

  const dropStagedOnDay = (day: Date, stageId: string) => {
    const staged = findStagedItem(useShippingQueueStore.getState().groups, stageId);
    if (!staged) return;
    const d = new Date(day);
    d.setHours(8, 0, 0, 0);
    dropStagedOnLoad(addLoad(d), stageId);
  };

  const stageIdFrom = (e: React.DragEvent): string | null =>
    e.dataTransfer.types.includes(DND_SHIP_STAGE) ? e.dataTransfer.getData(DND_SHIP_STAGE) : null;

  const isThisWeek =
    startOfWeek(weekStart, { weekStartsOn: 1 }).getTime() ===
    startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();

  const printLoad = printId ? loads.find((l) => l.id === printId) : null;

  return (
    <div>
      <div className="calendar-toolbar calendar-toolbar--ship">
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
        {!readOnly && (
          <button className="btn-add-job" onClick={() => addOn(new Date(isThisWeek ? new Date() : weekStart))}>
            + Add Load
          </button>
        )}
      </div>

      <div className="ship-board">
        {days.map((day) => (
          <DayColumn
            key={day.toISOString()}
            day={day}
            loads={byDay.get(day.toDateString()) ?? []}
            readOnly={readOnly}
            onAdd={() => addOn(day)}
            onOpen={setEditId}
            onPrint={setPrintId}
            stageIdFrom={stageIdFrom}
            onDropStagedOnDay={(stageId) => dropStagedOnDay(day, stageId)}
            onDropStagedOnLoad={dropStagedOnLoad}
          />
        ))}
      </div>

      <ShippingStageBoard readOnly={readOnly} />

      {editId && (
        <LoadEditorPanel
          loadId={editId}
          onClose={() => setEditId(null)}
          onPrint={() => setPrintId(editId)}
          readOnly={readOnly}
        />
      )}
      {printLoad && <LoadPrintSheet load={printLoad} onClose={() => setPrintId(null)} />}
    </div>
  );
}

// --- One day of the week ---------------------------------------------------
// Its own component so the drop highlight is local state — hovering a staged
// card over Wednesday must not re-render the other six columns.
function DayColumn({
  day,
  loads,
  readOnly,
  onAdd,
  onOpen,
  onPrint,
  stageIdFrom,
  onDropStagedOnDay,
  onDropStagedOnLoad,
}: {
  day: Date;
  loads: ShipmentLoad[];
  readOnly: boolean;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onPrint: (id: string) => void;
  stageIdFrom: (e: React.DragEvent) => string | null;
  onDropStagedOnDay: (stageId: string) => void;
  onDropStagedOnLoad: (loadId: string, stageId: string) => void;
}) {
  const [dropActive, setDropActive] = useState(false);
  const accepts = (e: React.DragEvent) =>
    !readOnly && e.dataTransfer.types.includes(DND_SHIP_STAGE);

  return (
    <div className={`ship-col${isWeekend(day) ? " ship-col--weekend" : ""}`}>
      <div className="ship-col__head">
        <span className="ship-col__dow">{format(day, "EEE")}</span>
        <span className="ship-col__date">{format(day, "MMM d")}</span>
      </div>
      <div
        className={"ship-col__body" + (dropActive ? " ship-col__body--drop" : "")}
        onDragOver={(e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
        }}
        onDrop={(e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          setDropActive(false);
          const stageId = stageIdFrom(e);
          if (stageId) onDropStagedOnDay(stageId);
        }}
      >
        {loads.map((load) => (
          <LoadCard
            key={load.id}
            load={load}
            readOnly={readOnly}
            onOpen={() => onOpen(load.id)}
            onPrint={() => onPrint(load.id)}
            stageIdFrom={stageIdFrom}
            onDropStaged={(stageId) => onDropStagedOnLoad(load.id, stageId)}
          />
        ))}
        {!readOnly && (
          <button className="ship-col__add" onClick={onAdd}>+ Add load</button>
        )}
        {dropActive && loads.length === 0 && (
          <div className="ship-col__drop-hint">Drop to start a load</div>
        )}
      </div>
    </div>
  );
}

function LoadCard({
  load,
  readOnly,
  onOpen,
  onPrint,
  stageIdFrom,
  onDropStaged,
}: {
  load: ShipmentLoad;
  readOnly: boolean;
  onOpen: () => void;
  onPrint: () => void;
  stageIdFrom: (e: React.DragEvent) => string | null;
  onDropStaged: (stageId: string) => void;
}) {
  const locations = loadLocations(load);
  const pickups = load.items.filter((i) => i.kind === "pickup").length;
  const scheduled = useLoadScheduled(load.id);
  const [dropActive, setDropActive] = useState(false);
  const accepts = (e: React.DragEvent) =>
    !readOnly && e.dataTransfer.types.includes(DND_SHIP_STAGE);

  return (
    <div
      className={"load-card" + (dropActive ? " load-card--drop" : "")}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onDragOver={(e) => {
        if (!accepts(e)) return;
        // Stop the day column underneath from also claiming this drop — landing
        // on a load means "add to THIS load", not "start another one".
        e.preventDefault();
        e.stopPropagation();
        setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
      }}
      onDrop={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropActive(false);
        const stageId = stageIdFrom(e);
        if (stageId) onDropStaged(stageId);
      }}
    >
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
