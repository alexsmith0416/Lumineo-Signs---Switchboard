import { useState } from "react";
import type { QueueGroup } from "../services/job-queue-data";

// Shared by the calendar Job Queue panel and the Shipping staging board, so a
// list looks and is colored the same wherever it lives.

// Group header color choices (bg + matching text).
const GROUP_COLORS: Array<{ color: string; textColor: string }> = [
  { color: "#F6A623", textColor: "#5B3A00" },
  { color: "#4A90D9", textColor: "#08243F" },
  { color: "#2E9B6B", textColor: "#06301F" },
  { color: "#E8151B", textColor: "#FFFFFF" },
  { color: "#6E5BD6", textColor: "#FFFFFF" },
  { color: "#141464", textColor: "#FFFFFF" },
  { color: "#E4E7EC", textColor: "#2A2F3A" },
];


// --- Add / edit group dialog ----------------------------------------------
export default function QueueGroupDialog({
  initial,
  onCancel,
  onSave,
  noun = "group",
  placeholder = "e.g. Needs Scheduled",
}: {
  initial?: QueueGroup;
  onCancel: () => void;
  onSave: (vals: { name: string; color: string; textColor: string }) => void;
  /** What the caller calls one of these — the Shipping staging board says
   *  "list", the calendar Job Queue says "group". Lower-case; titles capitalize. */
  noun?: string;
  placeholder?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? GROUP_COLORS[0]!.color);
  const [textColor, setTextColor] = useState(initial?.textColor ?? GROUP_COLORS[0]!.textColor);
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
        <div className="modal-card__title">{initial ? `Edit ${noun}` : `New ${noun}`}</div>
        <div className="modal-card__body">
          <div className="form-field">
            <div className="form-field__label">{Noun} name</div>
            <input
              className="form-field__input"
              value={name}
              autoFocus
              placeholder={placeholder}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onSave({ name, color, textColor });
              }}
            />
          </div>
          <div className="form-field">
            <div className="form-field__label">Header color</div>
            <div className="jq-swatches">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  className={"jq-swatch" + (c.color === color ? " jq-swatch--on" : "")}
                  style={{ background: c.color }}
                  aria-label={c.color}
                  onClick={() => {
                    setColor(c.color);
                    setTextColor(c.textColor);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="form-field">
            <div className="form-field__label">Custom color</div>
            <div className="jq-color-builder">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Header background"
              />
              <div className="jq-color-builder__preview" style={{ background: color, color: textColor }}>
                {name.trim() || "Preview"}
              </div>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                title="Header text color"
              />
            </div>
          </div>
          <div className="form-field">
            <div className="form-field__label">Auto-fill from BC</div>
            <button className="form-field__input" type="button" disabled title="Planned">
              Set up a BC filter — coming soon
            </button>
          </div>
        </div>
        <div className="modal-card__actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave({ name, color, textColor })}>
            {initial ? "Save" : `Add ${noun}`}
          </button>
        </div>
      </div>
    </div>
  );
}
