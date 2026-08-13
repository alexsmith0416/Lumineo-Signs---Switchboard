import { useRef } from "react";
import { format } from "date-fns";
import { loadLocations, type ShipmentLoad } from "../shipping/types";
import { printMarkup } from "../services/print";

/**
 * Printable loading list for a single load — mirrors the Excel sheet
 * (route header, ship date, Job/Customer/Description/Location/Notes, pickups
 * flagged, with Loaded + Order check-off boxes for the loader and a wide Notes
 * column to write in). Shown as an overlay preview;
 * Print triggers window.print(), and @media print shows only the sheet.
 */
export default function LoadPrintSheet({
  load,
  onClose,
}: {
  load: ShipmentLoad;
  onClose: () => void;
}) {
  const locations = loadLocations(load);
  const showLocation = locations.length > 1;
  const sheetRef = useRef<HTMLDivElement>(null);
  return (
    <div className="load-print" onClick={onClose}>
      <div className="load-print__sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
        <div className="load-print__head">
          <div className="load-print__title">{load.name.toUpperCase()} — SHIPPING LIST</div>
          <div className="load-print__date">Shipping Date: {format(load.shipDate, "M/d/yy")}</div>
        </div>
        {locations.length > 0 && (
          <div className="load-print__stops">Stops: {locations.join(" · ")}</div>
        )}
        <table className="load-print__table">
          <thead>
            <tr>
              <th className="load-print__chk">Loaded</th>
              <th className="load-print__chk">Order</th>
              <th>Job No.</th>
              <th>Customer</th>
              <th className="load-print__desc">Description</th>
              {showLocation && <th>Location</th>}
              <th className="load-print__notes">Notes</th>
            </tr>
          </thead>
          <tbody>
            {load.items.map((it) => (
              <tr key={it.id}>
                <td className="load-print__chk">☐</td>
                <td className="load-print__chk">☐</td>
                <td>{it.jobNo ?? "—"}</td>
                <td>{it.customerName}</td>
                <td className="load-print__desc">
                  {it.kind === "pickup" && <strong>* PICK-UP * </strong>}
                  {it.description}
                </td>
                {showLocation && <td>{it.location}</td>}
                <td className="load-print__notes">{it.notes}</td>
              </tr>
            ))}
            {load.items.length === 0 && (
              <tr>
                <td colSpan={showLocation ? 7 : 6} style={{ textAlign: "center", color: "#888" }}>
                  No items on this load.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {load.generalNotes.trim() && (
          <div className="load-print__general">
            <strong>Load notes:</strong> {load.generalNotes}
          </div>
        )}

        <div className="load-print__actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button
            className="btn-primary"
            onClick={() =>
              printMarkup(`${load.name} — Shipping List`, sheetRef.current?.outerHTML ?? "")
            }
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
