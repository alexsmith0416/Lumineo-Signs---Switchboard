import { useSpec } from "../../app/SpecContext";

const POLE_OPTIONS = ["New Pole", "Existing Pole", "No Pole"];
const DIAMETERS = ["2in", "3in", "4in", "6in", "Custom"];
const MATERIALS = ["Aluminum", "Steel", "Galvanized Steel"];

export function Step10Pole() {
  const { spec, update } = useSpec();

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>10 · Interior Support Pole</span></div>
      <div className="sbp-step__body">
        <div className="sbp-toggle-row">
          {POLE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={"lum-btn is-toggle" + (spec.poleType === opt ? " is-active" : "")}
              onClick={() => update({
                poleType: opt,
                // Clear sub-fields when not "New Pole"
                ...(opt === "New Pole" ? {} : { poleDiameter: "", poleMaterial: "" }),
              })}
            >
              {opt}
            </button>
          ))}
        </div>

        {spec.poleType === "New Pole" ? (
          <div className="sbp-step__twocol" style={{ marginTop: 14, gridTemplateColumns: "1fr 2fr" }}>
            <div>
              <span className="lum-field-label">Diameter</span>
              <select
                className="lum-select"
                value={spec.poleDiameter}
                onChange={(e) => update({ poleDiameter: e.target.value })}
              >
                <option value="">Select…</option>
                {DIAMETERS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <span className="lum-field-label">Material</span>
              <select
                className="lum-select"
                value={spec.poleMaterial}
                onChange={(e) => update({ poleMaterial: e.target.value })}
              >
                <option value="">Select…</option>
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
