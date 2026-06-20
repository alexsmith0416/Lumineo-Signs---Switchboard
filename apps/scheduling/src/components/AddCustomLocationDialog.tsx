import { useState } from "react";
import type { Department } from "../engine/types";

interface AddCustomLocationDialogProps {
  onClose: () => void;
  onAdd: (dept: Department) => void;
  /** Next flowOrder value to assign — keeps things grouped sensibly. */
  nextFlowOrder: number;
}

// Default palette cycled per new custom location so they don't all
// land on the same color.
const PALETTE = [
  "#BED7FF",
  "#FAC775",
  "#CECBF6",
  "#C8E6D4",
  "#FFE0A8",
  "#D6DCE5",
  "#F8D5B7",
  "#FFC1D6",
];

export default function AddCustomLocationDialog({
  onClose,
  onAdd,
  nextFlowOrder,
}: AddCustomLocationDialogProps) {
  const [state, setState] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[nextFlowOrder % PALETTE.length]!);

  const fullLabel = state && name ? `${state} - ${name}` : state || name || "";

  const submit = () => {
    if (!fullLabel) return;
    const id = `loc-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    onAdd({
      id,
      name: fullLabel,
      flowOrder: nextFlowOrder,
      color,
    });
    onClose();
  };

  return (
    <div className="slide-over" onClick={onClose} style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add custom shipping location"
        style={{
          background: "var(--surface-raised)",
          borderRadius: 8,
          width: 420,
          maxWidth: "94vw",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div className="section-title">Add custom shipping location</div>

        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
            Format: <strong>State – Customer Name</strong>. e.g. "Colorado – DaVinci Signs", "Missouri – Signs &amp; Design".
          </div>

          <div className="form-field">
            <div className="form-field__label">State</div>
            <input
              className="form-field__input"
              placeholder="e.g. Colorado"
              value={state}
              onChange={(e) => setState(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-field">
            <div className="form-field__label">Customer / Site</div>
            <input
              className="form-field__input"
              placeholder="e.g. DaVinci Signs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <div className="form-field__label">Color</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 8px",
                background: "var(--input-bg)",
              }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 40, height: 28, border: "none", cursor: "pointer" }}
              />
              <div
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  background: color,
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {fullLabel || "Preview"}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
            background: "var(--bg-secondary)",
          }}
        >
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={submit}
            disabled={!fullLabel}
          >
            Add location
          </button>
        </div>
      </div>
    </div>
  );
}
