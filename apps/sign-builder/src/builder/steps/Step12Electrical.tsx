import { useSpec } from "../../app/SpecContext";

const OPTIONS = ["New Conduit Required", "Existing Conduit", "No Electrical"];
const CONDUIT_SIZES = ["3/4in", "1in", "1.5in", "2in", "Custom"];

export function Step12Electrical() {
  const { spec, update } = useSpec();

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>12 · Electrical</span></div>
      <div className="sbp-step__body">
        <div className="sbp-toggle-row">
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={"lum-btn is-toggle" + (spec.electrical === opt ? " is-active" : "")}
              onClick={() => update({
                electrical: opt,
                ...(opt === "New Conduit Required" ? {} : { conduitSize: "", panelLocation: "" }),
              })}
            >
              {opt}
            </button>
          ))}
        </div>

        {spec.electrical === "New Conduit Required" ? (
          <div className="sbp-step__twocol" style={{ marginTop: 14, gridTemplateColumns: "1fr 2fr" }}>
            <div>
              <span className="lum-field-label">Conduit Size</span>
              <select
                className="lum-select"
                value={spec.conduitSize}
                onChange={(e) => update({ conduitSize: e.target.value })}
              >
                <option value="">Select…</option>
                {CONDUIT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="lum-field-label">Panel Location</span>
              <input
                className="lum-input"
                value={spec.panelLocation}
                onChange={(e) => update({ panelLocation: e.target.value })}
                placeholder="e.g. Exterior NE corner"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
