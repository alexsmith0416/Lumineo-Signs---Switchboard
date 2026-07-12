import { useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { useLoadsStore } from "../shipping/loads-store";
import { STATUS_LABEL, STATUS_ORDER, type ShipmentItem, type ShipmentStatus } from "../shipping/types";
import JobSearch from "./JobSearch";
import LocationSelect from "./LocationSelect";
import ConfirmDialog from "./ConfirmDialog";

interface LoadEditorPanelProps {
  loadId: string;
  onClose: () => void;
  onPrint: () => void;
}

export default function LoadEditorPanel({ loadId, onClose, onPrint }: LoadEditorPanelProps) {
  const load = useLoadsStore((s) => s.loads.find((l) => l.id === loadId));
  const updateLoad = useLoadsStore((s) => s.updateLoad);
  const deleteLoad = useLoadsStore((s) => s.deleteLoad);
  const addItem = useLoadsStore((s) => s.addItem);
  const updateItem = useLoadsStore((s) => s.updateItem);
  const removeItem = useLoadsStore((s) => s.removeItem);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Week shown in the day-picker. Null = follow the load's own week; set by the
  // ‹ / › arrows so a load can be moved to a different week, not just another day
  // in the same week.
  const [pickerWeek, setPickerWeek] = useState<Date | null>(null);

  if (!load) return null;

  const week = pickerWeek ?? startOfWeek(load.shipDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel slide-over__panel--wide" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Edit load</div>

        <div className="form-field">
          <div className="form-field__label">Load / route name</div>
          <input
            className="form-field__input"
            type="text"
            value={load.name}
            onChange={(e) => updateLoad(load.id, { name: e.target.value })}
          />
        </div>

        <div className="form-field">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <div className="form-field__label" style={{ margin: 0 }}>Ship day</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "2px 8px" }}
                title="Previous week"
                onClick={() => setPickerWeek(addDays(week, -7))}
              >
                ‹
              </button>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 90, textAlign: "center" }}>
                Week of {format(week, "MMM d")}
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "2px 8px" }}
                title="Next week"
                onClick={() => setPickerWeek(addDays(week, 7))}
              >
                ›
              </button>
            </div>
          </div>
          <div className="load-day-picker">
            {days.map((d) => {
              const on = isSameDay(d, load.shipDate);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  className={`load-day-picker__day${on ? " load-day-picker__day--on" : ""}`}
                  onClick={() => {
                    const next = new Date(d);
                    next.setHours(8, 0, 0, 0);
                    updateLoad(load.id, { shipDate: next });
                  }}
                >
                  <span>{format(d, "EEE")}</span>
                  <strong>{format(d, "M/d")}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-field">
          <div className="form-field__label">Status</div>
          <select
            className="form-field__select"
            value={load.status}
            onChange={(e) => updateLoad(load.id, { status: e.target.value as ShipmentStatus })}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <div className="form-field__label">Load notes (optional)</div>
          <textarea
            className="form-field__input"
            rows={2}
            value={load.generalNotes}
            placeholder="Trailer swaps, sequencing, etc."
            onChange={(e) => updateLoad(load.id, { generalNotes: e.target.value })}
          />
        </div>

        <div className="load-items">
          <div className="load-items__head">
            <span>Items ({load.items.length})</span>
          </div>

          {load.items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              onChange={(patch) => updateItem(load.id, it.id, patch)}
              onRemove={() => removeItem(load.id, it.id)}
            />
          ))}

          <div className="load-items__add">
            <JobSearch
              onPick={(job) =>
                addItem(load.id, {
                  jobNo: job.jobNo,
                  customerName: job.customerName,
                  description: job.description,
                })
              }
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => addItem(load.id, { customerName: "" })}
            >
              + Manual item
            </button>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={onPrint}>Print</button>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete load?"
          message={`Delete "${load.name}" and its ${load.items.length} item(s)? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteLoad(load.id);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: ShipmentItem;
  onChange: (patch: Partial<ShipmentItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`load-item${item.kind === "pickup" ? " load-item--pickup" : ""}`}>
      <div className="load-item__top">
        <label className="load-item__loaded" title="Mark loaded">
          <input
            type="checkbox"
            checked={item.loaded}
            onChange={(e) => onChange({ loaded: e.target.checked })}
          />
        </label>
        <span className="load-item__jobno">{item.jobNo ?? "—"}</span>
        <input
          className="load-item__field load-item__cust"
          type="text"
          value={item.customerName}
          placeholder="Customer / item"
          onChange={(e) => onChange({ customerName: e.target.value })}
        />
        <div className="load-item__kind">
          {(["delivery", "pickup"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`load-item__kind-btn${item.kind === k ? " load-item__kind-btn--on" : ""}`}
              onClick={() => onChange({ kind: k })}
            >
              {k === "delivery" ? "Deliver" : "Pickup"}
            </button>
          ))}
        </div>
        <button type="button" className="load-item__remove" title="Remove" onClick={onRemove}>×</button>
      </div>
      <textarea
        className="load-item__field load-item__desc"
        rows={1}
        value={item.description}
        placeholder="Description (editable)"
        onChange={(e) => onChange({ description: e.target.value })}
      />
      <div className="load-item__bottom">
        <LocationSelect value={item.location} onChange={(loc) => onChange({ location: loc })} />
        <input
          className="load-item__field load-item__notes"
          type="text"
          value={item.notes}
          placeholder="Loading / unloading notes"
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
