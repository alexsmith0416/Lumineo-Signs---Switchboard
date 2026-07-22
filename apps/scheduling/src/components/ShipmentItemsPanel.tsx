import { format } from "date-fns";
import { loadLocations, STATUS_LABEL, type ShipmentLoad } from "../shipping/types";

/**
 * Read-only "view all jobs" list for a grouped shipment card — the same list
 * treatment as the Fill-in Jobs / Job Queue lists. Left-clicking a shipment card
 * on the Installation board opens this; each of the load's items (job / pickup)
 * gets a row. An "Edit card…" button falls back to the normal card editor.
 */
export default function ShipmentItemsPanel({
  load,
  onEdit,
  onClose,
}: {
  load: ShipmentLoad;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const stops = loadLocations(load);
  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          🚚 {load.name}
          <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            {format(load.shipDate, "EEE MMM d")} · {STATUS_LABEL[load.status]} ·{" "}
            {load.items.length} item{load.items.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="slide-over__body">
          {stops.length > 0 && (
            <div className="form-field form-field--block">
              <div className="jobcard__label">Stops</div>
              <div style={{ fontSize: 12 }}>{stops.join(" · ")}</div>
            </div>
          )}
          <div className="ship-items">
            {load.items.map((it) => {
              const isPickup = it.kind === "pickup";
              return (
                <div key={it.id} className={`ship-item${isPickup ? " ship-item--pickup" : ""}`}>
                  <div className="ship-item__head">
                    <span className="ship-item__job">{it.jobNo || "No job #"}</span>
                    <span className={`ship-item__badge ship-item__badge--${isPickup ? "pickup" : "delivery"}`}>
                      {isPickup ? "↩ Pickup" : "→ Delivery"}
                    </span>
                  </div>
                  {it.customerName && <div className="ship-item__cust">{it.customerName}</div>}
                  {it.description && <div className="ship-item__desc">{it.description}</div>}
                  {it.location && (
                    <div className="ship-item__field">
                      <span className="ship-item__label">{isPickup ? "Pickup" : "Delivery"} loc</span>
                      <span>{it.location}</span>
                    </div>
                  )}
                  {it.notes && (
                    <div className="ship-item__field">
                      <span className="ship-item__label">Notes</span>
                      <span>{it.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {onEdit && (
            <button className="btn-secondary" onClick={onEdit}>
              Edit card…
            </button>
          )}
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
