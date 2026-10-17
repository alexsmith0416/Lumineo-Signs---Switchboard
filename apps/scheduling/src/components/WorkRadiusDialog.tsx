import { useState } from "react";

/** "Add work radius…" on an install location banner: the location's normal
 *  work radius in miles (blank / Remove = none). Admin / Ops. */
export default function WorkRadiusDialog({
  locationName,
  miles,
  onSave,
  onCancel,
}: {
  locationName: string;
  miles: number | null;
  onSave: (miles: number | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(miles ? String(miles) : "");
  const n = Number(value);
  const valid = value.trim() === "" || (Number.isFinite(n) && n > 0 && n <= 500);
  return (
    <div className="modal-scrim" onClick={(e) => (e.stopPropagation(), onCancel())}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__title">Work radius · {locationName}</div>
        <div className="modal-card__body">
          <p style={{ margin: "0 0 8px" }}>
            How far {locationName}&rsquo;s crews normally go. A card for a job farther away is marked in the colours of
            the location the job is in.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              className="form-field__input"
              type="number"
              min="1"
              max="500"
              step="5"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: 100 }}
            />
            miles
          </label>
        </div>
        <div className="modal-card__actions">
          {miles != null && (
            <button className="btn-secondary" onClick={() => onSave(null)}>
              Remove
            </button>
          )}
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!valid} onClick={() => onSave(value.trim() ? n : null)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
